import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Calculator, Save, X, Info } from 'lucide-react';
import { SkuCost, CreateSkuCostData } from '@/types/shopee-pricing.types';
import { 
  calcularPrecoSugerido, 
  calcularMargemEstimada, 
  calcularTaxasShopee,
  SHOPEE_TAXAS 
} from '@/lib/firebase/shopee-pricing';
import { cn } from '@/lib/utils';

interface SkuCostFormProps {
  shopId: number;
  itemSku: string;
  itemName?: string;
  precoAtual?: number;
  existingCost?: SkuCost | null;
  onSave: (data: CreateSkuCostData) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

export function SkuCostForm({
  shopId,
  itemSku,
  itemName,
  precoAtual,
  existingCost,
  onSave,
  onCancel,
  loading = false,
}: SkuCostFormProps) {
  const [custoUnitario, setCustoUnitario] = useState('');
  const [margemMinima, setMargemMinima] = useState('15');
  const [margemTarget, setMargemTarget] = useState('30');
  const [usaFreteGratis, setUsaFreteGratis] = useState(true);
  const [precoMinimo, setPrecoMinimo] = useState('');
  const [precoMaximo, setPrecoMaximo] = useState('');
  const [automacaoAtiva, setAutomacaoAtiva] = useState(false);

  // Preenche formulário com dados existentes
  useEffect(() => {
    if (existingCost) {
      setCustoUnitario(existingCost.custo_unitario.toString().replace('.', ','));
      setMargemMinima(existingCost.margem_minima.toString());
      setMargemTarget(existingCost.margem_target.toString());
      setUsaFreteGratis(existingCost.usa_frete_gratis ?? true);
      setPrecoMinimo(existingCost.preco_minimo?.toString().replace('.', ',') || '');
      setPrecoMaximo(existingCost.preco_maximo?.toString().replace('.', ',') || '');
      setAutomacaoAtiva(existingCost.automacao_ativa);
    }
  }, [existingCost]);

  // Converte valor brasileiro (vírgula) para número
  const parseNumber = (value: string): number => {
    if (!value.trim()) return 0;
    return parseFloat(value.replace(',', '.'));
  };

  // Formata número para exibição brasileira
  const formatNumber = (value: number): string => {
    return value.toFixed(2).replace('.', ',');
  };

  // Calcula preços sugeridos
  const custoNum = parseNumber(custoUnitario);
  const precoSugeridoMin = custoNum > 0 ? calcularPrecoSugerido(custoNum, parseNumber(margemMinima), usaFreteGratis) : 0;
  const precoSugeridoTarget = custoNum > 0 ? calcularPrecoSugerido(custoNum, parseNumber(margemTarget), usaFreteGratis) : 0;

  // Calcula margem atual (se preço atual disponível) considerando taxas Shopee
  const margemAtual = precoAtual && custoNum > 0
    ? calcularMargemEstimada(precoAtual, custoNum, usaFreteGratis)
    : null;

  // Calcula taxas para o preço atual
  const taxasAtuais = precoAtual ? calcularTaxasShopee(precoAtual, usaFreteGratis) : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const data: CreateSkuCostData = {
      shop_id: shopId,
      item_sku: itemSku,
      custo_unitario: parseNumber(custoUnitario),
      margem_minima: parseNumber(margemMinima),
      margem_target: parseNumber(margemTarget),
      usa_frete_gratis: usaFreteGratis,
      preco_minimo: precoMinimo ? parseNumber(precoMinimo) : undefined,
      preco_maximo: precoMaximo ? parseNumber(precoMaximo) : undefined,
      automacao_ativa: automacaoAtiva,
    };

    await onSave(data);
  };

  const taxaAtual = usaFreteGratis 
    ? SHOPEE_TAXAS.COMISSAO_COM_FRETE_GRATIS * 100 
    : SHOPEE_TAXAS.COMISSAO_SEM_FRETE_GRATIS * 100;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Header */}
      <div className="border-b pb-3">
        <h3 className="text-lg font-semibold text-gray-900">{itemSku}</h3>
        {itemName && (
          <p className="text-sm text-gray-500 truncate">{itemName}</p>
        )}
        {precoAtual && (
          <div className="mt-2 space-y-1">
            <p className="text-sm text-gray-600">
              Preço atual: <span className="font-semibold">R$ {formatNumber(precoAtual)}</span>
              {margemAtual !== null && (
                <span className={cn(
                  'ml-2 text-xs font-medium',
                  margemAtual >= parseNumber(margemTarget) ? 'text-green-600' :
                  margemAtual >= parseNumber(margemMinima) ? 'text-yellow-600' :
                  'text-red-600'
                )}>
                  (margem: {margemAtual.toFixed(1)}%)
                </span>
              )}
            </p>
            {taxasAtuais && (
              <p className="text-xs text-gray-500">
                Taxas Shopee: R$ {formatNumber(taxasAtuais.total)} 
                (comissão R$ {formatNumber(taxasAtuais.comissao)} + taxa R$ {SHOPEE_TAXAS.TAXA_POR_ITEM})
              </p>
            )}
          </div>
        )}
      </div>

      {/* Info taxas Shopee */}
      <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-orange-600 mt-0.5 flex-shrink-0" />
          <div className="text-orange-800">
            <p className="font-medium">Taxas Shopee Brasil</p>
            <p className="text-xs mt-1">
              Comissão: <strong>{usaFreteGratis ? '20%' : '14%'}</strong> (limite R$100) + 
              Taxa fixa: <strong>R$4</strong> por item
            </p>
          </div>
        </div>
      </div>

      {/* Custo unitário */}
      <div>
        <Label htmlFor="custo_unitario">Custo unitário do produto (R$) *</Label>
        <Input
          id="custo_unitario"
          type="text"
          value={custoUnitario}
          onChange={(e) => setCustoUnitario(e.target.value)}
          placeholder="0,00"
          required
          className="mt-1"
        />
        <p className="text-xs text-gray-500 mt-1">
          Quanto você paga pelo produto (sem frete, sem taxas)
        </p>
      </div>

      {/* Programa Frete Grátis */}
      <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
        <input
          type="checkbox"
          id="frete_gratis"
          checked={usaFreteGratis}
          onChange={(e) => setUsaFreteGratis(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300"
        />
        <div>
          <Label htmlFor="frete_gratis" className="text-sm font-medium cursor-pointer">
            Participa do Programa Frete Grátis
          </Label>
          <p className="text-xs text-gray-500">
            {usaFreteGratis 
              ? 'Comissão: 14% + 6% (total 20%)' 
              : 'Comissão: 14%'}
          </p>
        </div>
      </div>

      {/* Margens */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="margem_minima">Margem mínima (%) *</Label>
          <Input
            id="margem_minima"
            type="number"
            value={margemMinima}
            onChange={(e) => setMargemMinima(e.target.value)}
            placeholder="15"
            min="0"
            max="100"
            required
            className="mt-1"
          />
          {precoSugeridoMin > 0 && (
            <p className="text-xs text-gray-500 mt-1">
              Preço sugerido: <strong>R$ {formatNumber(precoSugeridoMin)}</strong>
            </p>
          )}
        </div>
        <div>
          <Label htmlFor="margem_target">Margem target (%) *</Label>
          <Input
            id="margem_target"
            type="number"
            value={margemTarget}
            onChange={(e) => setMargemTarget(e.target.value)}
            placeholder="30"
            min="0"
            max="100"
            required
            className="mt-1"
          />
          {precoSugeridoTarget > 0 && (
            <p className="text-xs text-gray-500 mt-1">
              Preço sugerido: <strong>R$ {formatNumber(precoSugeridoTarget)}</strong>
            </p>
          )}
        </div>
      </div>

      {/* Limites de preço */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="preco_minimo">Preço mínimo (R$)</Label>
          <Input
            id="preco_minimo"
            type="text"
            value={precoMinimo}
            onChange={(e) => setPrecoMinimo(e.target.value)}
            placeholder="Opcional"
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="preco_maximo">Preço máximo (R$)</Label>
          <Input
            id="preco_maximo"
            type="text"
            value={precoMaximo}
            onChange={(e) => setPrecoMaximo(e.target.value)}
            placeholder="Opcional"
            className="mt-1"
          />
        </div>
      </div>

      {/* Automação */}
      <div className="flex items-center gap-2 pt-2">
        <input
          type="checkbox"
          id="automacao"
          checked={automacaoAtiva}
          onChange={(e) => setAutomacaoAtiva(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300"
        />
        <Label htmlFor="automacao" className="text-sm font-normal cursor-pointer">
          Permitir ajuste automático de preço
        </Label>
      </div>

      {/* Calculadora de referência */}
      {custoNum > 0 && (
        <div className="bg-blue-50 rounded-lg p-3 text-sm border border-blue-200">
          <div className="flex items-center gap-2 text-blue-700 mb-2">
            <Calculator className="w-4 h-4" />
            <span className="font-medium">Simulação (taxa {taxaAtual}% + R$4)</span>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-white rounded p-2">
              <span className="text-gray-500 block">Para margem {margemMinima}%:</span>
              <span className="font-bold text-blue-800 text-base">
                R$ {formatNumber(precoSugeridoMin)}
              </span>
            </div>
            <div className="bg-white rounded p-2">
              <span className="text-gray-500 block">Para margem {margemTarget}%:</span>
              <span className="font-bold text-blue-800 text-base">
                R$ {formatNumber(precoSugeridoTarget)}
              </span>
            </div>
          </div>
          {precoSugeridoTarget > 0 && (
            <p className="text-xs text-blue-600 mt-2">
              Lucro líquido estimado: R$ {formatNumber(precoSugeridoTarget - calcularTaxasShopee(precoSugeridoTarget, usaFreteGratis).total - custoNum)} por unidade
            </p>
          )}
        </div>
      )}

      {/* Botões */}
      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          <X className="w-4 h-4 mr-1" />
          Cancelar
        </Button>
        <Button type="submit" disabled={loading || !custoUnitario}>
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-1" />
              Salvar
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
