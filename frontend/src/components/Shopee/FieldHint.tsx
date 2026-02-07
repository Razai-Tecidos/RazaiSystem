import { ReactNode } from 'react';
import { HelpCircle } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface FieldHintProps {
  label: string;
  hint?: string;
  description?: string;
  required?: boolean;
  children?: ReactNode;
  className?: string;
}

/**
 * Componente reutilizável que exibe label com tooltip de ajuda e descrição.
 * Usado em todos os campos do formulário de criação de anúncio.
 */
export function FieldHint({ label, hint, description, required, children, className }: FieldHintProps) {
  return (
    <div className={className}>
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-sm font-medium text-gray-700">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </span>
        {hint && (
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" className="text-gray-400 hover:text-gray-600 transition-colors">
                  <HelpCircle className="w-3.5 h-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs text-sm">
                <p>{hint}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      {children}
      {description && (
        <p className="text-xs text-gray-400 mt-1">{description}</p>
      )}
    </div>
  );
}
