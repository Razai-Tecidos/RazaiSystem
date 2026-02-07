import { Timestamp } from 'firebase/firestore';
import { LabColor } from './cor.types';
import { ReinhardConfig } from '@/hooks/useReinhardTingimento';

/**
 * Estatísticas calculadas de uma imagem
 */
export interface ImageStats {
  meanLuminance: number;      // Luminância média (0-100)
  stdLuminance: number;       // Desvio padrão de luminância
  meanContrast: number;        // Contraste médio
  minLuminance: number;        // Luminância mínima
  maxLuminance: number;        // Luminância máxima
}

/**
 * Exemplo de treinamento para o modelo ML
 */
export interface TrainingExample {
  id?: string;                 // Document ID (gerado pelo Firestore)
  corId?: string;              // ID da cor (para identificar reedições)
  lab: LabColor;               // Valores LAB da cor original (antes dos ajustes)
  labAjustado?: LabColor;       // Valores LAB após aplicar ajustes (opcional)
  anguloCromaticoOriginal?: number; // Ângulo cromático original (0-360 graus)
  anguloCromaticoAjustado?: number; // Ângulo cromático após ajustes (0-360 graus)
  cromaOriginal?: number;      // Croma original (saturação cromática)
  cromaAjustado?: number;       // Croma após ajustes
  tecidoId?: string;           // ID do tecido (para aprendizado por tecido)
  tecidoNome?: string;         // Nome do tecido (para referência)
  tecidoTipo?: string;         // Tipo do tecido ('liso', 'estampado', etc.)
  tecidoComposicao?: string;   // Composição do tecido
  imagemStats: ImageStats;      // Estatísticas da imagem base
  ajustes: ReinhardConfig;      // Ajustes aplicados pelo usuário
  userId?: string;              // ID do usuário (opcional, para multi-user)
  timestamp: Timestamp;         // Quando foi criado
  feedback?: 'positive' | 'negative'; // Feedback do usuário (opcional)
}

/**
 * Configuração do modelo ML
 */
export interface MLModelConfig {
  inputFeatures: number;        // Número de features de entrada
  hiddenLayers: number[];       // Neurônios por camada oculta
  outputSize: number;           // Número de saídas (5 ajustes)
  learningRate: number;         // Taxa de aprendizado
  epochs: number;               // Épocas de treinamento
  batchSize: number;            // Tamanho do batch
  validationSplit: number;      // Proporção de validação (0-1)
}

/**
 * Estado do modelo ML
 */
export type MLModelStatus = 'idle' | 'loading' | 'training' | 'ready' | 'error';

/**
 * Resultado de uma predição
 */
export interface MLPrediction {
  ajustes: ReinhardConfig;
  confidence?: number;          // Confiança da predição (0-1)
  modelVersion?: string;        // Versão do modelo usado
}

/**
 * Dados normalizados para treinamento
 */
export interface NormalizedTrainingData {
  features: number[][];         // Features normalizadas [L, a, b, tipoEncoded, composicaoEncoded, stats...]
  labels: number[][];           // Labels normalizados [saturationMultiplier, contrastBoost, ...]
  featureRanges: FeatureRanges; // Ranges originais para desnormalização
  labelRanges: LabelRanges;     // Ranges originais para desnormalização
}

/**
 * Ranges das features para normalização
 */
export interface FeatureRanges {
  L: { min: number; max: number };
  a: { min: number; max: number };
  b: { min: number; max: number };
  anguloCromatico?: { min: number; max: number };
  croma?: { min: number; max: number };
  meanLuminance: { min: number; max: number };
  stdLuminance: { min: number; max: number };
  meanContrast: { min: number; max: number };
}

/**
 * Ranges dos labels (ajustes) para normalização
 */
export interface LabelRanges {
  saturationMultiplier: { min: number; max: number };
  contrastBoost: { min: number; max: number };
  detailAmount: { min: number; max: number };
  darkenAmount: { min: number; max: number };
  shadowDesaturation: { min: number; max: number };
  hueShift?: { min: number; max: number };
}
