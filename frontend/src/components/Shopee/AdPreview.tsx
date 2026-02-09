import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Eye,
  X,
  ChevronLeft,
  ChevronRight,
  Package,
  Truck,
  Star,
  ShoppingCart,
} from 'lucide-react';
import { WholesaleTier } from '@/types/shopee-product.types';
import { generateBrandOverlay } from '@/lib/brandOverlay';

interface AdPreviewData {
  nome: string;
  descricao: string;
  preco: number;
  imagensPrincipais: string[];
  cores: Array<{ nome: string; hex?: string; imagem?: string }>;
  tamanhos: string[];
  peso: number;
  dimensoes: { comprimento: number; largura: number; altura: number };
  categoria: string;
  condition: string;
  wholesale?: WholesaleTier[];
}

interface AdPreviewProps {
  data: AdPreviewData;
  onClose?: () => void;
}

export function AdPreview({ data, onClose }: AdPreviewProps) {
  const [currentImage, setCurrentImage] = useState(0);
  const [selectedCor, setSelectedCor] = useState(0);
  const [selectedTamanho, setSelectedTamanho] = useState(0);
  const [overlayImages, setOverlayImages] = useState<Record<number, string>>({});

  // Fechar com ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose?.();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Gerar overlays de marca nas imagens de variação
  useEffect(() => {
    data.cores.forEach((cor, i) => {
      if (cor.imagem && !overlayImages[i]) {
        generateBrandOverlay(cor.imagem, cor.nome).then(dataUrl => {
          setOverlayImages(prev => ({ ...prev, [i]: dataUrl }));
        }).catch(() => {
          // Silencioso: se falhar, mostra imagem original
        });
      }
    });
  }, [data.cores]);

  const corImages = data.cores
    .map((c, i) => (c.imagem ? (overlayImages[i] || c.imagem) : null))
    .filter((url): url is string => url !== null);

  const allImages = [
    ...data.imagensPrincipais,
    ...corImages,
  ];

  const nextImage = () => {
    setCurrentImage(prev => (prev + 1) % Math.max(allImages.length, 1));
  };

  const prevImage = () => {
    setCurrentImage(prev => (prev - 1 + allImages.length) % Math.max(allImages.length, 1));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold">Preview do Anuncio</h2>
          </div>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          )}
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Imagens */}
            <div>
              <div className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden">
                {allImages.length > 0 ? (
                  <>
                    <img
                      src={allImages[currentImage]}
                      alt={data.nome}
                      className="w-full h-full object-contain"
                    />
                    {allImages.length > 1 && (
                      <>
                        <button
                          onClick={prevImage}
                          className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 rounded-full p-1 shadow"
                        >
                          <ChevronLeft className="w-5 h-5" />
                        </button>
                        <button
                          onClick={nextImage}
                          className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 rounded-full p-1 shadow"
                        >
                          <ChevronRight className="w-5 h-5" />
                        </button>
                      </>
                    )}
                  </>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-400">
                    <Package className="w-16 h-16" />
                  </div>
                )}
              </div>

              {/* Thumbnails */}
              {allImages.length > 1 && (
                <div className="flex gap-2 mt-3 overflow-x-auto">
                  {allImages.map((img, i) => (
                    <img
                      key={i}
                      src={img}
                      alt=""
                      className={`w-16 h-16 object-cover rounded cursor-pointer border-2 ${
                        i === currentImage ? 'border-blue-500' : 'border-transparent'
                      }`}
                      onClick={() => setCurrentImage(i)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Detalhes */}
            <div className="space-y-4">
              <h1 className="text-xl font-bold text-gray-900">{data.nome}</h1>

              {/* Preco */}
              <div className="bg-orange-50 rounded-lg p-4">
                <span className="text-3xl font-bold text-orange-600">
                  R$ {data.preco.toFixed(2)}
                </span>
              </div>

              {/* Avaliacao fake para preview */}
              <div className="flex items-center gap-2">
                <div className="flex">
                  {[1, 2, 3, 4, 5].map(i => (
                    <Star key={i} className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                  ))}
                </div>
                <span className="text-sm text-gray-500">5.0 | Novo</span>
              </div>

              {/* Frete */}
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Truck className="w-4 h-4" />
                <span>Frete a calcular</span>
              </div>

              {/* Cores */}
              {data.cores.length > 0 && (
                <div>
                  <span className="text-sm font-medium text-gray-700">Cor:</span>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {data.cores.map((cor, i) => (
                      <button
                        key={i}
                        onClick={() => setSelectedCor(i)}
                        className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm ${
                          i === selectedCor
                            ? 'border-orange-500 bg-orange-50'
                            : 'border-gray-200'
                        }`}
                      >
                        {cor.hex && (
                          <span
                            className="w-4 h-4 rounded-full border"
                            style={{ backgroundColor: cor.hex }}
                          />
                        )}
                        {cor.nome}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Tamanhos */}
              {data.tamanhos.length > 0 && (
                <div>
                  <span className="text-sm font-medium text-gray-700">Tamanho:</span>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {data.tamanhos.map((tam, i) => (
                      <button
                        key={i}
                        onClick={() => setSelectedTamanho(i)}
                        className={`px-4 py-2 border rounded-lg text-sm ${
                          i === selectedTamanho
                            ? 'border-orange-500 bg-orange-50'
                            : 'border-gray-200'
                        }`}
                      >
                        {tam}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Atacado */}
              {data.wholesale && data.wholesale.length > 0 && (
                <div className="bg-yellow-50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <ShoppingCart className="w-4 h-4 text-yellow-600" />
                    <span className="text-sm font-medium text-yellow-800">Preco de Atacado</span>
                  </div>
                  <div className="space-y-1">
                    {data.wholesale.map((tier, i) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span className="text-gray-600">
                          {tier.min_count}-{tier.max_count} un.
                        </span>
                        <span className="font-medium text-yellow-800">
                          R$ {tier.unit_price.toFixed(2)}/un.
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Info do produto */}
              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Categoria</span>
                  <span>{data.categoria || '-'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Condicao</span>
                  <span>{data.condition === 'NEW' ? 'Novo' : 'Usado'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Peso</span>
                  <span>{data.peso}kg</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Dimensoes</span>
                  <span>{data.dimensoes.comprimento}x{data.dimensoes.largura}x{data.dimensoes.altura}cm</span>
                </div>
              </div>

              {/* Descricao */}
              <div className="border-t pt-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Descricao</h3>
                <p className="text-sm text-gray-600 whitespace-pre-wrap line-clamp-6">
                  {data.descricao}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50 text-center">
          <p className="text-xs text-gray-500">
            Este e um preview aproximado. A aparencia final pode variar na Shopee.
          </p>
        </div>
      </div>
    </div>
  );
}
