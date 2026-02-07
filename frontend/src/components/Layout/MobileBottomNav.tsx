import { Home, Package, Palette, ShoppingBag, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

type PageId = 'home' | 'tecidos' | 'cores' | 'shopee' | 'vinculos' | 'estampas' | 'captura-cor' | 'catalogo' | 'tamanhos' | 'anuncios-shopee' | 'criar-anuncio-shopee' | 'ml-diagnostico';

interface MobileBottomNavProps {
  currentPage: string;
  onNavigate: (page: PageId) => void;
}

const mainItems = [
  { id: 'home' as PageId, label: 'Home', icon: Home },
  { id: 'tecidos' as PageId, label: 'Tecidos', icon: Package },
  { id: 'cores' as PageId, label: 'Cores', icon: Palette },
  { id: 'shopee' as PageId, label: 'Shopee', icon: ShoppingBag },
];

const moreItems = [
  { id: 'estampas' as PageId, label: 'Estampas' },
  { id: 'vinculos' as PageId, label: 'Vínculos' },
  { id: 'catalogo' as PageId, label: 'Catálogo' },
  { id: 'tamanhos' as PageId, label: 'Tamanhos' },
  { id: 'anuncios-shopee' as PageId, label: 'Anúncios' },
  { id: 'captura-cor' as PageId, label: 'Capturar Cor' },
];

export function MobileBottomNav({ currentPage, onNavigate }: MobileBottomNavProps) {
  const [showMore, setShowMore] = useState(false);

  return (
    <>
      {/* Overlay do menu "Mais" */}
      {showMore && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/30" onClick={() => setShowMore(false)}>
          <div 
            className="absolute bottom-16 left-2 right-2 bg-white rounded-xl shadow-xl border p-2 safe-bottom animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="grid grid-cols-3 gap-1">
              {moreItems.map(item => (
                <button
                  key={item.id}
                  onClick={() => { onNavigate(item.id); setShowMore(false); }}
                  className={cn(
                    "flex flex-col items-center justify-center py-3 px-2 rounded-lg text-xs font-medium transition-colors min-h-[56px]",
                    currentPage === item.id
                      ? "bg-primary/10 text-primary"
                      : "text-gray-600 hover:bg-gray-100 active:bg-gray-200"
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 safe-bottom" role="navigation" aria-label="Navegação principal">
        <div className="flex items-center justify-around h-16">
          {mainItems.map(item => {
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => { onNavigate(item.id); setShowMore(false); }}
                className={cn(
                  "flex flex-col items-center justify-center flex-1 h-full min-w-[64px] transition-colors",
                  isActive ? "text-primary" : "text-gray-500 active:text-gray-700"
                )}
                aria-label={item.label}
                aria-current={isActive ? 'page' : undefined}
              >
                <item.icon className={cn("w-5 h-5", isActive && "scale-110")} />
                <span className="text-[10px] mt-0.5 font-medium">{item.label}</span>
              </button>
            );
          })}
          {/* Botão Mais */}
          <button
            onClick={() => setShowMore(!showMore)}
            className={cn(
              "flex flex-col items-center justify-center flex-1 h-full min-w-[64px] transition-colors",
              showMore ? "text-primary" : "text-gray-500 active:text-gray-700"
            )}
            aria-label="Mais opções"
            aria-expanded={showMore}
          >
            <MoreHorizontal className="w-5 h-5" />
            <span className="text-[10px] mt-0.5 font-medium">Mais</span>
          </button>
        </div>
      </nav>
    </>
  );
}
