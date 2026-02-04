import { useState, useCallback } from 'react';
import { auth } from '@/config/firebase';
import { useToast } from '@/hooks/use-toast';

interface SkuFinancialData {
  item_sku: string;
  total_quantity: number;
  total_revenue_gross: number;
  total_revenue_net: number;
  total_commission_fee: number;
  total_service_fee: number;
  orders_count: number;
  avg_price_gross: number;
  avg_price_net: number;
  avg_fee_rate: number;
}

interface SkuSalesData {
  item_sku: string;
  item_name: string;
  total_quantity: number;
  total_revenue: number;
  avg_price: number;
  orders_count: number;
  min_price: number;
  max_price: number;
}

interface FinancialDataResponse {
  overview: {
    total_released_amount: number;
    total_released_order_count: number;
    total_unreleased_amount: number;
    total_unreleased_order_count: number;
  } | null;
  period: {
    from: number;
    to: number;
    days: number;
    from_date: string;
    to_date: string;
  };
  orders_count: number;
  sku_summary: SkuFinancialData[];
}

interface SalesDataResponse {
  period: {
    from: number;
    to: number;
    days: number;
    from_date: string;
    to_date: string;
  };
  orders_count: number;
  sku_summary: SkuSalesData[];
}

interface UseShopeeAnalyticsReturn {
  // Estado
  financialData: FinancialDataResponse | null;
  salesData: SalesDataResponse | null;
  loading: boolean;
  error: string | null;
  
  // Ações
  loadFinancialData: (shopId: number, daysBack?: number) => Promise<void>;
  loadSalesData: (shopId: number, daysBack?: number) => Promise<void>;
  loadAllData: (shopId: number, daysBack?: number) => Promise<void>;
}

export function useShopeeAnalytics(): UseShopeeAnalyticsReturn {
  const [financialData, setFinancialData] = useState<FinancialDataResponse | null>(null);
  const [salesData, setSalesData] = useState<SalesDataResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const apiBase = import.meta.env.VITE_API_URL || window.location.origin;

  const loadFinancialData = useCallback(async (shopId: number, daysBack = 30) => {
    try {
      setLoading(true);
      setError(null);

      const user = auth.currentUser;
      if (!user) {
        throw new Error('Usuário não autenticado');
      }

      const token = await user.getIdToken();
      
      const response = await fetch(`${apiBase}/api/shopee/payment/collect-financial-data`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          shop_id: shopId,
          days_back: daysBack,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'Erro ao carregar dados financeiros');
      }

      setFinancialData(data.data);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar dados financeiros';
      setError(errorMessage);
      toast({
        title: 'Erro',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [apiBase, toast]);

  const loadSalesData = useCallback(async (shopId: number, daysBack = 30) => {
    try {
      setLoading(true);
      setError(null);

      const user = auth.currentUser;
      if (!user) {
        throw new Error('Usuário não autenticado');
      }

      const token = await user.getIdToken();
      
      const response = await fetch(`${apiBase}/api/shopee/orders/collect-sales-data`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          shop_id: shopId,
          days_back: daysBack,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'Erro ao carregar dados de vendas');
      }

      setSalesData(data.data);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar dados de vendas';
      setError(errorMessage);
      toast({
        title: 'Erro',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [apiBase, toast]);

  const loadAllData = useCallback(async (shopId: number, daysBack = 30) => {
    try {
      setLoading(true);
      setError(null);

      const user = auth.currentUser;
      if (!user) {
        throw new Error('Usuário não autenticado');
      }

      const token = await user.getIdToken();
      
      // Carregar ambos em paralelo
      const [financialResponse, salesResponse] = await Promise.all([
        fetch(`${apiBase}/api/shopee/payment/collect-financial-data`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            shop_id: shopId,
            days_back: daysBack,
          }),
        }),
        fetch(`${apiBase}/api/shopee/orders/collect-sales-data`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            shop_id: shopId,
            days_back: daysBack,
          }),
        }),
      ]);

      const [financialJson, salesJson] = await Promise.all([
        financialResponse.json(),
        salesResponse.json(),
      ]);

      if (financialJson?.success) {
        setFinancialData(financialJson.data);
      }

      if (salesJson?.success) {
        setSalesData(salesJson.data);
      }

      if (!financialJson?.success && !salesJson?.success) {
        throw new Error('Erro ao carregar dados');
      }

      toast({
        title: 'Dados carregados',
        description: `Período: ${daysBack} dias`,
      });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar dados';
      setError(errorMessage);
      toast({
        title: 'Erro',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [apiBase, toast]);

  return {
    financialData,
    salesData,
    loading,
    error,
    loadFinancialData,
    loadSalesData,
    loadAllData,
  };
}
