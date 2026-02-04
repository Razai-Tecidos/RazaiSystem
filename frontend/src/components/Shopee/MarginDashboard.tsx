import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import {
  RefreshCw,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Package,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Calendar,
  BarChart3,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useShopeeAnalytics } from '@/hooks/useShopeeAnalytics';
import { useSkuCosts } from '@/hooks/useSkuCosts';
import { SkuCost } from '@/types/shopee-pricing.types';
import { getMarginStatus, calcularMargemReal } from '@/lib/firebase/shopee-pricing';

interface MarginDashboardProps {
  shopId: number;
}

type PeriodOption = 7 | 15 | 30;

interface SkuMarginData {
  item_sku: string;
  item_name: string;
  // Custo cadastrado
  custo_unitario: number;
  margem_minima: number;
  margem_target: number;
  // Dados de vendas
  quantidade_vendida: number;
  receita_bruta: number;
  receita_liquida: number;
  preco_medio: number;
  // Cálculos
  margem_real: number;
  lucro_total: number;
  status: 'otimo' | 'ok' | 'atencao' | 'critico';
}

export function MarginDashboard({ shopId }: MarginDashboardProps) {
  const [period, setPeriod] = useState<PeriodOption>(30);
  const { financialData, salesData, loading, error, loadAllData } = useShopeeAnalytics();
  const { costs, loadCosts, loading: costsLoading } = useSkuCosts();

  // Carregar dados ao montar e quando o período mudar
  useEffect(() => {
    if (shopId) {
      loadCosts(shopId);
      loadAllData(shopId, period);
    }
  }, [shopId, period, loadCosts, loadAllData]);

  // Combinar dados de custos com dados financeiros/vendas
  const marginData = useMemo<SkuMarginData[]>(() => {
    if (!costs.length) return [];

    const costsMap = new Map<string, SkuCost>();
    costs.forEach(c => costsMap.set(c.item_sku, c));

    const financialMap = new Map<string, {
      total_quantity: number;
      total_revenue_gross: number;
      total_revenue_net: number;
    }>();
    
    financialData?.sku_summary?.forEach(f => {
      financialMap.set(f.item_sku, {
        total_quantity: f.total_quantity,
        total_revenue_gross: f.total_revenue_gross,
        total_revenue_net: f.total_revenue_net,
      });
    });

    const salesMap = new Map<string, { item_name: string; avg_price: number }>();
    salesData?.sku_summary?.forEach(s => {
      salesMap.set(s.item_sku, {
        item_name: s.item_name,
        avg_price: s.avg_price,
      });
    });

    // Criar lista combinada
    const result: SkuMarginData[] = [];

    costs.forEach(cost => {
      const financial = financialMap.get(cost.item_sku);
      const sales = salesMap.get(cost.item_sku);

      const quantidade = financial?.total_quantity || 0;
      const receitaBruta = financial?.total_revenue_gross || 0;
      const receitaLiquida = financial?.total_revenue_net || 0;
      const precoMedio = sales?.avg_price || (quantidade > 0 ? receitaBruta / quantidade : 0);

      // Calcular margem real
      const margemReal = quantidade > 0
        ? calcularMargemReal(receitaLiquida, quantidade, cost.custo_unitario, precoMedio)
        : 0;

      // Calcular lucro total
      const lucroTotal = quantidade > 0
        ? receitaLiquida - (cost.custo_unitario * quantidade)
        : 0;

      // Determinar status
      const status = quantidade > 0
        ? getMarginStatus(margemReal, cost.margem_minima, cost.margem_target)
        : 'ok';

      result.push({
        item_sku: cost.item_sku,
        item_name: sales?.item_name || '',
        custo_unitario: cost.custo_unitario,
        margem_minima: cost.margem_minima,
        margem_target: cost.margem_target,
        quantidade_vendida: quantidade,
        receita_bruta: receitaBruta,
        receita_liquida: receitaLiquida,
        preco_medio: precoMedio,
        margem_real: margemReal,
        lucro_total: lucroTotal,
        status,
      });
    });

    // Ordenar por lucro total (decrescente)
    result.sort((a, b) => b.lucro_total - a.lucro_total);

    return result;
  }, [costs, financialData, salesData]);

  // Estatísticas resumidas
  const stats = useMemo(() => {
    const totalLucro = marginData.reduce((acc, m) => acc + m.lucro_total, 0);
    const totalReceita = marginData.reduce((acc, m) => acc + m.receita_liquida, 0);
    const totalVendas = marginData.reduce((acc, m) => acc + m.quantidade_vendida, 0);
    
    const comVendas = marginData.filter(m => m.quantidade_vendida > 0);
    const margemMedia = comVendas.length > 0
      ? comVendas.reduce((acc, m) => acc + m.margem_real, 0) / comVendas.length
      : 0;

    const statusCount = {
      otimo: marginData.filter(m => m.status === 'otimo').length,
      ok: marginData.filter(m => m.status === 'ok').length,
      atencao: marginData.filter(m => m.status === 'atencao').length,
      critico: marginData.filter(m => m.status === 'critico').length,
    };

    return { totalLucro, totalReceita, totalVendas, margemMedia, statusCount };
  }, [marginData]);

  const formatCurrency = (value: number): string => {
    return value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  };

  const formatPercent = (value: number): string => {
    return `${value.toFixed(1)}%`;
  };

  const isLoading = loading || costsLoading;

  return (
    <div className="space-y-6">
      {/* Header com controles */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Dashboard de Margem</h2>
            <p className="text-sm text-gray-500">
              {financialData?.period?.from_date 
                ? `${new Date(financialData.period.from_date).toLocaleDateString('pt-BR')} - ${new Date(financialData.period.to_date).toLocaleDateString('pt-BR')}`
                : 'Carregando período...'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Seletor de período */}
          <div className="flex items-center bg-gray-100 rounded-lg p-1">
            {([7, 15, 30] as PeriodOption[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={cn(
                  'px-3 py-1 text-sm rounded-md transition-colors',
                  period === p
                    ? 'bg-white shadow text-gray-900 font-medium'
                    : 'text-gray-600 hover:text-gray-900'
                )}
              >
                {p}d
              </button>
            ))}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => loadAllData(shopId, period)}
            disabled={isLoading}
          >
            <RefreshCw className={cn('w-4 h-4 mr-1.5', isLoading && 'animate-spin')} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
            <DollarSign className="w-4 h-4" />
            Lucro Total
          </div>
          <p className={cn(
            'text-2xl font-bold',
            stats.totalLucro >= 0 ? 'text-green-600' : 'text-red-600'
          )}>
            {formatCurrency(stats.totalLucro)}
          </p>
        </div>

        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
            <TrendingUp className="w-4 h-4" />
            Receita Líquida
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {formatCurrency(stats.totalReceita)}
          </p>
        </div>

        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
            <Package className="w-4 h-4" />
            Unidades Vendidas
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {stats.totalVendas.toLocaleString('pt-BR')}
          </p>
        </div>

        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
            <BarChart3 className="w-4 h-4" />
            Margem Média
          </div>
          <p className={cn(
            'text-2xl font-bold',
            stats.margemMedia >= 20 ? 'text-green-600' :
            stats.margemMedia >= 10 ? 'text-yellow-600' :
            'text-red-600'
          )}>
            {formatPercent(stats.margemMedia)}
          </p>
        </div>
      </div>

      {/* Status cards pequenos */}
      <div className="flex flex-wrap gap-2">
        <div className="flex items-center gap-1.5 bg-green-50 text-green-700 text-sm px-3 py-1 rounded-full">
          <CheckCircle2 className="w-3.5 h-3.5" />
          {stats.statusCount.otimo} ótimo
        </div>
        <div className="flex items-center gap-1.5 bg-blue-50 text-blue-700 text-sm px-3 py-1 rounded-full">
          <CheckCircle2 className="w-3.5 h-3.5" />
          {stats.statusCount.ok} ok
        </div>
        <div className="flex items-center gap-1.5 bg-yellow-50 text-yellow-700 text-sm px-3 py-1 rounded-full">
          <AlertTriangle className="w-3.5 h-3.5" />
          {stats.statusCount.atencao} atenção
        </div>
        <div className="flex items-center gap-1.5 bg-red-50 text-red-700 text-sm px-3 py-1 rounded-full">
          <TrendingDown className="w-3.5 h-3.5" />
          {stats.statusCount.critico} crítico
        </div>
      </div>

      {/* Erro */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
          <span className="ml-2 text-gray-500">Carregando dados...</span>
        </div>
      )}

      {/* Tabela de SKUs */}
      {!isLoading && marginData.length > 0 && (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">SKU</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Custo</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Preço Médio</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Qtd</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Receita Líq.</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Margem</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Lucro</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {marginData.map((sku) => (
                  <tr key={sku.item_sku} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-gray-900">{sku.item_sku}</p>
                        {sku.item_name && (
                          <p className="text-xs text-gray-500 truncate max-w-[150px]">
                            {sku.item_name}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {formatCurrency(sku.custo_unitario)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-900 font-medium">
                      {sku.quantidade_vendida > 0 ? formatCurrency(sku.preco_medio) : '-'}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {sku.quantidade_vendida.toLocaleString('pt-BR')}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-900">
                      {formatCurrency(sku.receita_liquida)}
                    </td>
                    <td className={cn(
                      'px-4 py-3 text-right font-medium',
                      sku.status === 'otimo' && 'text-green-600',
                      sku.status === 'ok' && 'text-blue-600',
                      sku.status === 'atencao' && 'text-yellow-600',
                      sku.status === 'critico' && 'text-red-600'
                    )}>
                      {sku.quantidade_vendida > 0 ? formatPercent(sku.margem_real) : '-'}
                      <span className="text-xs text-gray-400 ml-1">
                        ({formatPercent(sku.margem_minima)}-{formatPercent(sku.margem_target)})
                      </span>
                    </td>
                    <td className={cn(
                      'px-4 py-3 text-right font-medium',
                      sku.lucro_total >= 0 ? 'text-green-600' : 'text-red-600'
                    )}>
                      {formatCurrency(sku.lucro_total)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {sku.status === 'otimo' && (
                        <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="w-3 h-3" /> Ótimo
                        </span>
                      )}
                      {sku.status === 'ok' && (
                        <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="w-3 h-3" /> OK
                        </span>
                      )}
                      {sku.status === 'atencao' && (
                        <span className="inline-flex items-center gap-1 bg-yellow-100 text-yellow-700 text-xs px-2 py-0.5 rounded-full">
                          <AlertTriangle className="w-3 h-3" /> Atenção
                        </span>
                      )}
                      {sku.status === 'critico' && (
                        <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full">
                          <TrendingDown className="w-3 h-3" /> Crítico
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && marginData.length === 0 && costs.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p>Nenhum custo cadastrado</p>
          <p className="text-sm">Cadastre os custos dos SKUs para ver a análise de margem</p>
        </div>
      )}

      {!isLoading && marginData.length === 0 && costs.length > 0 && (
        <div className="text-center py-8 text-gray-500">
          <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p>Sem vendas no período selecionado</p>
          <p className="text-sm">Tente selecionar um período maior</p>
        </div>
      )}
    </div>
  );
}
