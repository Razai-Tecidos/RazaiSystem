import { useState, useEffect } from 'react';
import { Header } from '@/components/Layout/Header';
import { BreadcrumbNav } from '@/components/Layout/BreadcrumbNav';
import { EmptyState } from '@/components/Layout/EmptyState';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useShopeeProducts } from '@/hooks/useShopeeProducts';
import { useShopee } from '@/hooks/useShopee';
import { ShopeeProduct } from '@/types/shopee-product.types';
import { 
  Plus, 
  Loader2, 
  FileText, 
  CheckCircle, 
  AlertCircle, 
  Clock,
  Trash2,
  Edit,
  ExternalLink,
  RefreshCw,
  Copy,
  ShoppingBag,
} from 'lucide-react';

interface AnunciosShopeeProps {
  onNavigateHome?: () => void;
  onNavigateToCriar?: (draftId?: string) => void;
}

type FilterStatus = 'all' | 'draft' | 'created' | 'error';

// Skeleton loading
function AnuncioSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map(i => (
        <div key={i} className="border rounded-lg p-4 animate-pulse">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gray-200 rounded flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 rounded w-2/3" />
              <div className="h-3 bg-gray-100 rounded w-1/3" />
              <div className="h-5 bg-gray-100 rounded w-24 mt-2" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function getStatusBadge(status: ShopeeProduct['status']) {
  switch (status) {
    case 'draft':
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
          <FileText className="w-3 h-3 mr-1" />
          Rascunho
        </span>
      );
    case 'publishing':
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          <Clock className="w-3 h-3 mr-1 animate-spin" />
          Publicando
        </span>
      );
    case 'created':
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <CheckCircle className="w-3 h-3 mr-1" />
          Publicado
        </span>
      );
    case 'error':
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
          <AlertCircle className="w-3 h-3 mr-1" />
          Erro
        </span>
      );
    case 'syncing':
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
          <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
          Sincronizando
        </span>
      );
    default:
      return null;
  }
}

export function AnunciosShopee({ onNavigateHome, onNavigateToCriar }: AnunciosShopeeProps) {
  const { shops } = useShopee();
  const { 
    products, 
    loading, 
    loadProducts, 
    deleteProduct,
    countByStatus,
  } = useShopeeProducts();
  
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [deleting, setDeleting] = useState<string | null>(null);
  
  // Confirm dialog state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [pendingDeleteProduct, setPendingDeleteProduct] = useState<ShopeeProduct | null>(null);

  const selectedShop = shops[0];

  useEffect(() => {
    if (selectedShop?.shopId) {
      loadProducts(selectedShop.shopId);
    }
  }, [selectedShop?.shopId, loadProducts]);

  const handleDelete = (product: ShopeeProduct) => {
    setPendingDeleteId(product.id);
    setPendingDeleteProduct(product);
    setConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!pendingDeleteId) return;
    setConfirmOpen(false);
    setDeleting(pendingDeleteId);
    try {
      await deleteProduct(pendingDeleteId);
    } finally {
      setDeleting(null);
      setPendingDeleteId(null);
      setPendingDeleteProduct(null);
    }
  };

  const handleEdit = (product: ShopeeProduct) => {
    onNavigateToCriar?.(product.id);
  };

  const handleDuplicate = (product: ShopeeProduct) => {
    onNavigateToCriar?.(`duplicate_${product.id}`);
  };

  const counts = countByStatus();

  const filteredProducts = filterStatus === 'all'
    ? products
    : products.filter(p => p.status === filterStatus);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header onNavigateHome={onNavigateHome} />
      
      <BreadcrumbNav
        items={[
          { label: 'Home', onClick: onNavigateHome },
          { label: 'Anúncios Shopee' }
        ]}
      />

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-8">
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          {/* Cabeçalho */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
            <div>
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Anúncios Shopee</h2>
              <p className="text-xs sm:text-sm text-gray-500 mt-1">
                Gerencie seus anúncios e rascunhos
              </p>
            </div>
            <Button onClick={() => onNavigateToCriar?.()} className="min-h-[44px] w-full sm:w-auto">
              <Plus className="w-4 h-4 mr-2" />
              Criar Anúncio
            </Button>
          </div>

          {/* Filtros - scroll horizontal no mobile */}
          <div className="flex gap-2 mb-6 overflow-x-auto pb-1 scroll-smooth-x -mx-1 px-1">
            <Button
              variant={filterStatus === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterStatus('all')}
              className="min-h-[40px] whitespace-nowrap flex-shrink-0"
            >
              Todos ({products.length})
            </Button>
            <Button
              variant={filterStatus === 'draft' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterStatus('draft')}
              className="min-h-[40px] whitespace-nowrap flex-shrink-0"
            >
              <FileText className="w-4 h-4 mr-1" />
              Rascunhos ({counts.draft})
            </Button>
            <Button
              variant={filterStatus === 'created' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterStatus('created')}
              className="min-h-[40px] whitespace-nowrap flex-shrink-0"
            >
              <CheckCircle className="w-4 h-4 mr-1" />
              Publicados ({counts.created})
            </Button>
            <Button
              variant={filterStatus === 'error' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterStatus('error')}
              className="min-h-[40px] whitespace-nowrap flex-shrink-0"
            >
              <AlertCircle className="w-4 h-4 mr-1" />
              Com Erro ({counts.error})
            </Button>
          </div>

          {/* Lista de Produtos */}
          {loading ? (
            <AnuncioSkeleton />
          ) : filteredProducts.length === 0 ? (
            <EmptyState
              icon={<ShoppingBag className="h-8 w-8" />}
              title="Nenhum anúncio encontrado"
              description={
                filterStatus === 'all' 
                  ? 'Comece criando seu primeiro anúncio'
                  : 'Nenhum anúncio com este status'
              }
              action={filterStatus === 'all' ? (
                <Button onClick={() => onNavigateToCriar?.()} className="min-h-[44px]">
                  <Plus className="w-4 h-4 mr-2" />
                  Criar Anúncio
                </Button>
              ) : undefined}
            />
          ) : (
            <div className="space-y-4">
              {filteredProducts.map(product => (
                <div
                  key={product.id}
                  className="border rounded-lg p-3 sm:p-4 hover:bg-gray-50 transition-colors"
                >
                  {/* Layout principal */}
                  <div className="flex items-start gap-3 sm:gap-4">
                    {/* Imagem */}
                    {product.imagens_principais[0] ? (
                      <img
                        src={product.imagens_principais[0]}
                        alt={product.tecido_nome}
                        className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded flex-shrink-0"
                      />
                    ) : (
                      <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gray-200 rounded flex items-center justify-center flex-shrink-0">
                        <FileText className="w-6 h-6 sm:w-8 sm:h-8 text-gray-400" />
                      </div>
                    )}

                    {/* Informações */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 truncate">{product.tecido_nome}</h3>
                      <p className="text-xs sm:text-sm text-gray-500">SKU: {product.tecido_sku}</p>
                      <div className="flex flex-wrap items-center gap-2 mt-1.5">
                        {getStatusBadge(product.status)}
                        {product.item_id && (
                          <span className="text-xs text-gray-500 hidden sm:inline">
                            ID: {product.item_id}
                          </span>
                        )}
                      </div>
                      {product.error_message && (
                        <p className="text-xs text-red-600 mt-1.5 line-clamp-2">
                          {product.error_message}
                        </p>
                      )}

                      {/* Info preço/variações - visível em mobile */}
                      <div className="flex items-center gap-3 mt-2 text-sm">
                        <span className="font-medium text-gray-900">
                          R$ {product.preco_base.toFixed(2)}
                        </span>
                        <span className="text-xs text-gray-500">
                          {product.modelos.length} variações
                        </span>
                      </div>
                    </div>

                    {/* Preço (desktop) */}
                    <div className="hidden sm:block text-right flex-shrink-0">
                      <p className="font-medium">R$ {product.preco_base.toFixed(2)}</p>
                      <p className="text-sm text-gray-500">
                        {product.modelos.length} variações
                      </p>
                    </div>
                  </div>

                  {/* Ações - empilhadas no mobile */}
                  <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t">
                    {product.status === 'draft' && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="min-h-[40px] flex-1 sm:flex-none"
                        onClick={() => handleEdit(product)}
                      >
                        <Edit className="w-4 h-4 mr-1" />
                        Editar
                      </Button>
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      className="min-h-[40px] flex-1 sm:flex-none"
                      onClick={() => handleDuplicate(product)}
                    >
                      <Copy className="w-4 h-4 mr-1" />
                      Duplicar
                    </Button>

                    {product.status === 'created' && product.item_id && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="min-h-[40px] flex-1 sm:flex-none"
                        onClick={() => window.open(`https://seller.shopee.com.br/portal/product/${product.item_id}`, '_blank')}
                      >
                        <ExternalLink className="w-4 h-4 mr-1" />
                        <span className="hidden sm:inline">Ver na Shopee</span>
                        <span className="sm:hidden">Shopee</span>
                      </Button>
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      className="min-h-[40px] text-red-600 hover:bg-red-50 hover:text-red-700"
                      onClick={() => handleDelete(product)}
                      disabled={deleting === product.id}
                    >
                      {deleting === product.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <Trash2 className="w-4 h-4 mr-1" />
                          Excluir
                        </>
                      )}
                    </Button>
                  </div>

                  {/* Variações */}
                  <div className="mt-3 pt-3 border-t">
                    <div className="flex flex-wrap gap-1.5">
                      {product.tier_variations.map((tier, tierIndex) => (
                        <div key={tierIndex} className="flex items-center gap-1 flex-wrap">
                          <span className="text-xs text-gray-500">{tier.tier_name}:</span>
                          {tier.options.slice(0, 4).map((opt, optIndex) => (
                            <span
                              key={optIndex}
                              className="px-2 py-0.5 bg-gray-100 rounded text-xs"
                            >
                              {opt.option_name}
                            </span>
                          ))}
                          {tier.options.length > 4 && (
                            <span className="text-xs text-gray-500">
                              +{tier.options.length - 4}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Confirm Dialog */}
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={pendingDeleteProduct?.status === 'created' ? 'Excluir anúncio publicado' : 'Excluir anúncio'}
        description={
          pendingDeleteProduct?.status === 'created'
            ? 'Este anúncio será removido da Shopee e excluído do sistema. Essa ação não pode ser desfeita.'
            : 'Tem certeza que deseja excluir este anúncio? Essa ação não pode ser desfeita.'
        }
        confirmLabel="Excluir"
        variant="destructive"
        onConfirm={confirmDelete}
      />
    </div>
  );
}
