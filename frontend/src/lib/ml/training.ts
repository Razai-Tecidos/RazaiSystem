import * as tf from '@tensorflow/tfjs';
import { TrainingExample, NormalizedTrainingData, FeatureRanges, LabelRanges } from '@/types/ml.types';
import { getTrainingExamples } from '@/lib/firebase/ml-training';

/**
 * Calcula ranges das features para normalização
 */
function calculateFeatureRanges(examples: TrainingExample[]): FeatureRanges {
  const LValues = examples.map(e => e.lab.L);
  const aValues = examples.map(e => e.lab.a);
  const bValues = examples.map(e => e.lab.b);
  const anguloValues = examples
    .map(e => e.anguloCromaticoOriginal)
    .filter((v): v is number => v !== undefined);
  const cromaValues = examples
    .map(e => e.cromaOriginal)
    .filter((v): v is number => v !== undefined);
  const meanLuminanceValues = examples.map(e => e.imagemStats.meanLuminance);
  const stdLuminanceValues = examples.map(e => e.imagemStats.stdLuminance);
  const meanContrastValues = examples.map(e => e.imagemStats.meanContrast);
  
  const result: FeatureRanges = {
    L: { min: Math.min(...LValues), max: Math.max(...LValues) },
    a: { min: Math.min(...aValues), max: Math.max(...aValues) },
    b: { min: Math.min(...bValues), max: Math.max(...bValues) },
    meanLuminance: { min: Math.min(...meanLuminanceValues), max: Math.max(...meanLuminanceValues) },
    stdLuminance: { min: Math.min(...stdLuminanceValues), max: Math.max(...stdLuminanceValues) },
    meanContrast: { min: Math.min(...meanContrastValues), max: Math.max(...meanContrastValues) },
  };
  
  if (anguloValues.length > 0) {
    result.anguloCromatico = { min: Math.min(...anguloValues), max: Math.max(...anguloValues) };
  }
  
  if (cromaValues.length > 0) {
    result.croma = { min: Math.min(...cromaValues), max: Math.max(...cromaValues) };
  }
  
  return result;
}

/**
 * Calcula ranges dos labels para normalização
 */
function calculateLabelRanges(examples: TrainingExample[]): LabelRanges {
  const saturationValues = examples.map(e => e.ajustes.saturationMultiplier || 0.85);
  const contrastValues = examples.map(e => e.ajustes.contrastBoost || 0.15);
  const detailValues = examples.map(e => e.ajustes.detailAmount || 1.15);
  const darkenValues = examples.map(e => e.ajustes.darkenAmount || 5);
  const shadowValues = examples.map(e => e.ajustes.shadowDesaturation || 0.6);
  const hueValues = examples
    .map(e => e.ajustes.hueShift || 0)
    .filter(v => v !== 0); // Apenas valores não-zero
  
  const result: LabelRanges = {
    saturationMultiplier: { min: Math.min(...saturationValues), max: Math.max(...saturationValues) },
    contrastBoost: { min: Math.min(...contrastValues), max: Math.max(...contrastValues) },
    detailAmount: { min: Math.min(...detailValues), max: Math.max(...detailValues) },
    darkenAmount: { min: Math.min(...darkenValues), max: Math.max(...darkenValues) },
    shadowDesaturation: { min: Math.min(...shadowValues), max: Math.max(...shadowValues) },
  };
  
  // Sempre definir range de hueShift, mesmo se não houver exemplos
  // Isso evita problemas de normalização e limita valores extremos
  if (hueValues.length > 0) {
    // Usar range dos valores reais, mas limitar a ±60 graus para evitar valores extremos
    const minHue = Math.max(-60, Math.min(...hueValues));
    const maxHue = Math.min(60, Math.max(...hueValues));
    result.hueShift = { min: minHue, max: maxHue };
  } else {
    // Se não há exemplos com hueShift, usar range conservador (±30 graus)
    result.hueShift = { min: -30, max: 30 };
  }
  
  return result;
}

/**
 * Características de absorção/reflexão de cor por tipo de tecido
 * Valores representam:
 * - brilho: 0 (fosco) a 1 (muito brilhante)
 * - absorcao: 0 (cores vibrantes) a 1 (cores apagadas)
 * - textura: 0 (liso) a 1 (muito texturizado)
 */
const TECIDO_CARACTERISTICAS: Record<string, { brilho: number; absorcao: number; textura: number }> = {
  // Tecidos brilhantes - cores mais vibrantes
  'cetim': { brilho: 0.95, absorcao: 0.1, textura: 0.1 },
  'seda': { brilho: 0.85, absorcao: 0.15, textura: 0.15 },
  'charmeuse': { brilho: 0.9, absorcao: 0.1, textura: 0.1 },
  'tafetá': { brilho: 0.8, absorcao: 0.2, textura: 0.2 },
  'organza': { brilho: 0.75, absorcao: 0.2, textura: 0.1 },
  
  // Tecidos médios
  'oxford': { brilho: 0.4, absorcao: 0.4, textura: 0.5 },
  'tricoline': { brilho: 0.35, absorcao: 0.45, textura: 0.3 },
  'popeline': { brilho: 0.45, absorcao: 0.4, textura: 0.25 },
  'viscose': { brilho: 0.5, absorcao: 0.35, textura: 0.3 },
  'malha': { brilho: 0.3, absorcao: 0.5, textura: 0.4 },
  'jersey': { brilho: 0.35, absorcao: 0.45, textura: 0.35 },
  'algodão': { brilho: 0.3, absorcao: 0.5, textura: 0.4 },
  'cotton': { brilho: 0.3, absorcao: 0.5, textura: 0.4 },
  
  // Tecidos foscos - cores mais apagadas
  'linho': { brilho: 0.2, absorcao: 0.7, textura: 0.7 },
  'linho misto': { brilho: 0.25, absorcao: 0.65, textura: 0.6 },
  'crepe': { brilho: 0.25, absorcao: 0.6, textura: 0.5 },
  'cambraia': { brilho: 0.3, absorcao: 0.55, textura: 0.45 },
  'flanela': { brilho: 0.15, absorcao: 0.75, textura: 0.8 },
  'veludo': { brilho: 0.2, absorcao: 0.7, textura: 0.85 },
  'suede': { brilho: 0.1, absorcao: 0.8, textura: 0.9 },
  
  // Tecidos sintéticos
  'poliéster': { brilho: 0.5, absorcao: 0.35, textura: 0.3 },
  'poliester': { brilho: 0.5, absorcao: 0.35, textura: 0.3 },
  'nylon': { brilho: 0.6, absorcao: 0.3, textura: 0.2 },
  'microfibra': { brilho: 0.45, absorcao: 0.4, textura: 0.35 },
  
  // Tecidos pesados
  'jeans': { brilho: 0.2, absorcao: 0.65, textura: 0.7 },
  'denim': { brilho: 0.2, absorcao: 0.65, textura: 0.7 },
  'sarja': { brilho: 0.3, absorcao: 0.55, textura: 0.6 },
  'brim': { brilho: 0.25, absorcao: 0.6, textura: 0.65 },
  'gabardine': { brilho: 0.35, absorcao: 0.5, textura: 0.55 },
};

/**
 * Encontra características do tecido pelo nome (busca parcial)
 */
function getTecidoCaracteristicas(tecidoNome: string | undefined): { brilho: number; absorcao: number; textura: number } {
  if (!tecidoNome) {
    return { brilho: 0.4, absorcao: 0.45, textura: 0.4 }; // Valores médios padrão
  }
  
  const nomeLower = tecidoNome.toLowerCase();
  
  // Busca exata primeiro
  if (TECIDO_CARACTERISTICAS[nomeLower]) {
    return TECIDO_CARACTERISTICAS[nomeLower];
  }
  
  // Busca parcial - verifica se o nome contém alguma palavra-chave
  for (const [key, value] of Object.entries(TECIDO_CARACTERISTICAS)) {
    if (nomeLower.includes(key) || key.includes(nomeLower)) {
      return value;
    }
  }
  
  // Fallback: valores médios
  return { brilho: 0.4, absorcao: 0.45, textura: 0.4 };
}

/**
 * Codifica tecido para features numéricas (4 valores: brilho, absorção, textura, hash)
 */
function encodeTecido(tecidoNome?: string, tecidoId?: string): number[] {
  const caracteristicas = getTecidoCaracteristicas(tecidoNome);
  
  // Se temos um ID de tecido, adicionar um hash único para diferenciar tecidos específicos
  let tecidoHash = 0.5; // Valor neutro
  if (tecidoId) {
    let hash = 0;
    for (let i = 0; i < tecidoId.length; i++) {
      hash = ((hash << 5) - hash) + tecidoId.charCodeAt(i);
      hash = hash & hash;
    }
    tecidoHash = (Math.abs(hash) % 100) / 100;
  }
  
  return [
    caracteristicas.brilho,
    caracteristicas.absorcao,
    caracteristicas.textura,
    tecidoHash, // Hash único do tecido para aprendizado específico
  ];
}

/**
 * Codifica tipo de tecido para número (mantido para compatibilidade)
 */
function encodeTecidoTipo(tipo: string | undefined): number {
  const tipos: Record<string, number> = {
    'liso': 0,
    'estampado': 1,
  };
  return tipos[tipo || 'liso'] || 0;
}

/**
 * Codifica composição do tecido (hash simples para número)
 */
function encodeComposicao(composicao: string | undefined): number {
  if (!composicao) return 0;
  let hash = 0;
  for (let i = 0; i < composicao.length; i++) {
    hash = ((hash << 5) - hash) + composicao.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash) % 100 / 100;
}

/**
 * Normaliza um valor para o range 0-1
 */
function normalize(value: number, min: number, max: number): number {
  if (max === min) return 0.5;
  return (value - min) / (max - min);
}

/**
 * Prepara dados de treinamento normalizados
 * Nova estrutura com 14 features incluindo características detalhadas do tecido
 */
export function prepareTrainingData(examples: TrainingExample[]): NormalizedTrainingData {
  if (examples.length === 0) {
    throw new Error('Nenhum exemplo de treinamento disponível');
  }
  
  const featureRanges = calculateFeatureRanges(examples);
  const labelRanges = calculateLabelRanges(examples);
  
  const features: number[][] = [];
  const labels: number[][] = [];
  
  for (const example of examples) {
    // Features: [L, a, b, anguloCromatico, croma, brilhoTecido, absorcaoTecido, texturaTecido, tecidoHash, tipoEncoded, composicaoEncoded, meanLuminance, stdLuminance, meanContrast]
    const featureArray: number[] = [
      normalize(example.lab.L, featureRanges.L.min, featureRanges.L.max),
      normalize(example.lab.a, featureRanges.a.min, featureRanges.a.max),
      normalize(example.lab.b, featureRanges.b.min, featureRanges.b.max),
    ];
    
    // Adicionar informações do círculo cromático se disponíveis
    if (example.anguloCromaticoOriginal !== undefined && featureRanges.anguloCromatico) {
      featureArray.push(normalize(example.anguloCromaticoOriginal, featureRanges.anguloCromatico.min, featureRanges.anguloCromatico.max));
    } else {
      // Calcular se não disponível
      const angulo = Math.atan2(example.lab.b, example.lab.a) * (180 / Math.PI);
      const anguloNormalized = angulo < 0 ? (angulo + 360) / 360 : angulo / 360;
      featureArray.push(anguloNormalized);
    }
    
    if (example.cromaOriginal !== undefined && featureRanges.croma) {
      featureArray.push(normalize(example.cromaOriginal, featureRanges.croma.min, featureRanges.croma.max));
    } else {
      // Calcular se não disponível
      const croma = Math.sqrt(example.lab.a * example.lab.a + example.lab.b * example.lab.b);
      featureArray.push(Math.min(1, croma / 180)); // Normalizar aproximadamente
    }
    
    // Adicionar características do tecido (4 valores: brilho, absorção, textura, hash)
    const tecidoFeatures = encodeTecido(example.tecidoNome, example.tecidoId);
    featureArray.push(...tecidoFeatures);
    
    featureArray.push(
      encodeTecidoTipo(example.tecidoTipo),
      encodeComposicao(example.tecidoComposicao),
      normalize(example.imagemStats.meanLuminance, featureRanges.meanLuminance.min, featureRanges.meanLuminance.max),
      normalize(example.imagemStats.stdLuminance, featureRanges.stdLuminance.min, featureRanges.stdLuminance.max),
      normalize(example.imagemStats.meanContrast, featureRanges.meanContrast.min, featureRanges.meanContrast.max),
    );
    
    features.push(featureArray);
    
    // Labels: [saturationMultiplier, contrastBoost, detailAmount, darkenAmount, shadowDesaturation, hueShift]
    const labelArray: number[] = [
      normalize(example.ajustes.saturationMultiplier || 0.85, labelRanges.saturationMultiplier.min, labelRanges.saturationMultiplier.max),
      normalize(example.ajustes.contrastBoost || 0.15, labelRanges.contrastBoost.min, labelRanges.contrastBoost.max),
      normalize(example.ajustes.detailAmount || 1.15, labelRanges.detailAmount.min, labelRanges.detailAmount.max),
      normalize(example.ajustes.darkenAmount || 5, labelRanges.darkenAmount.min, labelRanges.darkenAmount.max),
      normalize(example.ajustes.shadowDesaturation || 0.6, labelRanges.shadowDesaturation.min, labelRanges.shadowDesaturation.max),
    ];
    
    // Adicionar hueShift se disponível
    if (example.ajustes.hueShift !== undefined && labelRanges.hueShift) {
      labelArray.push(normalize(example.ajustes.hueShift, labelRanges.hueShift.min, labelRanges.hueShift.max));
    } else {
      labelArray.push(0.5); // Valor neutro (0 graus normalizado)
    }
    
    labels.push(labelArray);
  }
  
  return {
    features,
    labels,
    featureRanges,
    labelRanges,
  };
}

/**
 * Treina modelo com dados do Firestore
 */
export async function trainModel(
  model: tf.Sequential,
  config: { epochs?: number; batchSize?: number; validationSplit?: number } = {}
): Promise<tf.History> {
  // Buscar exemplos de treinamento
  const examples = await getTrainingExamples(1000);
  
  if (examples.length < 10) {
    throw new Error(`Poucos exemplos de treinamento (${examples.length}). Mínimo: 10`);
  }
  
  // Preparar dados
  const trainingData = prepareTrainingData(examples);
  
  // Criar tensores
  const xs = tf.tensor2d(trainingData.features);
  const ys = tf.tensor2d(trainingData.labels);
  
  try {
    // Treinar modelo
    const history = await model.fit(xs, ys, {
      epochs: config.epochs || 100,
      batchSize: config.batchSize || 32,
      validationSplit: config.validationSplit || 0.2,
      shuffle: true,
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          const mae = logs?.mae ? `, mae=${logs.mae.toFixed(4)}` : '';
          const valMae = logs?.val_mae ? `, val_mae=${logs.val_mae.toFixed(4)}` : '';
          console.log(`Época ${epoch + 1}: loss=${logs?.loss?.toFixed(4)}, val_loss=${logs?.val_loss?.toFixed(4)}${mae}${valMae}`);
        },
      },
    });
    
    return history;
  } finally {
    // Limpar tensores
    xs.dispose();
    ys.dispose();
  }
}

/**
 * Verifica se há novos exemplos desde última vez
 */
export async function shouldRetrain(
  lastTrainingDate: Date | null,
  minNewExamples: number = 10
): Promise<boolean> {
  if (!lastTrainingDate) {
    // Primeira vez treinando
    const count = await getTrainingExamples(1).then(examples => examples.length);
    return count >= minNewExamples;
  }
  
  // Verificar se passou pelo menos 1 dia desde último treinamento
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  if (lastTrainingDate > oneDayAgo) {
    return false; // Muito recente
  }
  
  // Verificar se há novos exemplos suficientes
  const examples = await getTrainingExamples(1000);
  const newExamples = examples.filter(e => {
    const exampleDate = e.timestamp.toDate();
    return exampleDate > lastTrainingDate;
  });
  
  return newExamples.length >= minNewExamples;
}
