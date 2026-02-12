import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Loader2, Search, AlertCircle } from 'lucide-react';
import { auth } from '@/config/firebase';
import { ShopeeBrand } from '@/types/shopee-product.types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const PREFERRED_BRAND_NAME = 'Razai Tecidos';
const BRAND_PAGE_SIZE = 100;
const BRAND_FETCH_MAX_PAGES = 10;
const BRAND_CACHE_TTL_MS = 15 * 60 * 1000;
const BRAND_CACHE_VERSION = 'v2';

type CachedBrandResult = {
  brands: ShopeeBrand[];
  isMandatory: boolean;
  expiresAt: number;
};

const brandCache = new Map<string, CachedBrandResult>();

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
  const [error, setError] = useState<string | null>(null);

  const normalizeBrandName = (text: string): string =>
    text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();

  const getBrandLabel = (brand: ShopeeBrand): string =>
    (brand.display_brand_name || brand.original_brand_name || '').trim();

  const cacheKey = `${BRAND_CACHE_VERSION}:${shopId}:${categoryId}`;

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
      const cached = brandCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        setBrands(cached.brands);
        setIsMandatory(cached.isMandatory);
        return;
      }

      setLoading(true);
      setError(null);
      const token = await getAuthToken();
      if (!token) return;

      const preferredNormalized = normalizeBrandName(PREFERRED_BRAND_NAME);
      let fallbackBrands: ShopeeBrand[] = [];
      let matchedPreferred: ShopeeBrand | null = null;
      let resolvedMandatory = false;
      let nextOffset = 0;
      let hasMore = true;

      for (let pageIndex = 0; pageIndex < BRAND_FETCH_MAX_PAGES && hasMore && !matchedPreferred; pageIndex += 1) {
        const response = await fetch(
          `${API_BASE}/api/shopee/categories/${categoryId}/brands?shop_id=${shopId}&language=pt-BR&all=false&page_size=${BRAND_PAGE_SIZE}&offset=${nextOffset}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const data = await response.json();

        if (!data.success) {
          setError(data.error || 'Erro ao carregar marcas');
          return;
        }

        const pageBrands: ShopeeBrand[] = data.data?.brands || [];
        if (pageIndex === 0) fallbackBrands = pageBrands;
        resolvedMandatory = Boolean(data.data?.is_mandatory ?? data.data?.isMandatory ?? resolvedMandatory);

        matchedPreferred = pageBrands.find(
          (brand) => normalizeBrandName(getBrandLabel(brand)) === preferredNormalized
        ) || null;

        hasMore = Boolean(data.data?.has_more);
        nextOffset = Number(data.data?.next_offset || 0);
      }

      // Fallback robusto: se nao encontrou na busca paginada, faz varredura completa.
      if (!matchedPreferred) {
        const response = await fetch(
          `${API_BASE}/api/shopee/categories/${categoryId}/brands?shop_id=${shopId}&language=pt-BR&all=true&status=all&page_size=${BRAND_PAGE_SIZE}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const data = await response.json();

        if (data.success) {
          const allBrands: ShopeeBrand[] = data.data?.brands || [];
          resolvedMandatory = Boolean(data.data?.is_mandatory ?? data.data?.isMandatory ?? resolvedMandatory);
          const exhaustiveMatch = allBrands.find(
            (brand) => normalizeBrandName(getBrandLabel(brand)) === preferredNormalized
          ) || null;
          if (exhaustiveMatch) {
            matchedPreferred = exhaustiveMatch;
          } else if (allBrands.length > 0) {
            fallbackBrands = allBrands;
          }
        }
      }

      const finalBrands = matchedPreferred ? [matchedPreferred] : fallbackBrands;
      setBrands(finalBrands);
      setIsMandatory(resolvedMandatory);

      brandCache.set(cacheKey, {
        brands: finalBrands,
        isMandatory: resolvedMandatory,
        expiresAt: Date.now() + BRAND_CACHE_TTL_MS,
      });

      if (matchedPreferred && value !== matchedPreferred.brand_id) {
        onChange(matchedPreferred.brand_id, getBrandLabel(matchedPreferred));
      }
    } catch (err: any) {
      console.error('Erro ao carregar marcas:', err);
      setError(err.message || 'Erro ao carregar marcas');
    } finally {
      setLoading(false);
    }
  };

  const filteredBrands = brands.filter(b =>
    getBrandLabel(b).toLowerCase().includes(searchTerm.toLowerCase())
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

      {error && (
        <div className="flex items-center justify-between rounded-md border border-red-200 bg-red-50 px-3 py-2">
          <div className="flex items-center gap-2 text-red-700 text-xs">
            <AlertCircle className="w-3 h-3" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            className="text-xs text-red-700 underline"
            onClick={loadBrands}
          >
            Tentar novamente
          </button>
        </div>
      )}

      <div className="relative">
        <div
          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm cursor-pointer flex items-center justify-between"
          onClick={() => setIsOpen(!isOpen)}
        >
          <span className={selectedBrand || value === 0 ? 'text-gray-900' : 'text-gray-400'}>
            {value === 0 ? 'Sem marca' : selectedBrand ? getBrandLabel(selectedBrand) : 'Selecione a marca...'}
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
                    onChange(brand.brand_id, getBrandLabel(brand));
                    setIsOpen(false);
                    setSearchTerm('');
                  }}
                >
                  {getBrandLabel(brand)}
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
