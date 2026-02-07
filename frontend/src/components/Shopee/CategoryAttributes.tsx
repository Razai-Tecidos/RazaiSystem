import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, AlertCircle } from 'lucide-react';
import { auth } from '@/config/firebase';
import { ShopeeCategoryAttribute, ProductAttributeValue } from '@/types/shopee-product.types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

interface CategoryAttributesProps {
  shopId: number;
  categoryId: number;
  values: ProductAttributeValue[];
  onChange: (values: ProductAttributeValue[]) => void;
}

export function CategoryAttributes({ shopId, categoryId, values, onChange }: CategoryAttributesProps) {
  const [attributes, setAttributes] = useState<ShopeeCategoryAttribute[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (shopId && categoryId) {
      loadAttributes();
    }
  }, [shopId, categoryId]);

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
        `${API_BASE}/api/shopee/categories/${categoryId}/attributes?shop_id=${shopId}&mandatory=true`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await response.json();

      if (data.success) {
        setAttributes(data.data || []);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleValueChange = (attributeId: number, valueId?: number, originalValueName?: string) => {
    const existing = values.filter(v => v.attribute_id !== attributeId);
    const newValue: ProductAttributeValue = {
      attribute_id: attributeId,
      attribute_value_list: valueId
        ? [{ value_id: valueId }]
        : originalValueName
        ? [{ original_value_name: originalValueName }]
        : [],
    };
    onChange([...existing, newValue]);
  };

  const getValueForAttribute = (attributeId: number): ProductAttributeValue | undefined => {
    return values.find(v => v.attribute_id === attributeId);
  };

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
      <p className="text-sm text-gray-500">Preencha os atributos obrigatórios para esta categoria</p>

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
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={currentValue?.attribute_value_list?.[0]?.value_id || ''}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    if (val) {
                      handleValueChange(attr.attribute_id, val);
                    }
                  }}
                >
                  <option value="">Selecione...</option>
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
                  onChange={(e) => handleValueChange(attr.attribute_id, undefined, e.target.value)}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
