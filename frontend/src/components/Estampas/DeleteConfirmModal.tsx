import { Estampa } from '@/types/estampa.types';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AlertTriangle, Image as ImageIcon } from 'lucide-react';

interface DeleteConfirmModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  estampa: Estampa | null;
}

export function DeleteConfirmModal({
  open,
  onOpenChange,
  onConfirm,
  estampa,
}: DeleteConfirmModalProps) {
  if (!estampa) return null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <AlertDialogTitle className="text-left">
              Excluir estampa?
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-left pt-2">
            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg mb-3">
              {/* Preview da estampa */}
              <div className="w-12 h-12 rounded bg-gray-200 flex-shrink-0 overflow-hidden">
                {estampa.imagem ? (
                  <img
                    src={estampa.imagem}
                    alt={estampa.nome}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="h-5 w-5 text-gray-400" />
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <p className="font-medium text-gray-900 truncate">{estampa.nome}</p>
                <p className="text-sm text-gray-500">
                  {estampa.sku && <span className="font-mono">{estampa.sku}</span>}
                  {estampa.sku && estampa.tecidoBaseNome && ' • '}
                  {estampa.tecidoBaseNome}
                </p>
              </div>
            </div>
            Esta ação não pode ser desfeita. A estampa será removida permanentemente do sistema.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
          >
            Excluir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
