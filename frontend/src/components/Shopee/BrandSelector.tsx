import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Loader2, Search } from 'lucide-react';
import { auth } from '@/config/firebase';
import { ShopeeBrand } from '@/types/shopee-product.types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

interface BrandSelectorProps {
  shopId: number;
  categoryId: number;
  value?: number;
  onChange: (brandId: number | undefined, brandName: string) => void;
  onValidationChange?: (state: {
    loading: boolean;
    isMandatory: boolean;
    isValid: boolean;
  }) => void;
}

export function BrandSelector({ shopId, categoryId, value, onChange, onValidationChange }: BrandSelectorProps) {
  const [brands, setBrands] = useState<ShopeeBrand[]>([]);
  const [loading, setLoading] = useState(false);
  const [isMandatory, setIsMandatory] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (shopId && categoryId) {
      loadBrands();
    }
  }, [shopId, categoryId]);

  useEffect(() => {
    if (!onValidationChange) return;
    const isValid = !isMandatory || (value !== undefined && value !== null && value > 0);
    onValidationChange({
      loading,
      isMandatory,
      isValid,
    });
  }, [loading, isMandatory, value, onValidationChange]);

  useEffect(() => {
    if (isMandatory && value === 0) {
      onChange(undefined, '');
    }
  }, [isMandatory, value, onChange]);

  const getAuthToken = async (): Promise<string | null> => {
    const user = auth.currentUser;
    if (!user) return null;
    return user.getIdToken();
  };

  const loadBrands = async () => {
    try {
      setLoading(true);
      const token = await getAuthToken();
      if (!token) return;

      const response = await fetch(
        `${API_BASE}/api/shopee/categories/${categoryId}/brands?shop_id=${shopId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await response.json();

      if (data.success) {
        setBrands(data.data?.brands || []);
        setIsMandatory(Boolean(data.data?.is_mandatory ?? data.data?.isMandatory));
      }
    } catch (err) {
      console.error('Erro ao carregar marcas:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredBrands = brands.filter(b =>
    b.display_brand_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedBrand = brands.find(b => b.brand_id === value);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm text-gray-500">Carregando marcas...</span>
      </div>
    );
  }

  if (brands.length === 0 && !isMandatory) {
    return null;
  }

  return (
    <div className="space-y-1">
      <Label className="text-sm">
        Marca {isMandatory && <span className="text-red-500">*</span>}
      </Label>

      <div className="relative">
        <div
          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm cursor-pointer flex items-center justify-between"
          onClick={() => setIsOpen(!isOpen)}
        >
          <span className={selectedBrand || value === 0 ? 'text-gray-900' : 'text-gray-400'}>
            {value === 0 ? 'Sem marca' : selectedBrand ? selectedBrand.display_brand_name : 'Selecione a marca...'}
          </span>
          <Search className="w-4 h-4 text-gray-400" />
        </div>

        {isOpen && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-hidden">
            <div className="p-2 border-b">
              <Input
                placeholder="Buscar marca..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                autoFocus
              />
            </div>
            <div className="max-h-48 overflow-y-auto">
              {!isMandatory && (
                <div
                  className={`px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm ${
                    value === 0 ? 'bg-blue-50 text-blue-800' : 'text-gray-500'
                  }`}
                  onClick={() => {
                    onChange(0, 'No Brand');
                    setIsOpen(false);
                    setSearchTerm('');
                  }}
                >
                  Sem marca
                </div>
              )}
              {filteredBrands.map(brand => (
                <div
                  key={brand.brand_id}
                  className={`px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm ${
                    brand.brand_id === value ? 'bg-blue-50 text-blue-800' : ''
                  }`}
                  onClick={() => {
                    onChange(brand.brand_id, brand.display_brand_name);
                    setIsOpen(false);
                    setSearchTerm('');
                  }}
                >
                  {brand.display_brand_name}
                </div>
              ))}
              {filteredBrands.length === 0 && (
                <div className="px-3 py-4 text-sm text-gray-500 text-center">
                  Nenhuma marca encontrada
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
