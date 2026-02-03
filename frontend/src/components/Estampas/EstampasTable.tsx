import { Estampa } from '@/types/estampa.types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Edit, Trash2, Loader2, Image as ImageIcon, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EstampasTableProps {
  estampas: Estampa[];
  onEdit: (estampa: Estampa) => void;
  onDelete: (id: string) => void;
  loading?: boolean;
}

// Componente Card para mobile
function EstampaCard({ 
  estampa, 
  onEdit, 
  onDelete 
}: { 
  estampa: Estampa; 
  onEdit: (estampa: Estampa) => void; 
  onDelete: (id: string) => void;
}) {
  const isSaving = (estampa as any)._status === 'saving';
  const isDeleting = (estampa as any)._status === 'deleting';

  return (
    <div
      className={cn(
        "bg-white rounded-lg border p-4 transition-all duration-200 hover:shadow-md active:scale-[0.99]",
        (isSaving || isDeleting) && 'opacity-50'
      )}
    >
      <div className="flex items-start gap-3">
        {/* Imagem */}
        <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-gray-100 to-gray-200 flex-shrink-0 flex items-center justify-center shadow-sm overflow-hidden">
          {estampa.imagem ? (
            <img 
              src={estampa.imagem} 
              alt={estampa.nome}
              className="w-full h-full object-cover"
            />
          ) : (
            <ImageIcon className="h-6 w-6 text-gray-400" />
          )}
        </div>
        
        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {isSaving && <Loader2 className="h-3 w-3 animate-spin" />}
                <span className="text-xs font-medium text-purple-600 bg-purple-50 px-2 py-0.5 rounded">
                  {estampa.sku || '-'}
                </span>
              </div>
              <h4 className="font-semibold text-gray-900 mt-1 truncate">{estampa.nome}</h4>
            </div>
            
            {/* Ações */}
            <div className="flex gap-1 flex-shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onEdit(estampa)}
                disabled={isSaving || isDeleting}
              >
                <Edit className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 hover:text-red-600"
                onClick={() => onDelete(estampa.id)}
                disabled={isSaving || isDeleting}
              >
                {isDeleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
          
          {/* Detalhes */}
          <div className="mt-2 pt-2 border-t border-gray-100 text-xs">
            <span className="text-gray-500">Tecido base:</span>
            <span className="font-medium text-gray-700 ml-1">
              {estampa.tecidoBaseNome || 'N/A'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function EstampasTable({
  estampas,
  onEdit,
  onDelete,
  loading,
}: EstampasTableProps) {
  if (estampas.length === 0 && !loading) {
    return (
      <div className="text-center py-12 text-gray-500 animate-fade-in">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
          <ImageIcon className="h-8 w-8 text-gray-300" />
        </div>
        <p>Nenhuma estampa cadastrada ainda.</p>
      </div>
    );
  }

  return (
    <>
      {/* Mobile: Cards */}
      <div className="md:hidden space-y-3 animate-stagger">
        {estampas.map((estampa) => (
          <EstampaCard key={estampa.id} estampa={estampa} onEdit={onEdit} onDelete={onDelete} />
        ))}
      </div>

      {/* Desktop: Tabela */}
      <div className="hidden md:block rounded-lg border overflow-hidden animate-fade-in">
        <div className="scroll-smooth-x">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50/80">
                <TableHead className="font-semibold w-20">Preview</TableHead>
                <TableHead className="font-semibold">SKU</TableHead>
                <TableHead className="font-semibold">Nome</TableHead>
                <TableHead className="font-semibold">Tecido Base</TableHead>
                <TableHead className="text-right font-semibold">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {estampas.map((estampa, index) => {
                const isSaving = (estampa as any)._status === 'saving';
                const isDeleting = (estampa as any)._status === 'deleting';

                return (
                  <TableRow
                    key={estampa.id}
                    className={cn(
                      "transition-colors duration-150 hover:bg-gray-50/50",
                      (isSaving || isDeleting) && 'opacity-50'
                    )}
                    style={{ animationDelay: `${index * 30}ms` }}
                  >
                    <TableCell>
                      {estampa.imagem ? (
                        <a
                          href={estampa.imagem}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block w-12 h-12 rounded overflow-hidden border hover:opacity-80 transition-opacity relative group"
                        >
                          <img
                            src={estampa.imagem}
                            alt={estampa.nome}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <ExternalLink className="h-4 w-4 text-white" />
                          </div>
                        </a>
                      ) : (
                        <div className="w-12 h-12 rounded bg-gray-100 flex items-center justify-center">
                          <ImageIcon className="h-5 w-5 text-gray-400" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">
                      {isSaving ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          {estampa.sku || '...'}
                        </span>
                      ) : (
                        <span className="text-purple-600">{estampa.sku || '-'}</span>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{estampa.nome}</TableCell>
                    <TableCell className="text-gray-600">
                      {estampa.tecidoBaseNome || 'N/A'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 hover:bg-purple-50 hover:text-purple-600 transition-colors"
                          onClick={() => onEdit(estampa)}
                          disabled={isSaving || isDeleting}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 hover:bg-red-50 hover:text-red-600 transition-colors"
                          onClick={() => onDelete(estampa.id)}
                          disabled={isSaving || isDeleting}
                        >
                          {isDeleting ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </>
  );
}
