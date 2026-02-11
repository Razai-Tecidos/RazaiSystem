import { ReactNode, useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import {
  Package,
  Palette,
  Camera,
  ChevronRight,
  Image as ImageIcon,
  ShoppingBag,
  Brain,
  Link as LinkIcon,
  BookOpen,
} from 'lucide-react';
import { Tecidos } from './Tecidos';
import { Estampas } from './Estampas';
import { Cores } from './Cores';
import { CapturaCor } from './CapturaCor';
import { Shopee } from './Shopee';
import { MLDiagnostico } from './MLDiagnostico';
import { Vinculos } from './Vinculos';
import { Catalogo } from './Catalogo';
import { AnunciosShopee } from './AnunciosShopee';
import { CriarAnuncioShopee } from './CriarAnuncioShopee';
import { GestaoImagens } from './GestaoImagens';
import { Header } from '@/components/Layout/Header';
import { MobileBottomNav } from '@/components/Layout/MobileBottomNav';
import { DesktopSidebar } from '@/components/Layout/DesktopSidebar';
import { cn } from '@/lib/utils';
import {
  PageId,
  SHORTCUT_PAGE_IDS,
  getCanonicalActivePage,
  isPageId,
} from '@/navigation/modules';
import { getPageFromCurrentHash, syncUrlHashWithPage } from '@/navigation/url-state';

const SIDEBAR_COLLAPSED_STORAGE_KEY = 'desktop_sidebar_collapsed';
const RECENT_PAGES_STORAGE_KEY = 'desktop_recent_pages';

type NavigateOptions = {
  syncHash?: boolean;
  replaceHistory?: boolean;
  clearDraft?: boolean;
};

interface NavCardProps {
  title: string;
  description: string;
  icon: ReactNode;
  onClick: () => void;
  color: 'blue' | 'purple' | 'green' | 'pink' | 'orange';
  delay?: number;
}

function NavCard({ title, description, icon, onClick, color, delay = 0 }: NavCardProps) {
  const colorClasses = {
    blue: 'from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700',
    purple: 'from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700',
    green: 'from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700',
    pink: 'from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700',
    orange: 'from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700',
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        'group w-full text-left p-5 sm:p-6 rounded-xl bg-gradient-to-br text-white shadow-lg',
        'transition-all duration-300 ease-out',
        'hover:shadow-xl hover:-translate-y-1 hover:scale-[1.02]',
        'active:scale-[0.98] active:shadow-md',
        'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-50',
        colorClasses[color],
        color === 'blue' && 'focus:ring-blue-500',
        color === 'purple' && 'focus:ring-purple-500',
        color === 'green' && 'focus:ring-emerald-500',
        color === 'pink' && 'focus:ring-pink-500',
        color === 'orange' && 'focus:ring-orange-500',
        'animate-slide-up'
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="w-12 h-12 rounded-lg bg-white/20 flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110">
            {icon}
          </div>
          <h3 className="text-lg sm:text-xl font-bold mb-1">{title}</h3>
          <p className="text-sm text-white/80">{description}</p>
        </div>
        <ChevronRight className="h-5 w-5 text-white/60 transition-transform duration-300 group-hover:translate-x-1 group-hover:text-white" />
      </div>
    </button>
  );
}

interface AppShellProps {
  currentPage: PageId;
  recentPages: PageId[];
  sidebarCollapsed: boolean;
  onNavigate: (page: PageId, options?: NavigateOptions) => void;
  onToggleSidebar: () => void;
  children: ReactNode;
}

function AppShell({
  currentPage,
  recentPages,
  sidebarCollapsed,
  onNavigate,
  onToggleSidebar,
  children,
}: AppShellProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <DesktopSidebar
        currentPage={currentPage}
        onNavigate={(page) => onNavigate(page)}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={onToggleSidebar}
        recentPages={recentPages}
      />

      <div
        className={cn(
          'min-h-screen transition-[padding-left] duration-200 ease-out',
          sidebarCollapsed ? 'md:pl-20' : 'md:pl-72'
        )}
      >
        <div className="pb-16 md:pb-0">{children}</div>
        <MobileBottomNav currentPage={currentPage} onNavigate={(page) => onNavigate(page)} />
      </div>
    </div>
  );
}

interface HomeProps {
  initialPage?: PageId;
}

function readSidebarCollapsedFromStorage(): boolean {
  const raw = localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY);
  return raw === 'true';
}

function readRecentPagesFromStorage(): PageId[] {
  const raw = localStorage.getItem(RECENT_PAGES_STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value): value is PageId => typeof value === 'string' && isPageId(value));
  } catch {
    return [];
  }
}

function isInputLikeElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') return true;
  return target.isContentEditable;
}

export function Home({ initialPage = 'home' }: HomeProps) {
  const { user } = useAuth();
  const [currentPage, setCurrentPage] = useState<PageId>(initialPage);
  const [editingDraftId, setEditingDraftId] = useState<string | undefined>(undefined);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(readSidebarCollapsedFromStorage);
  const [recentPages, setRecentPages] = useState<PageId[]>(readRecentPagesFromStorage);

  const rememberRecentPage = useCallback((page: PageId) => {
    const canonicalPage = getCanonicalActivePage(page);
    if (canonicalPage === 'home') return;

    setRecentPages((previous) => {
      const next = [canonicalPage, ...previous.filter((existing) => existing !== canonicalPage)].slice(0, 5);
      localStorage.setItem(RECENT_PAGES_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const navigateToPage = useCallback(
    (page: PageId, options?: NavigateOptions) => {
      setCurrentPage(page);

      if (options?.clearDraft !== false) {
        setEditingDraftId(undefined);
      }

      rememberRecentPage(page);

      if (options?.syncHash !== false) {
        syncUrlHashWithPage(page, { replace: options?.replaceHistory });
      }
    },
    [rememberRecentPage]
  );

  useEffect(() => {
    localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  useEffect(() => {
    syncUrlHashWithPage(currentPage, { replace: true });
    // Initial URL sync only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handleHistoryNavigation = () => {
      const pageFromHash = getPageFromCurrentHash();
      const nextPage = pageFromHash ?? 'home';

      if (!pageFromHash && window.location.hash) {
        syncUrlHashWithPage('home', { replace: true });
      }

      if (nextPage !== currentPage) {
        navigateToPage(nextPage, { syncHash: false });
      }
    };

    window.addEventListener('hashchange', handleHistoryNavigation);
    window.addEventListener('popstate', handleHistoryNavigation);

    return () => {
      window.removeEventListener('hashchange', handleHistoryNavigation);
      window.removeEventListener('popstate', handleHistoryNavigation);
    };
  }, [currentPage, navigateToPage]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (window.innerWidth < 768) return;
      if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (isInputLikeElement(event.target)) return;

      const key = event.key.toLowerCase();
      if (key === 'h') {
        event.preventDefault();
        navigateToPage('home');
        return;
      }

      const keyNumber = Number.parseInt(key, 10);
      if (Number.isNaN(keyNumber) || keyNumber < 1 || keyNumber > SHORTCUT_PAGE_IDS.length) return;

      event.preventDefault();
      navigateToPage(SHORTCUT_PAGE_IDS[keyNumber - 1]);
    };

    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [navigateToPage]);

  const handleNavigateHome = () => {
    navigateToPage('home');
  };

  const renderCurrentPage = () => {
    if (currentPage === 'tecidos') {
      return <Tecidos onNavigateHome={handleNavigateHome} />;
    }

    if (currentPage === 'estampas') {
      return (
        <Estampas
          onNavigateHome={handleNavigateHome}
          onNavigateToVinculos={(tecidoId) => {
            navigateToPage('vinculos');
            if (tecidoId) {
              window.setTimeout(() => {
                window.dispatchEvent(
                  new CustomEvent('vinculos:set-tecido-filter', { detail: { tecidoId } })
                );
              }, 0);
            }
          }}
        />
      );
    }

    if (currentPage === 'cores') {
      return (
        <Cores
          onNavigateHome={handleNavigateHome}
          onNavigateToVinculos={() => navigateToPage('vinculos')}
        />
      );
    }

    if (currentPage === 'captura-cor') {
      return <CapturaCor onNavigateHome={handleNavigateHome} />;
    }

    if (currentPage === 'shopee' || currentPage === 'tamanhos') {
      return (
        <Shopee
          onNavigateHome={handleNavigateHome}
          onNavigateToAnuncios={() => navigateToPage('anuncios-shopee', { clearDraft: false })}
        />
      );
    }

    if (currentPage === 'ml-diagnostico') {
      return <MLDiagnostico onNavigateHome={handleNavigateHome} />;
    }

    if (currentPage === 'vinculos') {
      return (
        <Vinculos
          onNavigateHome={handleNavigateHome}
          onNavigateToEstampas={() => navigateToPage('estampas')}
        />
      );
    }

    if (currentPage === 'gestao-imagens') {
      return <GestaoImagens onNavigateHome={handleNavigateHome} />;
    }

    if (currentPage === 'catalogo') {
      return <Catalogo onNavigateHome={handleNavigateHome} />;
    }

    if (currentPage === 'anuncios-shopee') {
      return (
        <AnunciosShopee
          onNavigateHome={handleNavigateHome}
          onNavigateToCriar={(draftId) => {
            setEditingDraftId(draftId);
            navigateToPage('criar-anuncio-shopee', { clearDraft: false });
          }}
        />
      );
    }

    if (currentPage === 'criar-anuncio-shopee') {
      return (
        <CriarAnuncioShopee
          onNavigateHome={handleNavigateHome}
          onNavigateToAnuncios={() => {
            setEditingDraftId(undefined);
            navigateToPage('anuncios-shopee', { clearDraft: false });
          }}
          draftId={editingDraftId}
        />
      );
    }

    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <Header onNavigateHome={handleNavigateHome} />

        <main className="container mx-auto px-4 py-6 sm:py-8 pb-20 md:pb-8 safe-bottom">
          <div className="mb-6 sm:mb-8 animate-fade-in">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">
              {getGreeting()}, {user?.displayName?.split(' ')[0] || 'Usuario'}!
            </h1>
            <p className="text-sm sm:text-base text-gray-600">O que voce gostaria de fazer hoje?</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            <NavCard
              title="Tecidos"
              description="Cadastre tecidos lisos e estampados"
              icon={<Package className="h-6 w-6 text-white" />}
              onClick={() => navigateToPage('tecidos')}
              color="blue"
              delay={0}
            />
            <NavCard
              title="Estampas"
              description="Vincule estampas aos tecidos"
              icon={<ImageIcon className="h-6 w-6 text-white" />}
              onClick={() => navigateToPage('estampas')}
              color="pink"
              delay={100}
            />
            <NavCard
              title="Gerenciar Cores"
              description="Visualize e edite suas cores"
              icon={<Palette className="h-6 w-6 text-white" />}
              onClick={() => navigateToPage('cores')}
              color="purple"
              delay={200}
            />
            <NavCard
              title="Capturar Cor"
              description="Use o colorimetro Bluetooth"
              icon={<Camera className="h-6 w-6 text-white" />}
              onClick={() => navigateToPage('captura-cor')}
              color="green"
              delay={300}
            />
            <NavCard
              title="Shopee"
              description="Integracao com sua loja"
              icon={<ShoppingBag className="h-6 w-6 text-white" />}
              onClick={() => navigateToPage('shopee')}
              color="orange"
              delay={400}
            />
            <NavCard
              title="Vinculos"
              description="Vincule cores a tecidos"
              icon={<LinkIcon className="h-6 w-6 text-white" />}
              onClick={() => navigateToPage('vinculos')}
              color="blue"
              delay={500}
            />
            <NavCard
              title="Gestao de Imagens"
              description="Gere capas e fotos para Shopee"
              icon={<ImageIcon className="h-6 w-6 text-white" />}
              onClick={() => navigateToPage('gestao-imagens')}
              color="pink"
              delay={550}
            />
            <NavCard
              title="Catalogo"
              description="Gere PDF ou link para clientes"
              icon={<BookOpen className="h-6 w-6 text-white" />}
              onClick={() => navigateToPage('catalogo')}
              color="green"
              delay={600}
            />
          </div>

          <div className="mt-4 text-center">
            <button
              onClick={() => navigateToPage('ml-diagnostico')}
              className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              <Brain className="h-4 w-4" />
              Diagnostico ML
            </button>
          </div>

          <div
            className="mt-8 sm:mt-10 p-4 bg-white rounded-xl border border-gray-200 shadow-sm animate-slide-up"
            style={{ animationDelay: '300ms' }}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center text-white font-semibold text-sm">
                {(user?.displayName || user?.email || 'U').charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{user?.displayName || 'Usuario'}</p>
                <p className="text-xs text-gray-500 truncate">{user?.email}</p>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  };

  return (
    <AppShell
      currentPage={currentPage}
      recentPages={recentPages}
      sidebarCollapsed={sidebarCollapsed}
      onNavigate={navigateToPage}
      onToggleSidebar={() => setSidebarCollapsed((previous) => !previous)}
    >
      {renderCurrentPage()}
    </AppShell>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}
