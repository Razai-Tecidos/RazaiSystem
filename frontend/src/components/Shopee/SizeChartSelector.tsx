import { useState, useEffect, useRef } from 'react';
import { Label } from '@/components/ui/label';
import { Loader2, Ruler, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { auth } from '@/config/firebase';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

interface SizeChart {
  size_chart_id: number;
}

interface SizeChartSelectorProps {
  shopId: number;
  categoryId: number;
  value?: number;
  onChange: (sizeChartId: number | undefined) => void;
  onValidationChange?: (state: {
    loading: boolean;
    supported: boolean;
    hasSizeCharts: boolean;
    isValid: boolean;
  }) => void;
}

export function SizeChartSelector({ shopId, categoryId, value, onChange, onValidationChange }: SizeChartSelectorProps) {
  const [supported, setSupported] = useState(false);
  const [sizeCharts, setSizeCharts] = useState<SizeChart[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoSelectedRef = useRef(false);

  useEffect(() => {
    if (shopId && categoryId) {
      autoSelectedRef.current = false;
      checkSupportAndLoad();
    }
  }, [shopId, categoryId]);

  // Validation reporting
  useEffect(() => {
    if (!onValidationChange) return;
    const hasSizeCharts = sizeCharts.length > 0;
    const isValuePresent = value !== undefined && value !== null;
    const isKnownValue = !isValuePresent || !hasSizeCharts || sizeCharts.some((chart) => chart.size_chart_id === value);
    onValidationChange({
      loading,
      supported,
      hasSizeCharts,
      isValid: isKnownValue,
    });
  }, [loading, supported, sizeCharts, value, onValidationChange]);

  // Clear value if not supported
  useEffect(() => {
    if (!supported && value !== undefined) {
      onChange(undefined);
    }
  }, [supported, value, onChange]);

  // Auto-select first size chart when charts load
  useEffect(() => {
    if (!supported || sizeCharts.length === 0) return;
    if (autoSelectedRef.current) return;
    if (value !== undefined && value !== null) return;

    // Auto-selecionar a primeira tabela disponivel
    autoSelectedRef.current = true;
    onChange(sizeCharts[0].size_chart_id);
  }, [sizeCharts, supported, value, onChange]);

  const getAuthToken = async (): Promise<string | null> => {
    const user = auth.currentUser;
    if (!user) return null;
    return user.getIdToken();
  };

  const checkSupportAndLoad = async () => {
    try {
      setLoading(true);
      setError(null);
      setSizeCharts([]);
      setSupported(false);
      const token = await getAuthToken();
      if (!token) return;

      // 1. Verificar suporte
      const supportResp = await fetch(
        `${API_BASE}/api/shopee/item-limit/size-chart-support?shop_id=${shopId}&category_id=${categoryId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const supportData = await supportResp.json();

      if (!supportData.success || !supportData.data?.supported) {
        setSupported(false);
        return;
      }

      setSupported(true);

      // 2. Carregar lista de size charts
      const chartsResp = await fetch(
        `${API_BASE}/api/shopee/item-limit/size-charts?shop_id=${shopId}&category_id=${categoryId}&page_size=50`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const chartsData = await chartsResp.json();

      if (chartsData.success) {
        setSizeCharts(chartsData.data || []);
      } else {
        setError(chartsData.error || 'Erro ao carregar tabelas de medidas');
      }
    } catch (err: any) {
      console.error('Erro ao verificar/carregar size charts:', err);
      setError(err.message || 'Erro ao carregar tabelas de medidas');
    } finally {
      setLoading(false);
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

  if (error) {
    return (
      <div className="flex items-center gap-2 py-2 text-red-600">
        <AlertCircle className="w-4 h-4" />
        <span className="text-sm">{error}</span>
        <Button variant="ghost" size="sm" onClick={checkSupportAndLoad}>Tentar novamente</Button>
      </div>
    );
  }

  if (!supported || sizeCharts.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <Label className="text-sm flex items-center gap-2">
        <Ruler className="w-4 h-4" />
        Tabela de Medidas
      </Label>

      <select
        className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        value={value !== undefined && value !== null ? String(value) : ''}
        onChange={(e) => {
          const id = parseInt(e.target.value, 10);
          if (Number.isFinite(id) && id > 0) {
            onChange(id);
          } else {
            onChange(undefined);
          }
        }}
      >
        <option value="">Nenhuma tabela selecionada</option>
        {sizeCharts.map((sc, index) => (
          <option key={sc.size_chart_id} value={sc.size_chart_id}>
            Tabela de Medidas {sizeCharts.length > 1 ? `#${index + 1}` : ''} (ID: {sc.size_chart_id})
          </option>
        ))}
      </select>
    </div>
  );
}
