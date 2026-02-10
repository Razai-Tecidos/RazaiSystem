import { MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import {
  MOBILE_MAIN_PAGE_IDS,
  MOBILE_MORE_PAGE_IDS,
  MODULES,
  PageId,
  getCanonicalActivePage,
} from '@/navigation/modules';

interface MobileBottomNavProps {
  currentPage: PageId;
  onNavigate: (page: PageId) => void;
}

export function MobileBottomNav({ currentPage, onNavigate }: MobileBottomNavProps) {
  const [showMore, setShowMore] = useState(false);
  const activePage = getCanonicalActivePage(currentPage);

  return (
    <>
      {showMore && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/30" onClick={() => setShowMore(false)}>
          <div
            className="absolute bottom-16 left-2 right-2 bg-white rounded-xl shadow-xl border p-2 safe-bottom animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="grid grid-cols-3 gap-1">
              {MOBILE_MORE_PAGE_IDS.map((pageId) => {
                const module = MODULES[pageId];
                return (
                  <button
                    key={pageId}
                    onClick={() => {
                      onNavigate(pageId);
                      setShowMore(false);
                    }}
                    className={cn(
                      'flex flex-col items-center justify-center py-3 px-2 rounded-lg text-xs font-medium transition-colors min-h-[56px]',
                      activePage === pageId
                        ? 'bg-primary/10 text-primary'
                        : 'text-gray-600 hover:bg-gray-100 active:bg-gray-200'
                    )}
                  >
                    {module.shortLabel || module.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 safe-bottom"
        role="navigation"
        aria-label="Navegacao principal"
      >
        <div className="flex items-center justify-around h-16">
          {MOBILE_MAIN_PAGE_IDS.map((pageId) => {
            const module = MODULES[pageId];
            const Icon = module.icon;
            const isActive = activePage === pageId;

            return (
              <button
                key={pageId}
                onClick={() => {
                  onNavigate(pageId);
                  setShowMore(false);
                }}
                className={cn(
                  'flex flex-col items-center justify-center flex-1 h-full min-w-[64px] transition-colors',
                  isActive ? 'text-primary' : 'text-gray-500 active:text-gray-700'
                )}
                aria-label={module.label}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon className={cn('w-5 h-5', isActive && 'scale-110')} />
                <span className="text-[10px] mt-0.5 font-medium">{module.shortLabel || module.label}</span>
              </button>
            );
          })}

          <button
            onClick={() => setShowMore(!showMore)}
            className={cn(
              'flex flex-col items-center justify-center flex-1 h-full min-w-[64px] transition-colors',
              showMore ? 'text-primary' : 'text-gray-500 active:text-gray-700'
            )}
            aria-label="Mais opcoes"
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
