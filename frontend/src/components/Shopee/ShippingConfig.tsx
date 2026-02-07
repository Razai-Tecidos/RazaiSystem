import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Loader2, Truck, AlertCircle } from 'lucide-react';
import { auth } from '@/config/firebase';
import { LogisticsChannel } from '@/types/shopee-product.types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

interface ShippingConfigItem {
  logistic_id: number;
  enabled: boolean;
  shipping_fee?: number;
  is_free?: boolean;
}

interface ShippingConfigProps {
  shopId: number;
  value: ShippingConfigItem[];
  onChange: (config: ShippingConfigItem[]) => void;
}

export function ShippingConfig({ shopId, value, onChange }: ShippingConfigProps) {
  const [channels, setChannels] = useState<LogisticsChannel[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (shopId) {
      loadChannels();
    }
  }, [shopId]);

  const getAuthToken = async (): Promise<string | null> => {
    const user = auth.currentUser;
    if (!user) return null;
    return user.getIdToken();
  };

  const loadChannels = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = await getAuthToken();
      if (!token) return;

      const response = await fetch(
        `${API_BASE}/api/shopee/logistics/enabled?shop_id=${shopId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await response.json();

      if (data.success) {
        const loadedChannels = data.data || [];
        setChannels(loadedChannels);

        // Se não tem config ainda, habilita todos por padrão
        if (value.length === 0 && loadedChannels.length > 0) {
          const defaultConfig = loadedChannels.map((ch: LogisticsChannel) => ({
            logistic_id: ch.logistics_channel_id,
            enabled: true,
          }));
          onChange(defaultConfig);
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleChannel = (logisticId: number) => {
    const existing = value.find(v => v.logistic_id === logisticId);
    if (existing) {
      onChange(value.map(v =>
        v.logistic_id === logisticId ? { ...v, enabled: !v.enabled } : v
      ));
    } else {
      onChange([...value, { logistic_id: logisticId, enabled: true }]);
    }
  };

  const setFreeShipping = (logisticId: number, isFree: boolean) => {
    onChange(value.map(v =>
      v.logistic_id === logisticId ? { ...v, is_free: isFree, shipping_fee: isFree ? 0 : v.shipping_fee } : v
    ));
  };

  const setShippingFee = (logisticId: number, fee: number) => {
    onChange(value.map(v =>
      v.logistic_id === logisticId ? { ...v, shipping_fee: fee, is_free: false } : v
    ));
  };

  const isEnabled = (logisticId: number): boolean => {
    const item = value.find(v => v.logistic_id === logisticId);
    return item?.enabled ?? true;
  };

  const getConfig = (logisticId: number): ShippingConfigItem | undefined => {
    return value.find(v => v.logistic_id === logisticId);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm text-gray-500">Carregando canais de logistica...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 py-4 text-red-600">
        <AlertCircle className="w-4 h-4" />
        <span className="text-sm">{error}</span>
        <Button variant="ghost" size="sm" onClick={loadChannels}>Tentar novamente</Button>
      </div>
    );
  }

  if (channels.length === 0) {
    return (
      <div className="flex items-center gap-2 py-4 text-yellow-600">
        <AlertCircle className="w-4 h-4" />
        <span className="text-sm">Nenhum canal de logistica disponivel</span>
      </div>
    );
  }

  const enabledCount = value.filter(v => v.enabled).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-base font-medium flex items-center gap-2">
            <Truck className="w-4 h-4" />
            Canais de Logistica
          </Label>
          <p className="text-sm text-gray-500">{enabledCount} canal(is) habilitado(s)</p>
        </div>
      </div>

      <div className="space-y-3">
        {channels.map(channel => {
          const config = getConfig(channel.logistics_channel_id);
          const enabled = isEnabled(channel.logistics_channel_id);

          return (
            <div
              key={channel.logistics_channel_id}
              className={`border rounded-lg p-4 transition-colors ${
                enabled ? 'border-blue-200 bg-blue-50/30' : 'border-gray-200 bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={enabled}
                    onCheckedChange={() => toggleChannel(channel.logistics_channel_id)}
                  />
                  <div>
                    <span className="font-medium text-sm">{channel.logistics_channel_name}</span>
                    {channel.logistics_description && (
                      <p className="text-xs text-gray-500">{channel.logistics_description}</p>
                    )}
                    {channel.weight_limit && (
                      <p className="text-xs text-gray-400">
                        Peso: {channel.weight_limit.item_min_weight}-{channel.weight_limit.item_max_weight}kg
                      </p>
                    )}
                  </div>
                </div>

                {enabled && channel.fee_type === 'CUSTOM_PRICE' && (
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={config?.is_free || false}
                        onCheckedChange={(checked) =>
                          setFreeShipping(channel.logistics_channel_id, checked === true)
                        }
                      />
                      Frete gratis
                    </label>
                    {!config?.is_free && (
                      <div className="w-28">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="Taxa (R$)"
                          value={config?.shipping_fee || ''}
                          onChange={(e) =>
                            setShippingFee(channel.logistics_channel_id, parseFloat(e.target.value) || 0)
                          }
                          className="text-sm"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {enabledCount === 0 && (
        <p className="text-sm text-red-600">Pelo menos um canal de logistica deve estar habilitado</p>
      )}
    </div>
  );
}
