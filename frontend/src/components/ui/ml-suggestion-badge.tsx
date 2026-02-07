import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MLSuggestionBadgeProps {
  className?: string;
}

/**
 * Badge visual para indicar que um ajuste foi sugerido pelo ML
 */
export function MLSuggestionBadge({ className }: MLSuggestionBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
        'bg-purple-100 text-purple-700 border border-purple-200',
        className
      )}
      title="Sugestão do Machine Learning"
    >
      <Sparkles className="h-3 w-3" />
      ML
    </span>
  );
}
