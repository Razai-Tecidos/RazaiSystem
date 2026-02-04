import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft,
  RefreshCw,
  Plus,
  Upload,
  DollarSign,
  Loader2,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart3,
  Settings,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSkuCosts } from '@/hooks/useSkuCosts';
import { SkuCostList } from './SkuCostList';
import { SkuCostForm } from './SkuCostForm';
import { SkuCostImport } from './SkuCostImport';
import { MarginDashboard } from './MarginDashboard';
import { PricingRulesConfig } from './PricingRulesConfig';
import { SkuCost, CreateSkuCostData } from '@/types/shopee-pricing.types';
import { getMarginStatus } from '@/lib/firebase/shopee-pricing';

interface InventoryItem {
  item_id: string;
  item_sku: string;
  item_name: string;
  models: Array<{
    model_id?: number | string;
    model_name: string;
    total_available_stock: number | null;
    color_option: string | null;
    price_info?: {
      current_price?: number;
      original_price?: number;
    };
  }>;
}

interface ShopeePrecosProps {
  shopId: number;
  inventoryItems?: InventoryItem[];
  onBack: () => void;
}

type ViewMode = 'list' | 'form' | 'import' | 'dashboard' | 'rules';

export function ShopeePrecos({ shopId, inventoryItems = [], onBack }: ShopeePrecosProps) {
  const {
    costs,
    loading,
    error,
    loadCosts,
    saveCost,
    removeCost,
    importCosts,
  } = useSkuCosts();

  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [editingCost, setEditingCost] = useState<SkuCost | null>(null);
  const [selectedSku, setSelectedSku] = useState<string | null>(null);

  // Carrega custos ao montar
  useEffect(() => {
    if (shopId) {
      loadCosts(shopId);
    }
  }, [shopId, loadCosts]);

  // Prepara dados de inventário para a lista
  const inventoryData = useMemo(() => {
    const skuMap = new Map<string, {
      item_sku: string;
      item_name?: string;
      preco_atual?: number;
      vendas_7d?: number;
    }>();

    inventoryItems.forEach((item) => {
      if (!item.item_sku) return;

      // Pega o preço do primeiro modelo (ou média)
      const precos = item.models
        .map((m) => m.price_info?.current_price)
        .filter((p): p is number => typeof p === 'number' && p > 0);

      const precoMedio = precos.length > 0
        ? precos.reduce((a, b) => a + b, 0) / precos.length
        : undefined;

      skuMap.set(item.item_sku, {
        item_sku: item.item_sku,
        item_name: item.item_name,
        preco_atual: precoMedio,
      });
    });

    return Array.from(skuMap.values());
  }, [inventoryItems]);

  // SKUs do inventário que não têm custo cadastrado
  const skusSemCusto = useMemo(() => {
    const cadastrados = new Set(costs.map((c) => c.item_sku));
    return inventoryData.filter((item) => !cadastrados.has(item.item_sku));
  }, [costs, inventoryData]);

  // Estatísticas
  const stats = useMemo(() => {
    let otimo = 0;
    let ok = 0;
    let atencao = 0;
    let critico = 0;
    let semPreco = 0;

    costs.forEach((cost) => {
      const inv = inventoryData.find((i) => i.item_sku === cost.item_sku);
      if (!inv?.preco_atual) {
        semPreco++;
        return;
      }

      const margem = ((inv.preco_atual - cost.custo_unitario) / inv.preco_atual) * 100;
      const status = getMarginStatus(margem, cost.margem_minima, cost.margem_target);

      switch (status) {
        case 'otimo':
          otimo++;
          break;
        case 'ok':
          ok++;
          break;
        case 'atencao':
          atencao++;
          break;
        case 'critico':
          critico++;
          break;
      }
    });

    return { otimo, ok, atencao, critico, semPreco, total: costs.length };
  }, [costs, inventoryData]);

  // Handlers
  const handleEdit = (cost: SkuCost) => {
    setEditingCost(cost);
    setSelectedSku(cost.item_sku);
    setViewMode('form');
  };

  const handleDelete = async (cost: SkuCost) => {
    await removeCost(cost.shop_id, cost.item_sku);
  };

  const handleAddNew = (sku?: string) => {
    setEditingCost(null);
    setSelectedSku(sku || null);
    setViewMode('form');
  };

  const handleSave = async (data: CreateSkuCostData) => {
    const result = await saveCost(data);
    if (result) {
      setViewMode('list');
      setEditingCost(null);
      setSelectedSku(null);
    }
  };

  const handleImport = async (costsData: Array<{
    item_sku: string;
    custo_unitario: number;
    margem_minima?: number;
    margem_target?: number;
  }>) => {
    return await importCosts(shopId, costsData);
  };

  const handleCancel = () => {
    setViewMode('list');
    setEditingCost(null);
    setSelectedSku(null);
  };

  // Busca info do SKU selecionado
  const selectedSkuInfo = selectedSku
    ? inventoryData.find((i) => i.item_sku === selectedSku)
    : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </button>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Gestão de Preços</h1>
          </div>
          <p className="text-gray-500">
            Configure custos e margens por SKU
          </p>
        </div>

        <div className="flex items-center gap-2">
          {(viewMode === 'list' || viewMode === 'dashboard' || viewMode === 'rules') && (
            <>
              {/* Toggle entre lista, dashboard e regras */}
              <div className="flex items-center bg-gray-100 rounded-lg p-1 mr-2">
                <button
                  onClick={() => setViewMode('list')}
                  className={cn(
                    'px-3 py-1 text-sm rounded-md transition-colors flex items-center gap-1',
                    viewMode === 'list'
                      ? 'bg-white shadow text-gray-900 font-medium'
                      : 'text-gray-600 hover:text-gray-900'
                  )}
                >
                  <Settings className="w-3.5 h-3.5" />
                  Custos
                </button>
                <button
                  onClick={() => setViewMode('dashboard')}
                  className={cn(
                    'px-3 py-1 text-sm rounded-md transition-colors flex items-center gap-1',
                    viewMode === 'dashboard'
                      ? 'bg-white shadow text-gray-900 font-medium'
                      : 'text-gray-600 hover:text-gray-900'
                  )}
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  Dashboard
                </button>
                <button
                  onClick={() => setViewMode('rules')}
                  className={cn(
                    'px-3 py-1 text-sm rounded-md transition-colors flex items-center gap-1',
                    viewMode === 'rules'
                      ? 'bg-white shadow text-gray-900 font-medium'
                      : 'text-gray-600 hover:text-gray-900'
                  )}
                >
                  <Zap className="w-3.5 h-3.5" />
                  Regras
                </button>
              </div>
            </>
          )}
          {viewMode === 'list' && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => loadCosts(shopId)}
                disabled={loading}
              >
                <RefreshCw className={cn('w-4 h-4 mr-1.5', loading && 'animate-spin')} />
                Atualizar
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setViewMode('import')}
              >
                <Upload className="w-4 h-4 mr-1.5" />
                Importar
              </Button>
              <Button size="sm" onClick={() => handleAddNew()}>
                <Plus className="w-4 h-4 mr-1.5" />
                Adicionar
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      {viewMode === 'list' && stats.total > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="bg-white rounded-lg border p-3">
            <p className="text-xs text-gray-500">Total SKUs</p>
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          </div>
          <div className="bg-green-50 rounded-lg border border-green-200 p-3">
            <div className="flex items-center gap-1 text-xs text-green-600">
              <TrendingUp className="w-3 h-3" />
              Ótimo
            </div>
            <p className="text-2xl font-bold text-green-700">{stats.otimo}</p>
          </div>
          <div className="bg-blue-50 rounded-lg border border-blue-200 p-3">
            <div className="flex items-center gap-1 text-xs text-blue-600">
              <Minus className="w-3 h-3" />
              OK
            </div>
            <p className="text-2xl font-bold text-blue-700">{stats.ok}</p>
          </div>
          <div className="bg-yellow-50 rounded-lg border border-yellow-200 p-3">
            <div className="flex items-center gap-1 text-xs text-yellow-600">
              <AlertCircle className="w-3 h-3" />
              Atenção
            </div>
            <p className="text-2xl font-bold text-yellow-700">{stats.atencao}</p>
          </div>
          <div className="bg-red-50 rounded-lg border border-red-200 p-3">
            <div className="flex items-center gap-1 text-xs text-red-600">
              <TrendingDown className="w-3 h-3" />
              Crítico
            </div>
            <p className="text-2xl font-bold text-red-700">{stats.critico}</p>
          </div>
        </div>
      )}

      {/* Alerta de SKUs sem custo */}
      {viewMode === 'list' && skusSemCusto.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
            <div>
              <p className="font-medium text-yellow-800">
                {skusSemCusto.length} SKU(s) sem custo cadastrado
              </p>
              <p className="text-sm text-yellow-700 mt-1">
                Configure os custos para calcular margens corretamente.
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                {skusSemCusto.slice(0, 5).map((item) => (
                  <Button
                    key={item.item_sku}
                    size="sm"
                    variant="outline"
                    className="text-xs h-7"
                    onClick={() => handleAddNew(item.item_sku)}
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    {item.item_sku}
                  </Button>
                ))}
                {skusSemCusto.length > 5 && (
                  <span className="text-xs text-yellow-600 self-center">
                    +{skusSemCusto.length - 5} outros
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Conteúdo principal */}
      <div className="bg-white rounded-xl border shadow-sm p-5">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        {viewMode === 'list' && (
          <>
            {loading && costs.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
              </div>
            ) : (
              <SkuCostList
                costs={costs}
                inventoryData={inventoryData}
                onEdit={handleEdit}
                onDelete={handleDelete}
                loading={loading}
              />
            )}
          </>
        )}

        {viewMode === 'form' && (
          <SkuCostForm
            shopId={shopId}
            itemSku={selectedSku || editingCost?.item_sku || ''}
            itemName={selectedSkuInfo?.item_name}
            precoAtual={selectedSkuInfo?.preco_atual}
            existingCost={editingCost}
            onSave={handleSave}
            onCancel={handleCancel}
            loading={loading}
          />
        )}

        {viewMode === 'dashboard' && (
          <MarginDashboard shopId={shopId} />
        )}

        {viewMode === 'rules' && (
          <PricingRulesConfig shopId={shopId} />
        )}

        {viewMode === 'import' && (
          <SkuCostImport
            onImport={handleImport}
            onClose={() => setViewMode('list')}
            loading={loading}
          />
        )}
      </div>
    </div>
  );
}
