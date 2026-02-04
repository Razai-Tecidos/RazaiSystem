import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Pencil,
  Trash2,
  Search,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Zap,
  ZapOff,
} from 'lucide-react';
import { SkuCost } from '@/types/shopee-pricing.types';
import { getMarginStatus, calcularPrecoSugerido } from '@/lib/firebase/shopee-pricing';
import { cn } from '@/lib/utils';

interface SkuCostListProps {
  costs: SkuCost[];
  inventoryData?: Array<{
    item_sku: string;
    item_name?: string;
    preco_atual?: number;
    vendas_7d?: number;
  }>;
  onEdit: (cost: SkuCost) => void;
  onDelete: (cost: SkuCost) => void;
  loading?: boolean;
}

export function SkuCostList({
  costs,
  inventoryData = [],
  onEdit,
  onDelete,
  loading = false,
}: SkuCostListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedSkus, setExpandedSkus] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // Filtra por busca
  const filteredCosts = costs.filter((cost) =>
    cost.item_sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Formata número para exibição brasileira
  const formatCurrency = (value: number): string => {
    return value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  };

  const formatPercent = (value: number): string => {
    return `${value.toFixed(1)}%`;
  };

  // Busca dados de inventário para um SKU
  const getInventoryInfo = (itemSku: string) => {
    return inventoryData.find((item) => item.item_sku === itemSku);
  };

  // Toggle expansão
  const toggleExpand = (sku: string) => {
    setExpandedSkus((prev) => {
      const next = new Set(prev);
      if (next.has(sku)) {
        next.delete(sku);
      } else {
        next.add(sku);
      }
      return next;
    });
  };

  // Ícones de status
  const StatusIcon = ({ status }: { status: 'otimo' | 'ok' | 'atencao' | 'critico' }) => {
    switch (status) {
      case 'otimo':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'ok':
        return <CheckCircle2 className="w-4 h-4 text-blue-500" />;
      case 'atencao':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'critico':
        return <XCircle className="w-4 h-4 text-red-500" />;
    }
  };

  if (costs.length === 0 && !loading) {
    return (
      <div className="text-center py-8">
        <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500">Nenhum custo cadastrado</p>
        <p className="text-sm text-gray-400 mt-1">
          Cadastre os custos dos seus SKUs para calcular margens
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar por SKU..."
          className="pl-9"
        />
      </div>

      {/* Lista */}
      <div className="space-y-2">
        {filteredCosts.map((cost) => {
          const inventory = getInventoryInfo(cost.item_sku);
          const isExpanded = expandedSkus.has(cost.item_sku);
          
          // Calcula margem bruta se tiver preço atual
          let margemAtual = 0;
          let status: 'otimo' | 'ok' | 'atencao' | 'critico' = 'ok';
          
          if (inventory?.preco_atual && cost.custo_unitario > 0) {
            margemAtual = ((inventory.preco_atual - cost.custo_unitario) / inventory.preco_atual) * 100;
            status = getMarginStatus(margemAtual, cost.margem_minima, cost.margem_target);
          }

          return (
            <div
              key={cost.id}
              className={cn(
                'border rounded-lg bg-white overflow-hidden transition-shadow',
                isExpanded && 'shadow-md'
              )}
            >
              {/* Header */}
              <div
                className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50"
                onClick={() => toggleExpand(cost.item_sku)}
              >
                <div className="flex items-center gap-3">
                  <div className="transition-transform">
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                  
                  <StatusIcon status={status} />
                  
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">{cost.item_sku}</span>
                      {cost.automacao_ativa ? (
                        <span title="Automação ativa">
                          <Zap className="w-3.5 h-3.5 text-yellow-500" />
                        </span>
                      ) : (
                        <span title="Automação desativada">
                          <ZapOff className="w-3.5 h-3.5 text-gray-300" />
                        </span>
                      )}
                    </div>
                    {inventory?.item_name && (
                      <p className="text-xs text-gray-500 truncate max-w-[200px]">
                        {inventory.item_name}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">
                      {formatCurrency(cost.custo_unitario)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatPercent(cost.margem_minima)} - {formatPercent(cost.margem_target)}
                    </p>
                  </div>

                  {inventory?.preco_atual && (
                    <div className="text-right border-l pl-4">
                      <p className="text-sm font-medium text-gray-900">
                        {formatCurrency(inventory.preco_atual)}
                      </p>
                      <p className={cn(
                        'text-xs font-medium',
                        status === 'otimo' && 'text-green-600',
                        status === 'ok' && 'text-blue-600',
                        status === 'atencao' && 'text-yellow-600',
                        status === 'critico' && 'text-red-600'
                      )}>
                        {formatPercent(margemAtual)}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Detalhes expandidos */}
              {isExpanded && (
                <div className="border-t bg-gray-50 p-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500 text-xs">Custo unitário</p>
                      <p className="font-medium">{formatCurrency(cost.custo_unitario)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Programa Frete Grátis</p>
                      <p className="font-medium">
                        {cost.usa_frete_gratis !== false ? 'Sim (20%)' : 'Não (14%)'}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Margem mínima</p>
                      <p className="font-medium">{formatPercent(cost.margem_minima)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Margem target</p>
                      <p className="font-medium">{formatPercent(cost.margem_target)}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm mt-3">
                    <div>
                      <p className="text-gray-500 text-xs">Preço mínimo</p>
                      <p className="font-medium">
                        {cost.preco_minimo ? formatCurrency(cost.preco_minimo) : '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Preço máximo</p>
                      <p className="font-medium">
                        {cost.preco_maximo ? formatCurrency(cost.preco_maximo) : '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Preço sugerido (min)</p>
                      <p className="font-medium">
                        {formatCurrency(calcularPrecoSugerido(cost.custo_unitario, cost.margem_minima))}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Preço sugerido (target)</p>
                      <p className="font-medium">
                        {formatCurrency(calcularPrecoSugerido(cost.custo_unitario, cost.margem_target))}
                      </p>
                    </div>
                  </div>

                  {/* Ações */}
                  <div className="flex justify-end gap-2 mt-4 pt-3 border-t">
                    {confirmDelete === cost.id ? (
                      <>
                        <span className="text-sm text-red-600 mr-2">Confirmar exclusão?</span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDelete(null);
                          }}
                        >
                          Não
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDelete(cost);
                            setConfirmDelete(null);
                          }}
                        >
                          Sim, excluir
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEdit(cost);
                          }}
                        >
                          <Pencil className="w-4 h-4 mr-1" />
                          Editar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDelete(cost.id);
                          }}
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          Excluir
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filteredCosts.length === 0 && searchTerm && (
        <p className="text-center text-gray-500 py-4">
          Nenhum SKU encontrado para "{searchTerm}"
        </p>
      )}
    </div>
  );
}
