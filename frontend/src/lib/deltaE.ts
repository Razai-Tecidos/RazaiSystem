import { LabColor, Cor } from '@/types/cor.types';
import { CorConflito } from '@/types/captura.types';
import { hexToRgb, rgbToLab } from './colorUtils';

/**
 * Limiar global de Delta E para validação de conflitos de cores
 * 
 * Valores de referência:
 * - < 1: Diferença imperceptível ao olho humano
 * - 1-3: Diferença perceptível apenas para observadores experientes
 * - 3-6: Diferença perceptível para a maioria das pessoas
 * - > 6: Diferença claramente perceptível
 * 
 * O limiar de 3 é usado como padrão para detectar cores muito próximas
 * que podem causar confusão ou serem consideradas duplicatas.
 */
export const DELTA_E_LIMIAR_CONFLITO = 3;

/**
 * Implementação da fórmula Delta E 2000 (CIE DE2000)
 * Esta é a fórmula mais recente e precisa para diferença de cores perceptuais
 * 
 * Referência: Sharma, G., Wu, W., & Dalal, E. N. (2005). 
 * The CIEDE2000 color-difference formula: Implementation notes, 
 * supplementary test data, and mathematical observations.
 */
export function deltaE2000(lab1: LabColor, lab2: LabColor): number {
  const { L: L1, a: a1, b: b1 } = lab1;
  const { L: L2, a: a2, b: b2 } = lab2;

  // Passo 1: Calcular C' e h'
  const C1 = Math.sqrt(a1 * a1 + b1 * b1);
  const C2 = Math.sqrt(a2 * a2 + b2 * b2);
  const C_avg = (C1 + C2) / 2;

  const G = 0.5 * (1 - Math.sqrt(Math.pow(C_avg, 7) / (Math.pow(C_avg, 7) + Math.pow(25, 7))));

  const a1_prime = (1 + G) * a1;
  const a2_prime = (1 + G) * a2;

  const C1_prime = Math.sqrt(a1_prime * a1_prime + b1 * b1);
  const C2_prime = Math.sqrt(a2_prime * a2_prime + b2 * b2);

  let h1_prime = Math.atan2(b1, a1_prime) * (180 / Math.PI);
  let h2_prime = Math.atan2(b2, a2_prime) * (180 / Math.PI);

  // Normalizar h' para 0-360
  if (h1_prime < 0) h1_prime += 360;
  if (h2_prime < 0) h2_prime += 360;

  const deltaL_prime = L2 - L1;
  const deltaC_prime = C2_prime - C1_prime;

  let deltaH_prime;
  if (C1_prime * C2_prime === 0) {
    deltaH_prime = 0;
  } else if (Math.abs(h2_prime - h1_prime) <= 180) {
    deltaH_prime = h2_prime - h1_prime;
  } else if (h2_prime - h1_prime > 180) {
    deltaH_prime = h2_prime - h1_prime - 360;
  } else {
    deltaH_prime = h2_prime - h1_prime + 360;
  }

  const deltaH_prime_rad = deltaH_prime * (Math.PI / 180);
  const deltaH_prime_value = 2 * Math.sqrt(C1_prime * C2_prime) * Math.sin(deltaH_prime_rad / 2);

  // Passo 2: Calcular L', C', h' médios
  const L_prime_avg = (L1 + L2) / 2;
  const C_prime_avg = (C1_prime + C2_prime) / 2;

  let h_prime_avg;
  if (C1_prime * C2_prime === 0) {
    h_prime_avg = h1_prime + h2_prime;
  } else if (Math.abs(h1_prime - h2_prime) <= 180) {
    h_prime_avg = (h1_prime + h2_prime) / 2;
  } else if (Math.abs(h1_prime - h2_prime) > 180 && h1_prime + h2_prime < 360) {
    h_prime_avg = (h1_prime + h2_prime + 360) / 2;
  } else {
    h_prime_avg = (h1_prime + h2_prime - 360) / 2;
  }

  // Passo 3: Calcular T
  const T =
    1 -
    0.17 * Math.cos((h_prime_avg - 30) * (Math.PI / 180)) +
    0.24 * Math.cos(2 * h_prime_avg * (Math.PI / 180)) +
    0.32 * Math.cos((3 * h_prime_avg + 6) * (Math.PI / 180)) -
    0.2 * Math.cos((4 * h_prime_avg - 63) * (Math.PI / 180));

  // Passo 4: Calcular deltaTheta
  const deltaTheta =
    30 *
    Math.exp(
      -Math.pow((h_prime_avg - 275) / 25, 2)
    );

  // Passo 5: Calcular R_C
  const R_C =
    2 *
    Math.sqrt(
      Math.pow(C_prime_avg, 7) / (Math.pow(C_prime_avg, 7) + Math.pow(25, 7))
    );

  // Passo 6: Calcular R_T
  const R_T = -Math.sin(2 * deltaTheta * (Math.PI / 180)) * R_C;

  // Passo 7: Calcular k_L, k_C, k_H (fatores de ponderação - valores padrão)
  const k_L = 1;
  const k_C = 1;
  const k_H = 1;

  // Passo 8: Calcular S_L, S_C, S_H
  const S_L =
    1 +
    (0.015 * Math.pow(L_prime_avg - 50, 2)) /
      Math.sqrt(20 + Math.pow(L_prime_avg - 50, 2));

  const S_C = 1 + 0.045 * C_prime_avg;

  const S_H = 1 + 0.015 * C_prime_avg * T;

  // Passo 9: Calcular R_T
  // (já calculado no passo 6)

  // Passo 10: Calcular Delta E 2000
  const deltaE =
    Math.sqrt(
      Math.pow(deltaL_prime / (k_L * S_L), 2) +
        Math.pow(deltaC_prime / (k_C * S_C), 2) +
        Math.pow(deltaH_prime_value / (k_H * S_H), 2) +
        R_T * (deltaC_prime / (k_C * S_C)) * (deltaH_prime_value / (k_H * S_H))
    );

  return deltaE;
}

/**
 * Converte código hexadecimal para valores LAB
 * Útil para comparar cores cadastradas (que têm apenas hex) com cores capturadas (que têm LAB)
 */
export function hexToLab(hex: string): LabColor | null {
  if (!hex || !hex.startsWith('#')) {
    return null;
  }

  try {
    const rgb = hexToRgb(hex);
    if (!rgb) return null;
    
    return rgbToLab(rgb);
  } catch (error) {
    console.error('Erro ao converter hex para LAB:', error);
    return null;
  }
}

/**
 * Encontra conflitos de cor comparando uma cor capturada com todas as cores existentes
 * Retorna o conflito mais próximo se deltaE < limiar
 * 
 * @param corCapturada - Cor capturada em LAB
 * @param coresExistentes - Lista de cores cadastradas no sistema
 * @param limiar - Limiar de deltaE (padrão: DELTA_E_LIMIAR_CONFLITO)
 * @returns Conflito encontrado ou null
 */
export function encontrarConflitos(
  corCapturada: LabColor,
  coresExistentes: Cor[],
  limiar: number = DELTA_E_LIMIAR_CONFLITO
): CorConflito | null {
  if (!coresExistentes || coresExistentes.length === 0) {
    return null;
  }

  let menorDeltaE = Infinity;
  let corConflito: CorConflito | null = null;

  for (const cor of coresExistentes) {
    if (!cor.codigoHex) continue;

    // Converter hex para LAB
    const labExistente = hexToLab(cor.codigoHex);
    if (!labExistente) continue;

    // Calcular deltaE
    const deltaE = deltaE2000(corCapturada, labExistente);

    // Se deltaE < limiar e for o menor encontrado até agora
    if (deltaE < limiar && deltaE < menorDeltaE) {
      menorDeltaE = deltaE;
      corConflito = {
        corId: cor.id,
        corNome: cor.nome,
        corHex: cor.codigoHex,
        deltaE: deltaE,
      };
    }
  }

  return corConflito;
}

/**
 * Valida se uma cor tem conflito com cores existentes
 * Retorna true se deltaE < limiar para alguma cor
 * 
 * @param corCapturada - Cor capturada em LAB
 * @param coresExistentes - Lista de cores cadastradas no sistema
 * @param limiar - Limiar de deltaE (padrão: DELTA_E_LIMIAR_CONFLITO)
 * @returns true se houver conflito, false caso contrário
 */
export function temConflito(
  corCapturada: LabColor,
  coresExistentes: Cor[],
  limiar: number = DELTA_E_LIMIAR_CONFLITO
): boolean {
  return encontrarConflitos(corCapturada, coresExistentes, limiar) !== null;
}

/**
 * Interface para representar um par de cores em conflito
 */
export interface ParConflito {
  cor1: {
    id: string;
    nome: string;
    hex: string;
    lab: LabColor;
  };
  cor2: {
    id: string;
    nome: string;
    hex: string;
    lab: LabColor;
  };
  deltaE: number;
}

/**
 * Encontra todos os pares de cores que estão em conflito (deltaE < limiar)
 * Compara todas as cores entre si e retorna os pares que conflitam
 * 
 * @param cores - Lista de todas as cores cadastradas
 * @param limiar - Limiar de deltaE (padrão: DELTA_E_LIMIAR_CONFLITO)
 * @returns Lista de pares em conflito, ordenados por deltaE (menor primeiro)
 */
export function encontrarTodosConflitos(
  cores: Cor[],
  limiar: number = DELTA_E_LIMIAR_CONFLITO
): ParConflito[] {
  const conflitos: ParConflito[] = [];
  
  if (!cores || cores.length < 2) {
    return conflitos;
  }

  // Pré-calcular LAB para todas as cores que têm hex ou lab
  const coresComLab: Array<{ cor: Cor; lab: LabColor }> = [];
  
  for (const cor of cores) {
    let lab: LabColor | null = null;
    
    // Usar LAB diretamente se disponível, senão converter do hex
    if (cor.lab) {
      lab = cor.lab;
    } else if (cor.codigoHex) {
      lab = hexToLab(cor.codigoHex);
    }
    
    if (lab) {
      coresComLab.push({ cor, lab });
    }
  }

  // Comparar todas as cores entre si (sem duplicar pares)
  for (let i = 0; i < coresComLab.length; i++) {
    for (let j = i + 1; j < coresComLab.length; j++) {
      const { cor: cor1, lab: lab1 } = coresComLab[i];
      const { cor: cor2, lab: lab2 } = coresComLab[j];
      
      const deltaE = deltaE2000(lab1, lab2);
      
      if (deltaE < limiar) {
        conflitos.push({
          cor1: {
            id: cor1.id,
            nome: cor1.nome,
            hex: cor1.codigoHex || '',
            lab: lab1,
          },
          cor2: {
            id: cor2.id,
            nome: cor2.nome,
            hex: cor2.codigoHex || '',
            lab: lab2,
          },
          deltaE,
        });
      }
    }
  }

  // Ordenar por deltaE (menor primeiro = mais similar)
  return conflitos.sort((a, b) => a.deltaE - b.deltaE);
}

/**
 * Cria um mapa de conflitos por ID de cor
 * Útil para saber rapidamente quais cores conflitam com uma cor específica
 * 
 * @param conflitos - Lista de pares em conflito
 * @returns Mapa de ID da cor -> lista de conflitos
 */
export function criarMapaConflitos(
  conflitos: ParConflito[]
): Map<string, Array<{ corId: string; corNome: string; deltaE: number }>> {
  const mapa = new Map<string, Array<{ corId: string; corNome: string; deltaE: number }>>();
  
  for (const conflito of conflitos) {
    // Adicionar conflito para cor1
    if (!mapa.has(conflito.cor1.id)) {
      mapa.set(conflito.cor1.id, []);
    }
    mapa.get(conflito.cor1.id)!.push({
      corId: conflito.cor2.id,
      corNome: conflito.cor2.nome,
      deltaE: conflito.deltaE,
    });
    
    // Adicionar conflito para cor2
    if (!mapa.has(conflito.cor2.id)) {
      mapa.set(conflito.cor2.id, []);
    }
    mapa.get(conflito.cor2.id)!.push({
      corId: conflito.cor1.id,
      corNome: conflito.cor1.nome,
      deltaE: conflito.deltaE,
    });
  }
  
  return mapa;
}
