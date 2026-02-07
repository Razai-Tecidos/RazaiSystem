import { useState, useEffect, useCallback } from 'react';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { useToast } from './use-toast';

/**
 * Interface para configurações globais do sistema
 */
export interface SystemConfig {
  deltaELimiar: number; // Limiar de Delta E para conflitos de cores
  updatedAt?: Date;
}

/**
 * Valores padrão das configurações
 */
const DEFAULT_CONFIG: SystemConfig = {
  deltaELimiar: 3, // Padrão: 3 (diferença perceptível para maioria das pessoas)
};

/**
 * Hook para gerenciar configurações globais do sistema
 * As configurações são salvas no Firebase e sincronizadas em tempo real
 */
export function useConfig() {
  const [config, setConfig] = useState<SystemConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  // Documento de configurações no Firestore
  const configDocRef = doc(db, 'system_config', 'global');

  // Carregar configurações e escutar mudanças em tempo real
  useEffect(() => {
    const unsubscribe = onSnapshot(
      configDocRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setConfig({
            deltaELimiar: data.deltaELimiar ?? DEFAULT_CONFIG.deltaELimiar,
            updatedAt: data.updatedAt?.toDate(),
          });
        } else {
          // Documento não existe, usar valores padrão
          setConfig(DEFAULT_CONFIG);
        }
        setLoading(false);
      },
      (error) => {
        console.error('Erro ao carregar configurações:', error);
        setConfig(DEFAULT_CONFIG);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  /**
   * Atualiza o limiar de Delta E
   */
  const setDeltaELimiar = useCallback(async (valor: number) => {
    // Validar valor
    const valorValidado = Math.max(0.1, Math.min(10, valor));
    
    // Atualizar estado local imediatamente (UI otimista)
    setConfig((prev) => ({ ...prev, deltaELimiar: valorValidado }));
    
    // Salvar no Firebase
    setSaving(true);
    try {
      await setDoc(
        configDocRef,
        {
          deltaELimiar: valorValidado,
          updatedAt: new Date(),
        },
        { merge: true }
      );
      
      toast({
        title: 'Configuração salva',
        description: `Limiar ΔE atualizado para ${valorValidado.toFixed(1)}`,
      });
    } catch (error) {
      console.error('Erro ao salvar configuração:', error);
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível salvar a configuração.',
        variant: 'destructive',
      });
      // Reverter para valor anterior em caso de erro
      // (o onSnapshot vai atualizar com o valor correto do servidor)
    } finally {
      setSaving(false);
    }
  }, [toast]);

  /**
   * Atualiza múltiplas configurações de uma vez
   */
  const updateConfig = useCallback(async (updates: Partial<SystemConfig>) => {
    // Atualizar estado local imediatamente
    setConfig((prev) => ({ ...prev, ...updates }));
    
    // Salvar no Firebase
    setSaving(true);
    try {
      await setDoc(
        configDocRef,
        {
          ...updates,
          updatedAt: new Date(),
        },
        { merge: true }
      );
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível salvar as configurações.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }, [toast]);

  return {
    config,
    loading,
    saving,
    deltaELimiar: config.deltaELimiar,
    setDeltaELimiar,
    updateConfig,
  };
}
