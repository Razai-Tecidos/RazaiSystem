import * as tf from '@tensorflow/tfjs';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { storage, db } from '@/config/firebase';
import { LabColor } from '@/types/cor.types';
import { ReinhardConfig } from '@/hooks/useReinhardTingimento';
import { MLModelConfig, MLPrediction, ImageStats, LabelRanges } from '@/types/ml.types';

const MODEL_STORAGE_KEY = 'reinhard_ml_model_v2';
const MODEL_VERSION = '2.0.0'; // v2: Modelo com características detalhadas de tecido (14 features)
const FIREBASE_MODEL_PATH = 'ml-models/reinhard-v2';
const MODEL_METADATA_DOC = 'ml_model_metadata/reinhard-v2';

/**
 * Configuração padrão do modelo
 * VERSÃO 2: Agora com 14 features incluindo características detalhadas do tecido
 */
const DEFAULT_CONFIG: MLModelConfig = {
  inputFeatures: 14, // [L, a, b, anguloCromatico, croma, brilhoTecido, absorcaoTecido, texturaTecido, tecidoHash, tipoEncoded, composicaoEncoded, meanLuminance, stdLuminance, meanContrast]
  hiddenLayers: [64, 32],
  outputSize: 6, // [saturationMultiplier, contrastBoost, detailAmount, darkenAmount, shadowDesaturation, hueShift]
  learningRate: 0.001,
  epochs: 100,
  batchSize: 32,
  validationSplit: 0.2,
};

/**
 * Cria arquitetura do modelo MLP
 */
export function createModel(config: MLModelConfig = DEFAULT_CONFIG): tf.Sequential {
  const model = tf.sequential();
  
  // Camada de entrada
  model.add(tf.layers.dense({
    inputShape: [config.inputFeatures],
    units: config.hiddenLayers[0],
    activation: 'relu',
    name: 'hidden1',
  }));
  
  // Camadas ocultas
  for (let i = 1; i < config.hiddenLayers.length; i++) {
    model.add(tf.layers.dense({
      units: config.hiddenLayers[i],
      activation: 'relu',
      name: `hidden${i + 1}`,
    }));
  }
  
  // Camada de saída (sem ativação para regressão)
  model.add(tf.layers.dense({
    units: config.outputSize,
    activation: 'linear',
    name: 'output',
  }));
  
  // Função de métrica customizada para Mean Absolute Error (MAE)
  const maeMetric = (yTrue: tf.Tensor, yPred: tf.Tensor): tf.Scalar => {
    return tf.mean(tf.abs(tf.sub(yTrue, yPred)));
  };

  // Compilar modelo
  model.compile({
    optimizer: tf.train.adam(config.learningRate),
    loss: 'meanSquaredError',
    // Métrica customizada para monitorar erro absoluto médio durante treinamento
    // Isso ajuda a entender melhor o desempenho além do MSE
    metrics: [maeMetric],
  });
  
  return model;
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
 * Codifica tecido para features numéricas (3 valores: brilho, absorção, textura)
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
  // Hash simples baseado em caracteres
  let hash = 0;
  for (let i = 0; i < composicao.length; i++) {
    hash = ((hash << 5) - hash) + composicao.charCodeAt(i);
    hash = hash & hash; // Convert to 32bit integer
  }
  // Normalizar para 0-1
  return Math.abs(hash) % 100 / 100;
}

/**
 * Prepara features para predição
 * Nova estrutura com 13 features:
 * [L, a, b, anguloCromatico, croma, brilhoTecido, absorcaoTecido, texturaTecido, tecidoHash, tipoEncoded, composicaoEncoded, meanLuminance, stdLuminance, meanContrast]
 */
function prepareFeatures(
  lab: LabColor,
  tecidoTipo?: string,
  tecidoComposicao?: string,
  imagemStats?: ImageStats,
  tecidoNome?: string,
  tecidoId?: string
): number[] {
  // Calcular ângulo cromático e croma
  const angulo = Math.atan2(lab.b, lab.a) * (180 / Math.PI);
  const anguloNormalized = angulo < 0 ? (angulo + 360) / 360 : angulo / 360;
  const croma = Math.sqrt(lab.a * lab.a + lab.b * lab.b);
  const cromaNormalized = Math.min(1, croma / 180); // Normalizar aproximadamente
  
  // Codificação do tecido (4 valores: brilho, absorção, textura, hash)
  const tecidoFeatures = encodeTecido(tecidoNome, tecidoId);
  
  const features: number[] = [
    lab.L / 100, // Normalizar L (0-100) para 0-1
    (lab.a + 128) / 256, // Normalizar a (-128 a 127) para 0-1
    (lab.b + 128) / 256, // Normalizar b (-128 a 127) para 0-1
    anguloNormalized, // Ângulo cromático normalizado (0-1)
    cromaNormalized, // Croma normalizada (0-1)
    ...tecidoFeatures, // [brilho, absorção, textura, hash do tecido]
    encodeTecidoTipo(tecidoTipo),
    encodeComposicao(tecidoComposicao),
  ];
  
  if (imagemStats) {
    features.push(
      imagemStats.meanLuminance / 100, // Normalizar
      Math.min(imagemStats.stdLuminance / 50, 1), // Normalizar (assumindo max ~50)
      Math.min(imagemStats.meanContrast / 50, 1), // Normalizar (assumindo max ~50)
    );
  } else {
    // Valores padrão se não houver estatísticas
    features.push(0.5, 0.2, 0.2);
  }
  
  return features;
}

/**
 * Desnormaliza ajustes previstos
 */
function denormalizeAdjustments(predicted: number[], labelRanges?: LabelRanges): ReinhardConfig {
  // Ranges padrão dos ajustes (usados se labelRanges não estiver disponível)
  const defaultRanges = {
    saturationMultiplier: { min: 0.5, max: 2.0 },
    contrastBoost: { min: 0, max: 0.5 },
    detailAmount: { min: 0.5, max: 2.0 },
    darkenAmount: { min: 0, max: 30 },
    shadowDesaturation: { min: 0, max: 1 },
    hueShift: { min: -30, max: 30 }, // Range conservador padrão para hueShift
  };
  
  // Usar ranges do treinamento se disponíveis, senão usar padrões
  const ranges = {
    saturationMultiplier: labelRanges?.saturationMultiplier || defaultRanges.saturationMultiplier,
    contrastBoost: labelRanges?.contrastBoost || defaultRanges.contrastBoost,
    detailAmount: labelRanges?.detailAmount || defaultRanges.detailAmount,
    darkenAmount: labelRanges?.darkenAmount || defaultRanges.darkenAmount,
    shadowDesaturation: labelRanges?.shadowDesaturation || defaultRanges.shadowDesaturation,
    hueShift: labelRanges?.hueShift || defaultRanges.hueShift,
  };
  
  // Desnormalizar cada valor (assumindo que foram normalizados para 0-1)
  const denormalize = (value: number, min: number, max: number) => {
    // Clampar valor normalizado entre 0 e 1 antes de desnormalizar
    const clamped = Math.max(0, Math.min(1, value));
    return clamped * (max - min) + min;
  };
  
  // Desnormalizar hueShift com limite adicional para evitar valores extremos
  let hueShift = 0;
  if (predicted.length > 5) {
    hueShift = denormalize(predicted[5], ranges.hueShift.min, ranges.hueShift.max);
    // Limitar hueShift a ±60 graus para evitar transformações muito extremas
    hueShift = Math.max(-60, Math.min(60, hueShift));
  }
  
  return {
    saturationMultiplier: denormalize(predicted[0], ranges.saturationMultiplier.min, ranges.saturationMultiplier.max),
    contrastBoost: denormalize(predicted[1], ranges.contrastBoost.min, ranges.contrastBoost.max),
    detailAmount: denormalize(predicted[2], ranges.detailAmount.min, ranges.detailAmount.max),
    darkenAmount: denormalize(predicted[3], ranges.darkenAmount.min, ranges.darkenAmount.max),
    shadowDesaturation: denormalize(predicted[4], ranges.shadowDesaturation.min, ranges.shadowDesaturation.max),
    hueShift,
  };
}

/**
 * Prediz ajustes para novos valores LAB
 */
export async function predictAdjustments(
  model: tf.LayersModel,
  lab: LabColor,
  tecidoTipo?: string,
  tecidoComposicao?: string,
  imagemStats?: ImageStats,
  tecidoNome?: string,
  tecidoId?: string
): Promise<MLPrediction> {
  const features = prepareFeatures(lab, tecidoTipo, tecidoComposicao, imagemStats, tecidoNome, tecidoId);
  const input = tf.tensor2d([features]);
  
  try {
    const prediction = model.predict(input) as tf.Tensor;
    const values = await prediction.data();
    
    const valuesArray = Array.from(values);
    const ajustes = denormalizeAdjustments(valuesArray);
    
    // Calcular confiança simples (baseado na variância dos valores)
    const mean = valuesArray.reduce((a, b) => a + b, 0) / valuesArray.length;
    const variance = valuesArray.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / valuesArray.length;
    const confidence = Math.max(0, Math.min(1, 1 - variance)); // Menor variância = maior confiança
    
    input.dispose();
    prediction.dispose();
    
    return {
      ajustes,
      confidence,
      modelVersion: MODEL_VERSION,
    };
  } catch (error) {
    input.dispose();
    throw error;
  }
}

/**
 * Metadados do modelo armazenados no Firestore
 */
export interface ModelMetadata {
  version: string;
  trainedAt: string;
  exampleCount: number;
  lastLoss?: number;
}

/**
 * Salva modelo no IndexedDB (cache local)
 */
export async function saveModelLocal(model: tf.LayersModel): Promise<void> {
  try {
    await model.save(`indexeddb://${MODEL_STORAGE_KEY}`);
  } catch (error) {
    console.error('Erro ao salvar modelo localmente:', error);
  }
}

/**
 * Carrega modelo do IndexedDB (cache local)
 */
export async function loadModelLocal(): Promise<tf.LayersModel | null> {
  try {
    const model = await tf.loadLayersModel(`indexeddb://${MODEL_STORAGE_KEY}`);
    return model;
  } catch (error: any) {
    const errorMessage = error?.message || String(error);
    if (errorMessage.includes('Cannot find model') || errorMessage.includes('not found')) {
      return null;
    }
    console.warn('Aviso ao carregar modelo local:', errorMessage);
    return null;
  }
}

/**
 * Salva modelo no Firebase Storage (compartilhado)
 */
export async function saveModelToFirebase(model: tf.LayersModel, exampleCount: number, lastLoss?: number): Promise<void> {
  try {
    // Salvar modelo como arquivos em memória
    await model.save(tf.io.withSaveHandler(async (artifacts) => {
      // Salvar model.json
      const modelJson = JSON.stringify({
        modelTopology: artifacts.modelTopology,
        weightsManifest: [{
          paths: ['weights.bin'],
          weights: artifacts.weightSpecs,
        }],
      });
      
      const modelJsonBlob = new Blob([modelJson], { type: 'application/json' });
      const modelJsonRef = ref(storage, `${FIREBASE_MODEL_PATH}/model.json`);
      await uploadBytes(modelJsonRef, modelJsonBlob);
      
      // Salvar weights.bin
      if (artifacts.weightData) {
        // weightData pode ser ArrayBuffer ou ArrayBuffer[] - precisamos converter
        const weightDataArray = Array.isArray(artifacts.weightData) 
          ? artifacts.weightData 
          : [artifacts.weightData];
        const totalLength = weightDataArray.reduce((acc, buf) => acc + buf.byteLength, 0);
        const mergedArray = new Uint8Array(totalLength);
        let offset = 0;
        for (const buf of weightDataArray) {
          mergedArray.set(new Uint8Array(buf), offset);
          offset += buf.byteLength;
        }
        const weightsBlob = new Blob([mergedArray], { type: 'application/octet-stream' });
        const weightsRef = ref(storage, `${FIREBASE_MODEL_PATH}/weights.bin`);
        await uploadBytes(weightsRef, weightsBlob);
      }
      
      return { modelArtifactsInfo: { dateSaved: new Date(), modelTopologyType: 'JSON' } };
    }));
    
    // Salvar metadados no Firestore
    const metadata: ModelMetadata = {
      version: MODEL_VERSION,
      trainedAt: new Date().toISOString(),
      exampleCount,
      lastLoss,
    };
    
    await setDoc(doc(db, MODEL_METADATA_DOC), metadata);
    
    // Também salvar localmente como cache
    await saveModelLocal(model);
    
    console.log('Modelo salvo no Firebase com sucesso');
  } catch (error) {
    console.error('Erro ao salvar modelo no Firebase:', error);
    throw error;
  }
}

/**
 * Obtém metadados do modelo do Firebase
 */
export async function getModelMetadata(): Promise<ModelMetadata | null> {
  try {
    const docSnap = await getDoc(doc(db, MODEL_METADATA_DOC));
    if (docSnap.exists()) {
      return docSnap.data() as ModelMetadata;
    }
    return null;
  } catch (error) {
    console.warn('Erro ao obter metadados do modelo:', error);
    return null;
  }
}

/**
 * Carrega modelo do Firebase Storage
 */
export async function loadModelFromFirebase(): Promise<tf.LayersModel | null> {
  try {
    // Verificar se existe modelo no Firebase
    const metadata = await getModelMetadata();
    if (!metadata) {
      console.log('[ML] Nenhum modelo encontrado no Firebase (sem metadata)');
      return null;
    }
    
    // Obter URLs dos arquivos
    const modelJsonRef = ref(storage, `${FIREBASE_MODEL_PATH}/model.json`);
    
    let modelJsonUrl: string;
    try {
      modelJsonUrl = await getDownloadURL(modelJsonRef);
    } catch (urlError: any) {
      // Arquivo não existe no Storage
      console.log('[ML] Arquivos do modelo não encontrados no Storage');
      return null;
    }
    
    // Carregar modelo
    const model = await tf.loadLayersModel(modelJsonUrl);
    
    // Salvar localmente como cache
    await saveModelLocal(model);
    
    console.log('[ML] Modelo carregado do Firebase com sucesso');
    return model;
  } catch (error: any) {
    const errorMessage = error?.message || String(error);
    
    // Erros esperados quando modelo não existe
    if (
      errorMessage.includes('object-not-found') || 
      errorMessage.includes('404') ||
      errorMessage.includes('Not Found') ||
      errorMessage.includes('Float32Array') // Erro de arquivo corrompido/inexistente
    ) {
      console.log('[ML] Modelo não disponível no Firebase (ainda não foi treinado)');
      return null;
    }
    
    // Outros erros - logar mas não bloquear
    console.warn('[ML] Erro ao carregar modelo do Firebase (não crítico):', errorMessage);
    return null;
  }
}

/**
 * Carrega modelo (tenta Firebase primeiro, depois local, depois cria novo)
 */
export async function loadModel(): Promise<{ model: tf.LayersModel | null; metadata: ModelMetadata | null; source: 'firebase' | 'local' | 'new' }> {
  // 1. Verificar metadados do Firebase para saber se há modelo mais recente
  const firebaseMetadata = await getModelMetadata();
  const localTrainedAt = localStorage.getItem('ml_local_trained_at');
  
  // 2. Se há modelo no Firebase e é mais recente que o local, carregar do Firebase
  if (firebaseMetadata) {
    const firebaseDate = new Date(firebaseMetadata.trainedAt).getTime();
    const localDate = localTrainedAt ? new Date(localTrainedAt).getTime() : 0;
    
    if (firebaseDate > localDate) {
      const model = await loadModelFromFirebase();
      if (model) {
        localStorage.setItem('ml_local_trained_at', firebaseMetadata.trainedAt);
        return { model, metadata: firebaseMetadata, source: 'firebase' };
      }
    }
  }
  
  // 3. Tentar carregar do cache local
  const localModel = await loadModelLocal();
  if (localModel) {
    return { model: localModel, metadata: firebaseMetadata, source: 'local' };
  }
  
  // 4. Sem modelo - retornar null (será criado quando treinar)
  return { model: null, metadata: null, source: 'new' };
}

/**
 * Alias para compatibilidade - salva no Firebase
 */
export async function saveModel(model: tf.LayersModel, exampleCount: number = 0, lastLoss?: number): Promise<void> {
  await saveModelToFirebase(model, exampleCount, lastLoss);
}

/**
 * Remove modelo do IndexedDB local
 */
export async function deleteModelLocal(): Promise<void> {
  try {
    if ('indexedDB' in window) {
      const deleteReq = indexedDB.deleteDatabase(MODEL_STORAGE_KEY);
      await new Promise((resolve, reject) => {
        deleteReq.onsuccess = () => resolve(undefined);
        deleteReq.onerror = () => reject(deleteReq.error);
      });
    }
    localStorage.removeItem('ml_local_trained_at');
  } catch (error) {
    console.error('Erro ao deletar modelo local:', error);
  }
}
