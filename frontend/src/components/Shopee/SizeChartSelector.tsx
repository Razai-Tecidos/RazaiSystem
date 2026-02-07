import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2, Ruler, X } from 'lucide-react';
import { auth } from '@/config/firebase';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

interface SizeChart {
  size_chart_id: number;
  name?: string;
}

interface SizeChartSelectorProps {
  shopId: number;
  categoryId: number;
  value?: number;
  onChange: (sizeChartId: number | undefined) => void;
}

export function SizeChartSelector({ shopId, categoryId, value, onChange }: SizeChartSelectorProps) {
  const [supported, setSupported] = useState(false);
  const [sizeCharts, setSizeCharts] = useState<SizeChart[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (shopId && categoryId) {
      checkSupport();
    }
  }, [shopId, categoryId]);

  const getAuthToken = async (): Promise<string | null> => {
    const user = auth.currentUser;
    if (!user) return null;
    return user.getIdToken();
  };

  const checkSupport = async () => {
    try {
      setLoading(true);
      const token = await getAuthToken();
      if (!token) return;

      const response = await fetch(
        `${API_BASE}/api/shopee/item-limit/size-chart-support?shop_id=${shopId}&category_id=${categoryId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await response.json();

      if (data.success && data.data?.supported) {
        setSupported(true);
        loadSizeCharts(token);
      } else {
        setSupported(false);
      }
    } catch (err) {
      console.error('Erro ao verificar suporte a size chart:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadSizeCharts = async (token: string) => {
    try {
      const response = await fetch(
        `${API_BASE}/api/shopee/item-limit/size-charts?shop_id=${shopId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await response.json();

      if (data.success) {
        setSizeCharts(data.data || []);
      }
    } catch (err) {
      console.error('Erro ao carregar size charts:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm text-gray-500">Verificando tabela de medidas...</span>
      </div>
    );
  }

  if (!supported) {
    return null;
  }

  return (
    <div className="space-y-2">
      <Label className="text-sm flex items-center gap-2">
        <Ruler className="w-4 h-4" />
        Tabela de Medidas (Size Chart)
      </Label>

      {value ? (
        <div className="flex items-center gap-2">
          <span className="px-3 py-2 bg-blue-100 text-blue-800 rounded-lg text-sm">
            Size Chart ID: {value}
          </span>
          <Button variant="ghost" size="sm" onClick={() => onChange(undefined)}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      ) : sizeCharts.length > 0 ? (
        <select
          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value=""
          onChange={(e) => {
            const id = parseInt(e.target.value);
            if (id) onChange(id);
          }}
        >
          <option value="">Selecione uma tabela de medidas...</option>
          {sizeCharts.map(sc => (
            <option key={sc.size_chart_id} value={sc.size_chart_id}>
              {sc.name || `Size Chart #${sc.size_chart_id}`}
            </option>
          ))}
        </select>
      ) : (
        <p className="text-sm text-gray-500">
          Esta categoria suporta tabela de medidas, mas nenhuma foi encontrada.
        </p>
      )}
    </div>
  );
}
