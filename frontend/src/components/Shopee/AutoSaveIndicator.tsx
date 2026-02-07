import { Loader2, Check, AlertCircle, Cloud } from 'lucide-react';
import { SaveStatus, formatLastSavedAt } from '@/hooks/useAutoSave';

interface AutoSaveIndicatorProps {
  status: SaveStatus;
  lastSavedAt: Date | null;
  error?: string | null;
}

export function AutoSaveIndicator({ status, lastSavedAt, error }: AutoSaveIndicatorProps) {
  const getIcon = () => {
    switch (status) {
      case 'saving':
        return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
      case 'saved':
        return <Check className="w-4 h-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Cloud className="w-4 h-4 text-gray-400" />;
    }
  };

  const getText = () => {
    switch (status) {
      case 'saving':
        return 'Salvando...';
      case 'saved':
        return `Salvo ${formatLastSavedAt(lastSavedAt)}`;
      case 'error':
        return error || 'Erro ao salvar';
      default:
        return lastSavedAt ? `Salvo ${formatLastSavedAt(lastSavedAt)}` : '';
    }
  };

  const getColor = () => {
    switch (status) {
      case 'saving':
        return 'text-blue-600';
      case 'saved':
        return 'text-green-600';
      case 'error':
        return 'text-red-600';
      default:
        return 'text-gray-500';
    }
  };

  if (status === 'idle' && !lastSavedAt) {
    return null;
  }

  return (
    <div className={`flex items-center gap-1.5 text-xs ${getColor()}`}>
      {getIcon()}
      <span>{getText()}</span>
    </div>
  );
}
