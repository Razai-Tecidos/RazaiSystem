import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DELTA_E_LIMIAR_CONFLITO } from '@/lib/deltaE';

interface DeltaEBadgeProps {
  deltaE: number;
  className?: string;
}

/**
 * Badge para exibir status de conflito baseado em deltaE
 */
export function DeltaEBadge({ deltaE, className }: DeltaEBadgeProps) {
  const temConflito = deltaE < DELTA_E_LIMIAR_CONFLITO;

  if (!temConflito) {
    return null;
  }

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium',
        'bg-yellow-100 text-yellow-800 border border-yellow-200',
        className
      )}
    >
      <AlertCircle className="h-3 w-3" />
      <span>DeltaE: {deltaE.toFixed(2)}</span>
    </div>
  );
}
