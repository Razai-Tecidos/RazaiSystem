import { useState, useCallback, useEffect } from 'react';
import { Timestamp } from 'firebase/firestore';
import { CapturaItem, CreateCapturaData } from '@/types/captura.types';
import { encontrarConflitos } from '@/lib/deltaE';
import { labToRgb, rgbToHex } from '@/lib/colorUtils';
import { getCorById } from '@/lib/firebase/cores';
import { useCores } from './useCores';
import { useCorTecido } from './useCorTecido';
import { useConfig } from './useConfig';
import { CreateCorData, CreateCorTecidoData, Cor } from '@/types/cor.types';

export type AcaoConflito = 'usar_existente' | 'criar_nova';

interface UseCapturaListaReturn {
  capturas: CapturaItem[];
  adicionarCaptura: (data: CreateCapturaData) => void;
  removerCaptura: (id: string) => void;
  atualizarCaptura: (id: string, updates: Partial<CapturaItem>) => void;
  limparLista: () => void;
  validarConflitos: () => void;
  enviarCores: (acoesConflito?: Map<string, AcaoConflito>) => Promise<{ sucesso: number; falhas: number }>;
  temConflitos: boolean;
}

/**
 * Hook para gerenciar lista de capturas de cores
 * Gerencia estado local e valida conflitos com cores existentes
 * Usa o limiar de Delta E global salvo no Firebase
 */
export function useCapturaLista(): UseCapturaListaReturn {
  const [capturas, setCapturas] = useState<CapturaItem[]>([]);
  const { cores, createCor, findSimilar } = useCores();
  const { createVinculo, vinculoExists } = useCorTecido();
  const { deltaELimiar } = useConfig();

  /**
   * Valida conflitos de todas as capturas com cores existentes
   * Usa o limiar de Delta E global do Firebase
   */
  const validarConflitos = useCallback(() => {
    // Se não há cores ou cores não estão carregadas ainda, não validar
    if (!cores || cores.length === 0) {
      // Sem cores existentes, remover conflitos
      setCapturas((prev) =>
        prev.map((item) => ({
          ...item,
          status: 'normal' as const,
          deltaE: undefined,
          corConflitoId: undefined,
          corConflitoNome: undefined,
          corConflitoHex: undefined,
        }))
      );
      return;
    }
    
    // Filtrar apenas cores que têm codigoHex válido para comparação
    const coresValidas = cores.filter((cor) => cor.codigoHex && cor.codigoHex.startsWith('#'));
    
    if (coresValidas.length === 0) {
      // Sem cores válidas para comparar, remover conflitos
      setCapturas((prev) =>
        prev.map((item) => ({
          ...item,
          status: 'normal' as const,
          deltaE: undefined,
          corConflitoId: undefined,
          corConflitoNome: undefined,
          corConflitoHex: undefined,
        }))
      );
      return;
    }

    setCapturas((prev) =>
      prev.map((item) => {
        // Usar limiar global do Firebase
        const conflito = encontrarConflitos(item.lab, coresValidas, deltaELimiar);

        if (conflito) {
          return {
            ...item,
            status: 'conflito' as const,
            deltaE: conflito.deltaE,
            corConflitoId: conflito.corId,
            corConflitoNome: conflito.corNome,
            corConflitoHex: conflito.corHex,
          };
        } else {
          return {
            ...item,
            status: 'normal' as const,
            deltaE: undefined,
            corConflitoId: undefined,
            corConflitoNome: undefined,
            corConflitoHex: undefined,
          };
        }
      })
    );
  }, [cores, deltaELimiar]);

  /**
   * Adiciona uma nova captura à lista
   */
  const adicionarCaptura = useCallback(
    (data: CreateCapturaData) => {
      const novaCaptura: CapturaItem = {
        id: `captura-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        lab: data.lab,
        labOriginal: data.labOriginal,
        hex: data.hex,
        nome: data.nome,
        tecidoId: data.tecidoId,
        tecidoNome: data.tecidoNome,
        tecidoImagemPadrao: data.tecidoImagemPadrao,
        tecidoSku: data.tecidoSku,
        status: 'normal',
        createdAt: Timestamp.now(),
      };

      setCapturas((prev) => {
        const novasCapturas = [...prev, novaCaptura];
        
        // Validar conflitos após adicionar usando limiar global
        if (cores && cores.length > 0) {
          const coresValidas = cores.filter((cor) => cor.codigoHex && cor.codigoHex.startsWith('#'));
          if (coresValidas.length > 0) {
            const conflito = encontrarConflitos(novaCaptura.lab, coresValidas, deltaELimiar);
            if (conflito) {
              novaCaptura.status = 'conflito';
              novaCaptura.deltaE = conflito.deltaE;
              novaCaptura.corConflitoId = conflito.corId;
              novaCaptura.corConflitoNome = conflito.corNome;
              novaCaptura.corConflitoHex = conflito.corHex;
            }
          }
        }
        
        return novasCapturas;
      });
    },
    [cores, deltaELimiar]
  );

  /**
   * Remove uma captura da lista
   */
  const removerCaptura = useCallback((id: string) => {
    setCapturas((prev) => prev.filter((item) => item.id !== id));
  }, []);

  /**
   * Atualiza uma captura existente
   */
  const atualizarCaptura = useCallback((id: string, updates: Partial<CapturaItem>) => {
    setCapturas((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const atualizado = { ...item, ...updates };
          
          // Se atualizou LAB ou cores foram atualizadas, revalidar conflitos usando limiar global
          if (updates.lab && cores && cores.length > 0) {
            const coresValidas = cores.filter((cor) => cor.codigoHex && cor.codigoHex.startsWith('#'));
            if (coresValidas.length > 0) {
              const conflito = encontrarConflitos(atualizado.lab, coresValidas, deltaELimiar);
              if (conflito) {
                atualizado.status = 'conflito';
                atualizado.deltaE = conflito.deltaE;
                atualizado.corConflitoId = conflito.corId;
                atualizado.corConflitoNome = conflito.corNome;
                atualizado.corConflitoHex = conflito.corHex;
              } else {
                atualizado.status = 'normal';
                atualizado.deltaE = undefined;
                atualizado.corConflitoId = undefined;
                atualizado.corConflitoNome = undefined;
                atualizado.corConflitoHex = undefined;
              }
            }
          }
          
          return atualizado;
        }
        return item;
      })
    );
  }, [cores, deltaELimiar]);

  /**
   * Limpa toda a lista de capturas
   */
  const limparLista = useCallback(() => {
    setCapturas([]);
  }, []);

  /**
   * Envia todas as cores da lista para o Firebase
   * Fluxo atualizado:
   * 1. Verifica se já existe uma cor similar (por LAB)
   * 2. Baseado na ação escolhida pelo usuário:
   *    - usar_existente: usa a cor existente e cria apenas o vínculo
   *    - criar_nova: cria uma nova cor mesmo sendo similar
   * 3. Cria o vínculo cor-tecido (CorTecido) - se ainda não existir
   */
  const enviarCores = useCallback(async (
    acoesConflito?: Map<string, AcaoConflito>
  ): Promise<{ sucesso: number; falhas: number }> => {
    if (capturas.length === 0) {
      return { sucesso: 0, falhas: 0 };
    }

    let sucesso = 0;
    let falhas = 0;

    // Processar cada captura
    for (const captura of capturas) {
      try {
        // Converter LAB → RGB (sem ajustes intermediários)
        const rgb = labToRgb(captura.lab);
        
        // Converter RGB → HEX
        const hex = rgbToHex(rgb);

        let cor: Cor | null = null;

        // Verificar ação escolhida para conflitos
        const acaoConflito = acoesConflito?.get(captura.id);

        console.log(`[Captura ${captura.nome}] Status: ${captura.status}, Ação: ${acaoConflito}, CorConflitoId: ${captura.corConflitoId}`);

        // Se tem conflito e a ação é usar a cor existente
        if (captura.status === 'conflito' && captura.corConflitoId && acaoConflito === 'usar_existente') {
          // Buscar cor diretamente do Firebase para garantir dados atualizados
          cor = await getCorById(captura.corConflitoId);
          
          if (!cor) {
            // Fallback: tentar no array local
            cor = cores.find(c => c.id === captura.corConflitoId) || null;
          }
          
          console.log(`[Captura ${captura.nome}] Usando cor existente:`, cor?.id, cor?.nome);
          
          // Se encontrou a cor existente, NÃO criar nova - ir direto para criar vínculo
          if (cor) {
            // Pula a criação de nova cor
          }
        }
        
        // Se a ação é criar nova OU não tem conflito E ainda não tem cor, criar nova cor
        if (!cor && (acaoConflito === 'criar_nova' || captura.status !== 'conflito')) {
          // Criar nova cor (sem vínculo com tecido)
          const corData: CreateCorData = {
            nome: captura.nome || 'Cor capturada',
            codigoHex: hex,
            lab: captura.lab, // LAB compensado
            labOriginal: captura.labOriginal, // LAB original
            rgb: rgb,
          };

          // createCor retorna void, então precisamos buscar a cor criada
          await createCor(corData);
          
          // Buscar a cor que acabamos de criar (mais recente com esse nome)
          // Como não temos acesso direto ao ID, usar findSimilar com deltaE muito baixo
          cor = await findSimilar(captura.lab, 0.5);
          
          console.log(`[Captura ${captura.nome}] Nova cor criada:`, cor?.id, cor?.nome);
        }

        // Se ainda não encontrou/criou a cor, falha
        if (!cor) {
          throw new Error('Não foi possível criar ou encontrar a cor');
        }

        // Verificar se já existe vínculo cor-tecido
        const vinculoJaExiste = await vinculoExists(cor.id, captura.tecidoId);

        if (!vinculoJaExiste) {
          // Criar vínculo cor-tecido
          const vinculoData: CreateCorTecidoData = {
            corId: cor.id,
            corNome: cor.nome,
            corHex: cor.codigoHex,
            corSku: cor.sku,
            tecidoId: captura.tecidoId,
            tecidoNome: captura.tecidoNome,
            tecidoSku: captura.tecidoSku,
            // imagemTingida será gerada/editada na página de vínculos
          };

          await createVinculo(vinculoData);
        }

        sucesso++;
      } catch (error) {
        console.error(`Erro ao enviar cor "${captura.nome}":`, error);
        falhas++;
        // Continuar processando outras cores mesmo se uma falhar
      }
    }

    // Limpar lista após envio (mesmo que tenha havido falhas)
    if (sucesso > 0) {
      setCapturas([]);
    }

    return { sucesso, falhas };
  }, [capturas, createCor, createVinculo, cores, findSimilar, vinculoExists]);

  // Validar conflitos quando cores ou limiar mudarem
  useEffect(() => {
    if (capturas.length > 0 && cores) {
      validarConflitos();
    }
  }, [cores, deltaELimiar, validarConflitos, capturas.length]);

  const temConflitos = capturas.some((item) => item.status === 'conflito');

  return {
    capturas,
    adicionarCaptura,
    removerCaptura,
    atualizarCaptura,
    limparLista,
    validarConflitos,
    enviarCores,
    temConflitos,
  };
}
