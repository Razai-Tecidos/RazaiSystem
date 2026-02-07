import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, ShoppingCart } from 'lucide-react';
import { WholesaleTier } from '@/types/shopee-product.types';

interface WholesaleConfigProps {
  value: WholesaleTier[];
  onChange: (tiers: WholesaleTier[]) => void;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  basePrice: number;
}

export function WholesaleConfig({ value, onChange, enabled, onToggle, basePrice }: WholesaleConfigProps) {
  const addTier = () => {
    const lastTier = value[value.length - 1];
    const newMin = lastTier ? lastTier.max_count + 1 : 2;
    onChange([
      ...value,
      { min_count: newMin, max_count: newMin + 49, unit_price: basePrice * 0.9 },
    ]);
  };

  const removeTier = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const updateTier = (index: number, field: keyof WholesaleTier, val: number) => {
    onChange(value.map((t, i) => i === index ? { ...t, [field]: val } : t));
  };

  const getDiscount = (unitPrice: number): string => {
    if (!basePrice || basePrice === 0) return '0';
    const discount = ((basePrice - unitPrice) / basePrice) * 100;
    return discount.toFixed(1);
  };

  const hasError = (tier: WholesaleTier, index: number): string | null => {
    if (tier.min_count < 2) return 'Quantidade minima deve ser pelo menos 2';
    if (tier.min_count >= tier.max_count) return 'Quantidade minima deve ser menor que maxima';
    if (tier.unit_price <= 0) return 'Preco deve ser maior que zero';
    if (tier.unit_price >= basePrice) return 'Preco de atacado deve ser menor que preco base';
    if (index > 0 && tier.min_count <= value[index - 1].max_count) {
      return 'Faixa sobreposta com a anterior';
    }
    return null;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-base font-medium flex items-center gap-2">
            <ShoppingCart className="w-4 h-4" />
            Atacado (Wholesale)
          </Label>
          <p className="text-xs text-gray-500">Configure precos diferenciados por quantidade</p>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => {
              onToggle(e.target.checked);
              if (!e.target.checked) onChange([]);
            }}
            className="w-4 h-4 rounded"
          />
          <span className="text-sm">Habilitar atacado</span>
        </label>
      </div>

      {enabled && (
        <div className="space-y-3 border rounded-lg p-4">
          {basePrice > 0 && (
            <p className="text-sm text-gray-500">
              Preco base: <strong>R$ {basePrice.toFixed(2)}</strong>
            </p>
          )}

          {value.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-4">
              Adicione faixas de quantidade com precos diferenciados
            </p>
          )}

          {value.map((tier, index) => {
            const error = hasError(tier, index);
            return (
              <div
                key={index}
                className={`flex items-center gap-3 p-3 rounded-lg ${
                  error ? 'bg-red-50 border border-red-200' : 'bg-gray-50'
                }`}
              >
                <span className="text-sm font-medium text-gray-500 w-8">#{index + 1}</span>

                <div className="flex-1 grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">De (qtd)</Label>
                    <Input
                      type="number"
                      min="2"
                      value={tier.min_count}
                      onChange={(e) => updateTier(index, 'min_count', parseInt(e.target.value) || 2)}
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Ate (qtd)</Label>
                    <Input
                      type="number"
                      min={tier.min_count + 1}
                      value={tier.max_count}
                      onChange={(e) => updateTier(index, 'max_count', parseInt(e.target.value) || 0)}
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Preco unitario (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={tier.unit_price}
                      onChange={(e) => updateTier(index, 'unit_price', parseFloat(e.target.value) || 0)}
                      className="text-sm"
                    />
                  </div>
                </div>

                <div className="text-right w-16">
                  <span className="text-xs text-green-600 font-medium">
                    -{getDiscount(tier.unit_price)}%
                  </span>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeTier(index)}
                  className="text-red-500 hover:text-red-700"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>

                {error && (
                  <p className="text-xs text-red-600 col-span-full ml-8">{error}</p>
                )}
              </div>
            );
          })}

          {value.length < 5 && (
            <Button variant="outline" size="sm" onClick={addTier}>
              <Plus className="w-4 h-4 mr-1" />
              Adicionar Faixa
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
