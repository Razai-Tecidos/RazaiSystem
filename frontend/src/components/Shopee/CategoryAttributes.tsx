import { useState, useEffect, useRef } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, AlertCircle } from 'lucide-react';
import { auth } from '@/config/firebase';
import { ShopeeCategoryAttribute, ProductAttributeValue } from '@/types/shopee-product.types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

interface TecidoData {
  composicao?: string;  // Ex: "Poliéster e Elastano"
  tipo?: 'liso' | 'estampado';
  largura?: number;     // Em metros, ex: 1.60
  comprimentos?: number[]; // Tamanhos de corte em metros, ex: [0.5, 1, 2, 3]
}

interface CategoryAttributesProps {
  shopId: number;
  categoryId: number;
  values: ProductAttributeValue[];
  onChange: (values: ProductAttributeValue[]) => void;
  tecidoData?: TecidoData;
  onValidationChange?: (state: {
    loading: boolean;
    isValid: boolean;
    mandatoryCount: number;
    filledMandatoryCount: number;
    missingAttributeIds: number[];
  }) => void;
}

// Defaults estaticos (sempre iguais independente do tecido)
// IMPORTANTE: Formatos validados contra itens publicados com sucesso na Shopee
const STATIC_DEFAULT_OPTIONS: Record<string, string[]> = {
  'pais de origem': ['brasil'],
  condicao: ['Novo'],
  quantidade: ['1'],
  'produto personalizado': ['nao', 'não'],
};

const STATIC_DEFAULT_TEXT: Record<string, { value: string; unit?: string }> = {
  'dimensoes do produto': { value: '20 x 20 x 5' },
  'tamanho do pacote': { value: '19', unit: 'CM' },
};

// Mapa de unidades para atributos COMBO_BOX/MULTI_COMBO_BOX que precisam de value_unit
// Chave = nome normalizado do atributo, valor = value_unit a enviar na API
const ATTR_UNITS: Record<string, string> = {
  comprimento: 'm',
  largura: 'm',
};

// Gera defaults dinamicos baseados nos dados do tecido selecionado
function buildDynamicDefaults(tecido?: TecidoData): {
  options: Record<string, string[]>;
  text: Record<string, { value: string; unit?: string }>;
} {
  const options: Record<string, string[]> = { ...STATIC_DEFAULT_OPTIONS };
  const text: Record<string, { value: string; unit?: string }> = { ...STATIC_DEFAULT_TEXT };

  if (tecido?.composicao) {
    // Material vem da composicao do tecido (ex: "Poliéster e Elastano")
    options['material'] = [tecido.composicao];
  }

  if (tecido?.tipo) {
    // Estampa: "Liso" ou "Estampado" conforme o tipo do tecido
    const estampaValue = tecido.tipo === 'liso' ? 'Liso' : 'Estampado';
    options['estampa'] = [estampaValue];
  }

  if (tecido?.largura) {
    // Largura: formato numerico com ponto + unidade "m" (minusculo)
    // Validado: item 41670749631 publicado com value_unit: "m"
    text['largura'] = { value: String(tecido.largura), unit: 'm' };
  }

  if (tecido?.comprimentos && tecido.comprimentos.length > 0) {
    // Comprimento: multi-valor, cada tamanho de corte em metros
    // Validado: item 41620759905 publicado com value_unit: "m" e multiplos valores
    options['comprimento'] = tecido.comprimentos.map((c) => String(c));
  }

  return { options, text };
}

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

function findRuleKey(
  attributeName: string,
  optionKeys: string[],
  textKeys: string[]
): string | null {
  const normalizedName = normalizeText(attributeName);
  const allKeys = [...optionKeys, ...textKeys];
  return allKeys.find((key) => normalizedName.includes(key)) || null;
}

function pickOptionIdsByLabels(
  options: NonNullable<ShopeeCategoryAttribute['attribute_value_list']>,
  desiredLabels: string[],
  allowMany: boolean
): number[] {
  const normalizedDesired = desiredLabels.map(normalizeText);
  const matches = options.filter((option) =>
    normalizedDesired.some((desired) => {
      const optionLabel = normalizeText(option.display_value_name || option.original_value_name || '');
      return desired === optionLabel || desired.includes(optionLabel) || optionLabel.includes(desired);
    })
  );

  if (matches.length === 0) return [];
  if (!allowMany) return [matches[0].value_id];
  return matches.map((option) => option.value_id);
}

// Chaves de atributos cujo valor depende do tecido selecionado
const DYNAMIC_ATTR_KEYS = ['material', 'estampa', 'largura', 'comprimento'];

function hasAttributeValue(attribute?: ProductAttributeValue): boolean {
  if (!attribute?.attribute_value_list || attribute.attribute_value_list.length === 0) {
    return false;
  }

  return attribute.attribute_value_list.some((value) => {
    const originalValue = typeof value.original_value_name === 'string' ? value.original_value_name.trim() : '';
    if (value.value_id !== undefined && value.value_id !== null) {
      // value_id=0 representa valor customizado; sem texto preenchido ainda conta como vazio.
      if (value.value_id === 0) {
        return originalValue.length > 0;
      }
      return value.value_id > 0;
    }
    return originalValue.length > 0;
  });
}

export function CategoryAttributes({ shopId, categoryId, values, onChange, tecidoData, onValidationChange }: CategoryAttributesProps) {
  const [attributes, setAttributes] = useState<ShopeeCategoryAttribute[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs para evitar loop infinito no useEffect de auto-fill
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const valuesRef = useRef(values);
  valuesRef.current = values;
  const tecidoDataRef = useRef(tecidoData);
  tecidoDataRef.current = tecidoData;
  const autoFilledRef = useRef(false);

  useEffect(() => {
    if (shopId && categoryId) {
      autoFilledRef.current = false; // Reset ao trocar categoria
      loadAttributes();
    }
  }, [shopId, categoryId]);

  // Quando tecidoData muda (usuario seleciona outro tecido), limpar campos dinamicos e re-preencher
  const prevTecidoKeyRef = useRef('');
  useEffect(() => {
    const key = tecidoData
      ? `${tecidoData.composicao || ''}|${tecidoData.tipo || ''}|${tecidoData.largura || ''}|${(tecidoData.comprimentos || []).join(',')}`
      : '';
    if (prevTecidoKeyRef.current && key !== prevTecidoKeyRef.current && attributes.length > 0) {
      // Tecido mudou: limpar valores dos campos dinamicos para que o auto-fill preencha com dados novos
      const dynamicAttrIds = attributes
        .filter((attr) => {
          const name = normalizeText(attr.display_attribute_name || attr.original_attribute_name || '');
          return DYNAMIC_ATTR_KEYS.some((k) => name.includes(k));
        })
        .map((attr) => attr.attribute_id);

      if (dynamicAttrIds.length > 0) {
        const cleaned = valuesRef.current.filter((v) => !dynamicAttrIds.includes(v.attribute_id));
        onChangeRef.current(cleaned);
      }
      autoFilledRef.current = false; // Reset para re-preencher com novo tecido
    }
    prevTecidoKeyRef.current = key;
  }, [tecidoData, attributes]);

  useEffect(() => {
    if (!onValidationChange) return;
    const mandatoryAttributes = attributes.filter((attr) => attr.is_mandatory);
    const missingAttributeIds = mandatoryAttributes
      .filter((attr) => !hasAttributeValue(values.find((value) => value.attribute_id === attr.attribute_id)))
      .map((attr) => attr.attribute_id);

    onValidationChange({
      loading,
      isValid: missingAttributeIds.length === 0,
      mandatoryCount: mandatoryAttributes.length,
      filledMandatoryCount: mandatoryAttributes.length - missingAttributeIds.length,
      missingAttributeIds,
    });
  }, [attributes, values, loading, onValidationChange]);

  const getAuthToken = async (): Promise<string | null> => {
    const user = auth.currentUser;
    if (!user) return null;
    return user.getIdToken();
  };

  const loadAttributes = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = await getAuthToken();
      if (!token) return;

      const response = await fetch(
        `${API_BASE}/api/shopee/categories/${categoryId}/attributes?shop_id=${shopId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await response.json();

      if (data.success) {
        setAttributes(data.data || []);
      } else {
        setError(data.error || 'Erro ao carregar atributos da categoria');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleValueChange = (
    attributeId: number,
    valueIds?: number[],
    originalValueName?: string,
    valueUnit?: string
  ) => {
    const existing = values.filter(v => v.attribute_id !== attributeId);
    const newValue: ProductAttributeValue = {
      attribute_id: attributeId,
      attribute_value_list: valueIds && valueIds.length > 0
        ? valueIds.map((valueId) => ({ value_id: valueId }))
        : originalValueName
        ? [{ original_value_name: originalValueName, ...(valueUnit ? { value_unit: valueUnit } : {}) }]
        : [],
    };
    onChange([...existing, newValue]);
  };

  const getValueForAttribute = (attributeId: number): ProductAttributeValue | undefined => {
    return values.find(v => v.attribute_id === attributeId);
  };

  // Auto-fill: roda 1x quando atributos carregam. Usa refs para evitar loop infinito.
  // Tambem re-roda se tecidoData mudar (ex: usuario troca tecido) e ainda nao preencheu.
  useEffect(() => {
    if (loading || attributes.length === 0) return;

    // Gera defaults dinamicos baseados no tecido atual
    const { options: dynamicOptions, text: dynamicText } = buildDynamicDefaults(tecidoDataRef.current);
    const optionKeys = Object.keys(dynamicOptions);
    const textKeys = Object.keys(dynamicText);

    const currentValues = valuesRef.current;
    let changed = false;
    const nextById = new Map<number, ProductAttributeValue>();
    currentValues.forEach((value) => {
      nextById.set(value.attribute_id, value);
    });

    attributes.forEach((attribute) => {
      const existing = currentValues.find((value) => value.attribute_id === attribute.attribute_id);
      // Se ja preenchido por usuario, nao sobrescrever (exceto no primeiro auto-fill)
      if (!autoFilledRef.current && hasAttributeValue(existing)) return;
      // Se ja fez auto-fill, so preenche campos que estao vazios (quando tecido muda)
      if (autoFilledRef.current && hasAttributeValue(existing)) return;

      const ruleKey = findRuleKey(
        attribute.display_attribute_name || attribute.original_attribute_name || '',
        optionKeys,
        textKeys
      );
      if (!ruleKey) return;

      const optionDefaults = dynamicOptions[ruleKey];
      if (optionDefaults && attribute.attribute_value_list && attribute.attribute_value_list.length > 0) {
        // Atributo com opcoes pre-definidas: tentar match por value_id
        const allowMany = attribute.input_type === 'MULTIPLE_SELECT' || attribute.input_type === 'MULTIPLE_SELECT_COMBO_BOX';
        const optionIds = pickOptionIdsByLabels(attribute.attribute_value_list, optionDefaults, allowMany);
        if (optionIds.length > 0) {
          nextById.set(attribute.attribute_id, {
            attribute_id: attribute.attribute_id,
            attribute_value_list: optionIds.map((valueId) => ({ value_id: valueId })),
          });
          changed = true;
          return;
        }
      }

      if (optionDefaults && (!attribute.attribute_value_list || attribute.attribute_value_list.length === 0)) {
        // Atributo COMBO_BOX/TEXT sem opcoes pre-carregadas: enviar como texto livre
        // Para MULTI_COMBO_BOX, envia cada valor como entry separada
        const isMulti = attribute.input_type === 'MULTIPLE_SELECT' || attribute.input_type === 'MULTIPLE_SELECT_COMBO_BOX';
        const attrUnit = ATTR_UNITS[ruleKey];
        const buildValue = (val: string) => ({
          original_value_name: val,
          ...(attrUnit ? { value_unit: attrUnit } : {}),
        });
        if (isMulti) {
          nextById.set(attribute.attribute_id, {
            attribute_id: attribute.attribute_id,
            attribute_value_list: optionDefaults.map(buildValue),
          });
        } else {
          nextById.set(attribute.attribute_id, {
            attribute_id: attribute.attribute_id,
            attribute_value_list: [buildValue(optionDefaults[0])],
          });
        }
        changed = true;
        return;
      }

      const textDefault = dynamicText[ruleKey];
      if (textDefault) {
        nextById.set(attribute.attribute_id, {
          attribute_id: attribute.attribute_id,
          attribute_value_list: [{
            original_value_name: textDefault.value,
            ...(textDefault.unit ? { value_unit: textDefault.unit } : {}),
          }],
        });
        changed = true;
      }
    });

    if (changed) {
      autoFilledRef.current = true;
      onChangeRef.current(Array.from(nextById.values()));
    }
  }, [attributes, loading, tecidoData]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm text-gray-500">Carregando atributos da categoria...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 py-4 text-red-600">
        <AlertCircle className="w-4 h-4" />
        <span className="text-sm">{error}</span>
        <Button variant="ghost" size="sm" onClick={loadAttributes}>Tentar novamente</Button>
      </div>
    );
  }

  if (attributes.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <Label className="text-base font-medium">Atributos da Categoria</Label>
      <p className="text-sm text-gray-500">Preencha os atributos para esta categoria (campos com * são obrigatórios)</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {attributes.map(attr => {
          const currentValue = getValueForAttribute(attr.attribute_id);
          const hasOptions = attr.attribute_value_list && attr.attribute_value_list.length > 0;

          return (
            <div key={attr.attribute_id} className="space-y-1">
              <Label className="text-sm">
                {attr.display_attribute_name}
                {attr.is_mandatory && <span className="text-red-500 ml-1">*</span>}
              </Label>

              {hasOptions ? (
                <select
                  multiple={attr.input_type === 'MULTIPLE_SELECT' || attr.input_type === 'MULTIPLE_SELECT_COMBO_BOX'}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={
                    attr.input_type === 'MULTIPLE_SELECT' || attr.input_type === 'MULTIPLE_SELECT_COMBO_BOX'
                      ? (currentValue?.attribute_value_list?.map((value) => String(value.value_id)).filter(Boolean) as string[])
                      : String(currentValue?.attribute_value_list?.[0]?.value_id || '')
                  }
                  onChange={(e) => {
                    if (attr.input_type === 'MULTIPLE_SELECT' || attr.input_type === 'MULTIPLE_SELECT_COMBO_BOX') {
                      const selectedIds = Array.from(e.target.selectedOptions)
                        .map((option) => parseInt(option.value, 10))
                        .filter((value) => Number.isFinite(value) && value > 0);
                      handleValueChange(attr.attribute_id, selectedIds);
                      return;
                    }

                    const val = parseInt(e.target.value, 10);
                    if (Number.isFinite(val) && val > 0) {
                      handleValueChange(attr.attribute_id, [val]);
                    } else {
                      handleValueChange(attr.attribute_id, []);
                    }
                  }}
                >
                  <option value="">
                    {attr.input_type === 'MULTIPLE_SELECT' || attr.input_type === 'MULTIPLE_SELECT_COMBO_BOX'
                      ? 'Segure CTRL para selecionar mais de uma opcao'
                      : 'Selecione...'}
                  </option>
                  {attr.attribute_value_list!.map(opt => (
                    <option key={opt.value_id} value={opt.value_id}>
                      {opt.display_value_name}
                    </option>
                  ))}
                </select>
              ) : (
                <Input
                  placeholder={`Digite ${attr.display_attribute_name.toLowerCase()}`}
                  value={currentValue?.attribute_value_list?.[0]?.original_value_name || ''}
                  onChange={(e) => handleValueChange(attr.attribute_id, [], e.target.value)}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
