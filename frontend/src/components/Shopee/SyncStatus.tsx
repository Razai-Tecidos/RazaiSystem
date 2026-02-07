import { RefreshCw, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SyncStatus as SyncStatusType } from '@/types/shopee-product.types';

interface SyncStatusProps {
  status?: SyncStatusType;
  lastSyncedAt?: Date | null;
  onSync?: () => void;
  syncing?: boolean;
  compact?: boolean;
}

export function SyncStatus({ 
  status, 
  lastSyncedAt, 
  onSync, 
  syncing = false,
  compact = false,
}: SyncStatusProps) {
  const getStatusIcon = () => {
    switch (status) {
      case 'synced':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'out_of_sync':
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'synced':
        return 'Sincronizado';
      case 'out_of_sync':
        return 'Desatualizado';
      case 'error':
        return 'Erro na sincronização';
      default:
        return 'Não sincronizado';
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'synced':
        return 'bg-green-100 text-green-800';
      case 'out_of_sync':
        return 'bg-yellow-100 text-yellow-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatLastSync = (date: Date | null | undefined) => {
    if (!date) return 'Nunca';
    
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMin < 1) return 'Agora';
    if (diffMin < 60) return `Há ${diffMin} min`;
    if (diffHours < 24) return `Há ${diffHours}h`;
    return `Há ${diffDays} dia${diffDays > 1 ? 's' : ''}`;
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor()}`}>
          {getStatusIcon()}
          <span className="ml-1">{getStatusText()}</span>
        </span>
        {onSync && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onSync}
            disabled={syncing}
            className="h-6 w-6 p-0"
          >
            <RefreshCw className={`w-3 h-3 ${syncing ? 'animate-spin' : ''}`} />
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
      <div className="flex items-center gap-3">
        {getStatusIcon()}
        <div>
          <p className="text-sm font-medium">{getStatusText()}</p>
          <p className="text-xs text-gray-500">
            Última sincronização: {formatLastSync(lastSyncedAt)}
          </p>
        </div>
      </div>
      {onSync && (
        <Button
          variant="outline"
          size="sm"
          onClick={onSync}
          disabled={syncing}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Sincronizando...' : 'Sincronizar'}
        </Button>
      )}
    </div>
  );
}
