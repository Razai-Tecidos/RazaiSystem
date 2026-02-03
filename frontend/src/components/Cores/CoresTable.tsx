import { Cor } from '@/types/cor.types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Edit, Trash2, Loader2, Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CoresTableProps {
  cores: Cor[];
  onEdit: (cor: Cor) => void;
  onDelete: (id: string) => void;
  loading?: boolean;
}

// Componente Card para mobile
function CorCard({ 
  cor, 
  onEdit, 
  onDelete 
}: { 
  cor: Cor; 
  onEdit: (cor: Cor) => void; 
  onDelete: (id: string) => void;
}) {
  const isSaving = (cor as any)._status === 'saving';
  const isDeleting = (cor as any)._status === 'deleting';

  return (
    <div
      className={cn(
        "bg-white rounded-lg border p-4 transition-all duration-200 hover:shadow-md active:scale-[0.99]",
        (isSaving || isDeleting) && 'opacity-50'
      )}
    >
      <div className="flex items-start gap-3">
        {/* Imagem tingida ou swatch da cor */}
        {cor.imagemTingida ? (
          <img
            src={cor.imagemTingida}
            alt={`${cor.nome} tingido`}
            className="w-14 h-14 rounded-lg border-2 border-gray-200 flex-shrink-0 shadow-sm object-cover"
          />
        ) : (
          <div
            className="w-14 h-14 rounded-lg border-2 border-gray-200 flex-shrink-0 shadow-sm"
            style={{ backgroundColor: cor.codigoHex || '#ccc' }}
          />
        )}
        
        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {isSaving && <Loader2 className="h-3 w-3 animate-spin" />}
                {cor.sku ? (
                  <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded">
                    {cor.sku}
                  </span>
                ) : (
                  <span className="text-xs text-gray-400 italic">Sem SKU</span>
                )}
              </div>
              <h4 className="font-semibold text-gray-900 mt-1 truncate">{cor.nome}</h4>
              <p className="text-xs font-mono text-gray-500 mt-0.5">{cor.codigoHex || '-'}</p>
            </div>
            
            {/* Acoes */}
            <div className="flex gap-1 flex-shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onEdit(cor)}
                disabled={isSaving || isDeleting}
              >
                <Edit className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 hover:text-red-600"
                onClick={() => onDelete(cor.id)}
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
          
          {/* Tecido associado */}
          {cor.tecidoNome && (
            <div className="mt-2 pt-2 border-t border-gray-100">
              <p className="text-xs text-gray-500">
                Tecido: <span className="font-medium text-gray-700">{cor.tecidoNome}</span>
                {cor.tecidoSku && <span className="text-gray-400 ml-1">({cor.tecidoSku})</span>}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function CoresTable({
  cores,
  onEdit,
  onDelete,
  loading,
}: CoresTableProps) {
  if (cores.length === 0 && !loading) {
    return (
      <div className="text-center py-12 text-gray-500 animate-fade-in">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
          <div className="w-8 h-8 rounded bg-gray-300" />
        </div>
        <p>Nenhuma cor cadastrada ainda.</p>
      </div>
    );
  }

  return (
    <>
      {/* Mobile: Cards */}
      <div className="md:hidden space-y-3 animate-stagger">
        {cores.map((cor) => (
          <CorCard key={cor.id} cor={cor} onEdit={onEdit} onDelete={onDelete} />
        ))}
      </div>

      {/* Desktop: Tabela com scroll */}
      <div className="hidden md:block rounded-lg border overflow-hidden animate-fade-in">
        <div className="scroll-smooth-x">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50/80">
                <TableHead className="font-semibold">SKU</TableHead>
                <TableHead className="font-semibold">Nome</TableHead>
                <TableHead className="font-semibold">Cor</TableHead>
                <TableHead className="font-semibold">Preview</TableHead>
                <TableHead className="font-semibold">Tecido</TableHead>
                <TableHead className="text-right font-semibold">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cores.map((cor, index) => {
                const isSaving = (cor as any)._status === 'saving';
                const isDeleting = (cor as any)._status === 'deleting';

                return (
                  <TableRow
                    key={cor.id}
                    className={cn(
                      "transition-colors duration-150 hover:bg-gray-50/50",
                      (isSaving || isDeleting) && 'opacity-50'
                    )}
                    style={{ animationDelay: `${index * 30}ms` }}
                  >
                    <TableCell className="font-medium">
                      {isSaving ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          {cor.sku || '-'}
                        </span>
                      ) : cor.sku ? (
                        <span className="text-primary">{cor.sku}</span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{cor.nome}</TableCell>
                    <TableCell>
                      {cor.codigoHex ? (
                        <div className="flex items-center gap-2">
                          <div
                            className="w-7 h-7 rounded-md border-2 border-gray-200 shadow-sm transition-transform hover:scale-110"
                            style={{ backgroundColor: cor.codigoHex }}
                            title={cor.codigoHex}
                          />
                          <span className="font-mono text-xs text-gray-500">{cor.codigoHex}</span>
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {cor.imagemTingida ? (
                        <a 
                          href={cor.imagemTingida} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="block"
                        >
                          <img
                            src={cor.imagemTingida}
                            alt={`${cor.nome} tingido`}
                            className="w-12 h-12 rounded-md border border-gray-200 shadow-sm object-cover transition-transform hover:scale-110"
                          />
                        </a>
                      ) : (
                        <div className="w-12 h-12 rounded-md border border-dashed border-gray-300 flex items-center justify-center">
                          <ImageIcon className="w-5 h-5 text-gray-300" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {cor.tecidoNome ? (
                        <div className="text-sm">
                          <div className="font-medium text-gray-900">{cor.tecidoNome}</div>
                          {cor.tecidoSku && (
                            <div className="text-gray-500 text-xs">SKU: {cor.tecidoSku}</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 hover:bg-primary/10 hover:text-primary transition-colors"
                          onClick={() => onEdit(cor)}
                          disabled={isSaving || isDeleting}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 hover:bg-red-50 hover:text-red-600 transition-colors"
                          onClick={() => onDelete(cor.id)}
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
