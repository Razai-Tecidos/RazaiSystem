import { useState, useEffect, useCallback, useRef } from 'react';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface UseAutoSaveOptions<T> {
  data: T;
  onSave: (data: T) => Promise<void>;
  debounceMs?: number;
  enabled?: boolean;
}

/**
 * Hook para auto-save com debounce
 * Salva automaticamente após período de inatividade
 */
export function useAutoSave<T>({
  data,
  onSave,
  debounceMs = 5000,
  enabled = true,
}: UseAutoSaveOptions<T>) {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastDataRef = useRef<string>('');
  const isMountedRef = useRef(true);

  // Limpa timeout ao desmontar
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Função de salvamento
  const save = useCallback(async (dataToSave: T) => {
    if (!isMountedRef.current) return;
    
    setSaveStatus('saving');
    setError(null);
    
    try {
      await onSave(dataToSave);
      
      if (isMountedRef.current) {
        setSaveStatus('saved');
        setLastSavedAt(new Date());
        
        // Volta para idle após 2 segundos
        setTimeout(() => {
          if (isMountedRef.current) {
            setSaveStatus('idle');
          }
        }, 2000);
      }
    } catch (err: any) {
      if (isMountedRef.current) {
        setSaveStatus('error');
        setError(err.message || 'Erro ao salvar');
      }
    }
  }, [onSave]);

  // Efeito de debounce
  useEffect(() => {
    if (!enabled) return;
    
    // Serializa dados para comparação
    const serializedData = JSON.stringify(data);
    
    // Se dados não mudaram, não faz nada
    if (serializedData === lastDataRef.current) {
      return;
    }
    
    // Limpa timeout anterior
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    // Agenda novo salvamento
    timeoutRef.current = setTimeout(() => {
      lastDataRef.current = serializedData;
      save(data);
    }, debounceMs);
    
    // Cleanup
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [data, debounceMs, enabled, save]);

  // Força salvamento imediato
  const saveNow = useCallback(async () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    lastDataRef.current = JSON.stringify(data);
    await save(data);
  }, [data, save]);

  // Cancela salvamento pendente
  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setSaveStatus('idle');
  }, []);

  return {
    saveStatus,
    lastSavedAt,
    error,
    saveNow,
    cancel,
    isSaving: saveStatus === 'saving',
    isSaved: saveStatus === 'saved',
    hasError: saveStatus === 'error',
  };
}

/**
 * Componente indicador de status de salvamento
 */
export function getAutoSaveStatusText(status: SaveStatus): string {
  switch (status) {
    case 'saving':
      return 'Salvando...';
    case 'saved':
      return 'Salvo';
    case 'error':
      return 'Erro ao salvar';
    default:
      return '';
  }
}

/**
 * Formata data/hora do último salvamento
 */
export function formatLastSavedAt(date: Date | null): string {
  if (!date) return '';
  
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  
  if (diffSec < 60) {
    return 'agora';
  }
  
  if (diffMin < 60) {
    return `há ${diffMin} min`;
  }
  
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
