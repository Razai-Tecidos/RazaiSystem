import { useState, useCallback, useEffect } from 'react';
import { Timestamp } from 'firebase/firestore';
import { CapturaItem, CreateCapturaData } from '@/types/captura.types';
import { encontrarConflitos, DELTA_E_LIMIAR_CONFLITO } from '@/lib/deltaE';
import { aplicarAjustesERGB, rgbToHex } from '@/lib/colorUtils';
import { useCores } from './useCores';
import { CreateCorData } from '@/types/cor.types';

interface UseCapturaListaReturn {
  capturas: CapturaItem[];
  adicionarCaptura: (data: CreateCapturaData) => void;
  removerCaptura: (id: string) => void;
  atualizarCaptura: (id: string, updates: Partial<CapturaItem>) => void;
  limparLista: () => void;
  validarConflitos: () => void;
  enviarCores: () => Promise<{ sucesso: number; falhas: number }>;
  temConflitos: boolean;
}

/**
 * Hook para gerenciar lista de capturas de cores
 * Gerencia estado local e valida conflitos com cores existentes
 */
export function useCapturaLista(): UseCapturaListaReturn {
  const [capturas, setCapturas] = useState<CapturaItem[]>([]);
  const { cores, createCor } = useCores();

  /**
   * Valida conflitos de todas as capturas com cores existentes
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
        const conflito = encontrarConflitos(item.lab, coresValidas, DELTA_E_LIMIAR_CONFLITO);

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
  }, [cores]);

  /**
   * Adiciona uma nova captura à lista
   */
  const adicionarCaptura = useCallback(
    (data: CreateCapturaData) => {
      const novaCaptura: CapturaItem = {
        id: `captura-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        lab: data.lab,
        hex: data.hex,
        nome: data.nome,
        tecidoId: data.tecidoId,
        tecidoNome: data.tecidoNome,
        tecidoImagemPadrao: data.tecidoImagemPadrao,
        tecidoSku: data.tecidoSku,
        ajustes: data.ajustes,
        status: 'normal',
        createdAt: Timestamp.now(),
      };

      setCapturas((prev) => {
        const novasCapturas = [...prev, novaCaptura];
        
        // Validar conflitos após adicionar
        if (cores && cores.length > 0) {
          const coresValidas = cores.filter((cor) => cor.codigoHex && cor.codigoHex.startsWith('#'));
          if (coresValidas.length > 0) {
            const conflito = encontrarConflitos(novaCaptura.lab, coresValidas, DELTA_E_LIMIAR_CONFLITO);
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
    [cores]
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
          
          // Se atualizou LAB ou cores foram atualizadas, revalidar conflitos
          if (updates.lab && cores && cores.length > 0) {
            const coresValidas = cores.filter((cor) => cor.codigoHex && cor.codigoHex.startsWith('#'));
            if (coresValidas.length > 0) {
              const conflito = encontrarConflitos(atualizado.lab, coresValidas, DELTA_E_LIMIAR_CONFLITO);
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
  }, [cores]);

  /**
   * Limpa toda a lista de capturas
   */
  const limparLista = useCallback(() => {
    setCapturas([]);
  }, []);

  /**
   * Envia todas as cores da lista para o Firebase
   * Converte cada captura, aplica ajustes e salva como cor
   */
  const enviarCores = useCallback(async (): Promise<{ sucesso: number; falhas: number }> => {
    if (capturas.length === 0) {
      return { sucesso: 0, falhas: 0 };
    }

    let sucesso = 0;
    let falhas = 0;

    // Processar cada captura
    for (const captura of capturas) {
      try {
        // Aplicar ajustes (se houver) e converter LAB → RGB
        const rgb = aplicarAjustesERGB(captura.lab, captura.ajustes);
        
        // Converter RGB → HEX
        const hex = rgbToHex(rgb);

        // Criar dados da cor
        const corData: CreateCorData = {
          nome: captura.nome || '', // Nome pode estar vazio
          codigoHex: hex,
          lab: captura.lab, // LAB original (sem ajustes) para cálculo de deltaE
          rgb: rgb, // RGB com ajustes aplicados
          tecidoId: captura.tecidoId,
          tecidoNome: captura.tecidoNome,
          tecidoSku: captura.tecidoSku,
        };

        // Salvar no Firebase
        await createCor(corData);
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
  }, [capturas, createCor]);

  // Validar conflitos quando cores mudarem
  useEffect(() => {
    if (capturas.length > 0 && cores) {
      validarConflitos();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cores]);

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
