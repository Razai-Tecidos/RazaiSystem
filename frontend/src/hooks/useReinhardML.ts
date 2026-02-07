import { useState, useEffect, useCallback, useRef } from 'react';
import * as tf from '@tensorflow/tfjs';
import { LabColor } from '@/types/cor.types';
import { MLModelStatus, MLPrediction, ImageStats } from '@/types/ml.types';
import { 
  createModel, 
  loadModel, 
  saveModel, 
  predictAdjustments, 
  getModelMetadata,
  ModelMetadata 
} from '@/lib/ml/reinhardML';
import { trainModel } from '@/lib/ml/training';
import { countTrainingExamples } from '@/lib/firebase/ml-training';

const MIN_EXAMPLES_FOR_TRAINING = 10;
const AUTO_TRAIN_CHECK_INTERVAL = 30000; // Verificar a cada 30 segundos
const MIN_NEW_EXAMPLES_FOR_RETRAIN = 5; // Mínimo de novos exemplos para retreinar

interface UseReinhardMLReturn {
  status: MLModelStatus;
  model: tf.LayersModel | null;
  predict: (
    lab: LabColor,
    tecidoTipo?: string,
    tecidoComposicao?: string,
    imagemStats?: ImageStats,
    tecidoNome?: string,
    tecidoId?: string
  ) => Promise<MLPrediction | null>;
  train: () => Promise<void>;
  exampleCount: number;
  isReady: boolean;
  metadata: ModelMetadata | null;
  lastAutoCheck: Date | null;
}

/**
 * Hook para gerenciar modelo ML de sugestão de ajustes Reinhard
 * - Modelo compartilhado via Firebase Storage
 * - Treinamento automático quando há novos exemplos
 * - Cache local para performance
 */
export function useReinhardML(): UseReinhardMLReturn {
  const [status, setStatus] = useState<MLModelStatus>('idle');
  const [model, setModel] = useState<tf.LayersModel | null>(null);
  const [exampleCount, setExampleCount] = useState(0);
  const [metadata, setMetadata] = useState<ModelMetadata | null>(null);
  const [lastAutoCheck, setLastAutoCheck] = useState<Date | null>(null);
  
  const isTrainingRef = useRef(false);
  const autoTrainIntervalRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Carrega modelo (Firebase > Local > Novo)
   */
  const loadOrCreateModel = useCallback(async () => {
    setStatus('loading');
    try {
      const { model: loadedModel, metadata: loadedMetadata, source } = await loadModel();
      
      if (loadedModel) {
        console.log(`Modelo ML carregado de: ${source}`);
        setModel(loadedModel);
        setMetadata(loadedMetadata);
        setStatus('ready');
      } else {
        console.log('Nenhum modelo encontrado - aguardando exemplos para treinar');
        setStatus('idle');
      }
      
      // Atualizar contagem de exemplos
      const count = await countTrainingExamples();
      setExampleCount(count);
      
    } catch (error) {
      console.warn('Erro ao inicializar modelo ML:', error);
      setStatus('idle');
      setModel(null);
    }
  }, []);

  /**
   * Verifica se deve treinar automaticamente
   */
  const checkAndAutoTrain = useCallback(async () => {
    if (isTrainingRef.current) {
      return; // Já está treinando
    }
    
    try {
      setLastAutoCheck(new Date());
      
      const currentCount = await countTrainingExamples();
      setExampleCount(currentCount);
      
      // Precisa de pelo menos MIN_EXAMPLES_FOR_TRAINING exemplos
      if (currentCount < MIN_EXAMPLES_FOR_TRAINING) {
        console.log(`Auto-train: ${currentCount} exemplos (mínimo: ${MIN_EXAMPLES_FOR_TRAINING})`);
        return;
      }
      
      // Verificar se há novos exemplos desde o último treinamento
      const currentMetadata = await getModelMetadata();
      const lastTrainedCount = currentMetadata?.exampleCount || 0;
      const newExamples = currentCount - lastTrainedCount;
      
      // Se não há modelo ou há novos exemplos suficientes, treinar
      const shouldTrain = !currentMetadata || newExamples >= MIN_NEW_EXAMPLES_FOR_RETRAIN;
      
      if (shouldTrain) {
        console.log(`Auto-train: Iniciando treinamento (${newExamples} novos exemplos)`);
        await trainModelAsync();
      } else {
        console.log(`Auto-train: Sem necessidade (${newExamples} novos, mínimo: ${MIN_NEW_EXAMPLES_FOR_RETRAIN})`);
      }
      
    } catch (error) {
      console.warn('Erro na verificação de auto-train:', error);
    }
  }, []);

  /**
   * Treina modelo e salva no Firebase
   */
  const trainModelAsync = useCallback(async () => {
    if (isTrainingRef.current) {
      console.log('Treinamento já em andamento');
      return;
    }
    
    isTrainingRef.current = true;
    setStatus('training');
    
    try {
      // Criar novo modelo ou usar existente
      let modelToTrain = model;
      if (!modelToTrain) {
        modelToTrain = createModel();
      }
      
      // Treinar
      const history = await trainModel(modelToTrain as tf.Sequential);
      const finalLoss = history.history.loss?.[history.history.loss.length - 1] as number | undefined;
      
      // Obter contagem atual
      const count = await countTrainingExamples();
      
      // Salvar no Firebase
      await saveModel(modelToTrain, count, finalLoss);
      
      // Atualizar estado
      setModel(modelToTrain);
      setExampleCount(count);
      setMetadata({
        version: '1.0.0',
        trainedAt: new Date().toISOString(),
        exampleCount: count,
        lastLoss: finalLoss,
      });
      setStatus('ready');
      
      console.log('Treinamento automático concluído com sucesso');
      
    } catch (error: any) {
      console.error('Erro no treinamento:', error);
      // Se falhou por poucos exemplos, não é erro crítico
      if (error?.message?.includes('Poucos exemplos')) {
        setStatus(model ? 'ready' : 'idle');
      } else {
        setStatus('error');
      }
    } finally {
      isTrainingRef.current = false;
    }
  }, [model]);

  /**
   * Treina modelo manualmente
   */
  const train = useCallback(async () => {
    await trainModelAsync();
  }, [trainModelAsync]);

  /**
   * Prediz ajustes para novos valores LAB
   * Agora aceita tecidoNome e tecidoId para aprendizado específico por tecido
   */
  const predict = useCallback(async (
    lab: LabColor,
    tecidoTipo?: string,
    tecidoComposicao?: string,
    imagemStats?: ImageStats,
    tecidoNome?: string,
    tecidoId?: string
  ): Promise<MLPrediction | null> => {
    if (!model || status !== 'ready') {
      return null;
    }
    
    try {
      return await predictAdjustments(model, lab, tecidoTipo, tecidoComposicao, imagemStats, tecidoNome, tecidoId);
    } catch (error) {
      console.error('Erro ao predizer ajustes:', error);
      return null;
    }
  }, [model, status]);

  /**
   * Inicialização - carrega modelo e inicia verificação automática
   */
  useEffect(() => {
    loadOrCreateModel();
    
    // Verificar auto-train após carregar
    const initialCheckTimeout = setTimeout(() => {
      checkAndAutoTrain();
    }, 5000); // Aguardar 5s após inicialização
    
    // Configurar verificação periódica
    autoTrainIntervalRef.current = setInterval(() => {
      checkAndAutoTrain();
    }, AUTO_TRAIN_CHECK_INTERVAL);
    
    return () => {
      clearTimeout(initialCheckTimeout);
      if (autoTrainIntervalRef.current) {
        clearInterval(autoTrainIntervalRef.current);
      }
    };
  }, [loadOrCreateModel, checkAndAutoTrain]);

  /**
   * Verificar novos exemplos quando componente recebe foco
   */
  useEffect(() => {
    const handleFocus = () => {
      // Verificar após 2s do foco para não sobrecarregar
      setTimeout(checkAndAutoTrain, 2000);
    };
    
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [checkAndAutoTrain]);

  return {
    status,
    model,
    predict,
    train,
    exampleCount,
    isReady: status === 'ready' && model !== null,
    metadata,
    lastAutoCheck,
  };
}
