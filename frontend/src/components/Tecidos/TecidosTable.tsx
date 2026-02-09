import { TecidoWithStatus } from '@/hooks/useTecidos';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Edit, Trash2, Loader2, Package, Plus, SearchX } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TecidosTableProps {
  tecidos: TecidoWithStatus[];
  onEdit: (tecido: TecidoWithStatus) => void;
  onDelete: (id: string) => void;
  onAdd?: () => void;
  loading?: boolean;
}

// Função para formatar composição
const formatComposicao = (composicao: string | unknown): string => {
  if (typeof composicao === 'string') {
    return composicao;
  }
  if (Array.isArray(composicao)) {
    return (composicao as any).map((item: any) => item.nome || item).join(', ');
  }
  return String(composicao);
};

// Componente Card para mobile
function TecidoCard({ 
  tecido, 
  onEdit, 
  onDelete 
}: { 
  tecido: TecidoWithStatus; 
  onEdit: (tecido: TecidoWithStatus) => void; 
  onDelete: (id: string) => void;
}) {
  const isSaving = tecido._status === 'saving';
  const isDeleting = tecido._status === 'deleting';

  return (
    <div
      className={cn(
        "bg-white rounded-lg border p-4 transition-all duration-200 hover:shadow-md active:scale-[0.99]",
        (isSaving || isDeleting) && 'opacity-50'
      )}
    >
      <div className="flex items-start gap-3">
        {/* Icone/Imagem */}
        <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-gray-100 to-gray-200 flex-shrink-0 flex items-center justify-center shadow-sm overflow-hidden">
          {tecido.imagemPadrao ? (
            <img 
              src={tecido.imagemPadrao} 
              alt={tecido.nome}
              className="w-full h-full object-cover"
            />
          ) : (
            <Package className="h-6 w-6 text-gray-400" />
          )}
        </div>
        
        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {isSaving && <Loader2 className="h-3 w-3 animate-spin" />}
                <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded">
                  {tecido.sku}
                </span>
              </div>
              <h4 className="font-semibold text-gray-900 mt-1 truncate">{tecido.nome}</h4>
            </div>
            
            {/* Acoes */}
            <div className="flex gap-1 flex-shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                onClick={() => onEdit(tecido)}
                disabled={isSaving || isDeleting}
                aria-label={`Editar ${tecido.nome}`}
              >
                <Edit className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 hover:text-red-600"
                onClick={() => onDelete(tecido.id)}
                disabled={isSaving || isDeleting}
                aria-label={`Excluir ${tecido.nome}`}
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
          <div className="mt-2 pt-2 border-t border-gray-100 grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-gray-500">Tipo:</span>
              <span className={cn(
                "ml-1 px-1.5 py-0.5 rounded text-xs font-medium",
                tecido.tipo === 'estampado' 
                  ? "bg-pink-100 text-pink-700" 
                  : "bg-blue-100 text-blue-700"
              )}>
                {tecido.tipo === 'estampado' ? 'Estampado' : 'Liso'}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Largura:</span>
              <span className="font-medium text-gray-700 ml-1">
                {tecido.largura.toFixed(2).replace('.', ',')}m
              </span>
            </div>
            <div className="col-span-2">
              <span className="text-gray-500">Composição:</span>
              <span className="font-medium text-gray-700 ml-1 line-clamp-2">
                {formatComposicao(tecido.composicao)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function TecidosTable({
  tecidos,
  onEdit,
  onDelete,
  onAdd,
  loading,
}: TecidosTableProps) {
  // Empty state melhorado com CTA
  if (tecidos.length === 0 && !loading) {
    return (
      <div className="text-center py-12 text-gray-500 animate-fade-in">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
          <SearchX className="h-8 w-8 text-gray-300" />
        </div>
        <p className="font-medium text-gray-700">Nenhum tecido encontrado</p>
        <p className="text-sm mt-1">Tente alterar a busca ou o filtro aplicado.</p>
        {onAdd && (
          <Button onClick={onAdd} className="mt-4" variant="outline">
            <Plus className="mr-2 h-4 w-4" />
            Adicionar primeiro tecido
          </Button>
        )}
      </div>
    );
  }

  return (
    <>
      {/* Mobile: Cards */}
      <div className="md:hidden space-y-3 animate-stagger">
        {tecidos.map((tecido) => (
          <TecidoCard key={tecido.id} tecido={tecido} onEdit={onEdit} onDelete={onDelete} />
        ))}
      </div>

      {/* Desktop: Tabela com thumbnail */}
      <div className="hidden md:block rounded-lg border overflow-hidden animate-fade-in">
        <div className="scroll-smooth-x">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50/80">
                <TableHead className="font-semibold w-10"></TableHead>
                <TableHead className="font-semibold">SKU</TableHead>
                <TableHead className="font-semibold">Nome</TableHead>
                <TableHead className="font-semibold">Tipo</TableHead>
                <TableHead className="font-semibold">Largura (m)</TableHead>
                <TableHead className="font-semibold">Composição</TableHead>
                <TableHead className="text-right font-semibold">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tecidos.map((tecido, index) => {
                const isSaving = tecido._status === 'saving';
                const isDeleting = tecido._status === 'deleting';

                return (
                  <TableRow
                    key={tecido.id}
                    className={cn(
                      "transition-colors duration-150 hover:bg-gray-50/50",
                      (isSaving || isDeleting) && 'opacity-50'
                    )}
                    style={{ animationDelay: `${index * 30}ms` }}
                  >
                    <TableCell className="w-10 pr-0">
                      <div className="w-8 h-8 rounded bg-gray-100 overflow-hidden flex items-center justify-center flex-shrink-0">
                        {tecido.imagemPadrao ? (
                          <img 
                            src={tecido.imagemPadrao} 
                            alt={tecido.nome}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Package className="h-4 w-4 text-gray-300" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      {isSaving ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          {tecido.sku}
                        </span>
                      ) : (
                        <span className="text-primary">{tecido.sku}</span>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{tecido.nome}</TableCell>
                    <TableCell>
                      <span className={cn(
                        "px-2 py-1 rounded text-xs font-medium",
                        tecido.tipo === 'estampado' 
                          ? "bg-pink-100 text-pink-700" 
                          : "bg-blue-100 text-blue-700"
                      )}>
                        {tecido.tipo === 'estampado' ? 'Estampado' : 'Liso'}
                      </span>
                    </TableCell>
                    <TableCell>
                      {tecido.largura.toFixed(2).replace('.', ',')}m
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <div className="truncate text-gray-600" title={formatComposicao(tecido.composicao)}>
                        {formatComposicao(tecido.composicao)}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 hover:bg-primary/10 hover:text-primary transition-colors"
                          onClick={() => onEdit(tecido)}
                          disabled={isSaving || isDeleting}
                          aria-label={`Editar ${tecido.nome}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 hover:bg-red-50 hover:text-red-600 transition-colors"
                          onClick={() => onDelete(tecido.id)}
                          disabled={isSaving || isDeleting}
                          aria-label={`Excluir ${tecido.nome}`}
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
