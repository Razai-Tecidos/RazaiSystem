import { ChevronLeft, ChevronRight, Clock3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DESKTOP_GROUPS,
  MODULES,
  PageId,
  getCanonicalActivePage,
} from '@/navigation/modules';

interface DesktopSidebarProps {
  currentPage: PageId;
  onNavigate: (page: PageId) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  recentPages: PageId[];
}

function ModuleButton({
  pageId,
  activePage,
  collapsed,
  onNavigate,
}: {
  pageId: PageId;
  activePage: PageId;
  collapsed: boolean;
  onNavigate: (page: PageId) => void;
}) {
  const module = MODULES[pageId];
  const Icon = module.icon;
  const isActive = activePage === pageId;

  const button = (
    <button
      type="button"
      onClick={() => onNavigate(pageId)}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'w-full flex items-center rounded-lg transition-colors',
        'text-sm font-medium',
        collapsed ? 'justify-center px-2 py-2.5' : 'justify-start gap-3 px-3 py-2.5',
        isActive ? 'bg-primary text-primary-foreground shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
      )}
    >
      <Icon className={cn('h-4 w-4 shrink-0', !collapsed && 'ml-0.5')} />
      {!collapsed && <span className="truncate">{module.label}</span>}
      {!collapsed && module.shortcut && (
        <span className="ml-auto text-[10px] text-gray-400">{module.shortcut}</span>
      )}
    </button>
  );

  if (!collapsed) return button;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side="right">
        <p>{module.label}</p>
      </TooltipContent>
    </Tooltip>
  );
}

export function DesktopSidebar({
  currentPage,
  onNavigate,
  collapsed,
  onToggleCollapsed,
  recentPages,
}: DesktopSidebarProps) {
  const activePage = getCanonicalActivePage(currentPage);

  return (
    <aside
      className={cn(
        'hidden md:flex fixed left-0 top-0 z-40 h-screen border-r border-gray-200 bg-white flex-col',
        'transition-[width] duration-200 ease-out',
        collapsed ? 'w-20' : 'w-72'
      )}
    >
      <TooltipProvider delayDuration={100}>
        <div className={cn('flex items-center border-b border-gray-200 px-3 py-3.5', collapsed ? 'justify-center' : 'justify-between')}>
          {!collapsed && (
            <button type="button" onClick={() => onNavigate('home')} className="hover:opacity-80 transition-opacity">
              <img src="/Razai.svg" alt="Razai" className="h-8 w-auto" />
            </button>
          )}
          {collapsed && (
            <button type="button" onClick={() => onNavigate('home')} className="hover:opacity-80 transition-opacity">
              <img src="/RazaiB.svg" alt="Razai" className="h-8 w-auto" />
            </button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onToggleCollapsed}
            className="h-8 w-8 text-gray-500 hover:text-gray-900"
            aria-label={collapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>

        <nav className="flex-1 overflow-y-auto desktop-sidebar-scroll px-3 py-4 space-y-4" role="navigation" aria-label="Navegacao principal desktop">
          {DESKTOP_GROUPS.map((group) => (
            <div key={group.id} className="space-y-1.5">
              {!collapsed && (
                <p className="px-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                  {group.label}
                </p>
              )}
              <div className="space-y-1">
                {group.pages
                  .filter((pageId) => MODULES[pageId].desktopVisible)
                  .map((pageId) => (
                    <ModuleButton
                      key={pageId}
                      pageId={pageId}
                      activePage={activePage}
                      collapsed={collapsed}
                      onNavigate={onNavigate}
                    />
                  ))}
              </div>
            </div>
          ))}

          {recentPages.length > 0 && (
            <div className="space-y-1.5 pt-2 border-t border-gray-100">
              {!collapsed && (
                <p className="px-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                  Recentes
                </p>
              )}
              <div className="space-y-1">
                {recentPages.map((pageId) => {
                  const module = MODULES[pageId];
                  const Icon = module.icon;
                  const isActive = activePage === pageId;

                  const recentButton = (
                    <button
                      key={pageId}
                      type="button"
                      onClick={() => onNavigate(pageId)}
                      aria-current={isActive ? 'page' : undefined}
                      className={cn(
                        'w-full rounded-lg transition-colors text-xs',
                        collapsed ? 'px-2 py-2.5 flex items-center justify-center' : 'px-3 py-2 flex items-center gap-2',
                        isActive ? 'bg-primary/10 text-primary' : 'text-gray-600 hover:bg-gray-100'
                      )}
                    >
                      {collapsed ? (
                        <Icon className="h-4 w-4" />
                      ) : (
                        <>
                          <Clock3 className="h-3.5 w-3.5 text-gray-400" />
                          <span className="truncate">{module.label}</span>
                        </>
                      )}
                    </button>
                  );

                  if (!collapsed) return recentButton;
                  return (
                    <Tooltip key={pageId}>
                      <TooltipTrigger asChild>{recentButton}</TooltipTrigger>
                      <TooltipContent side="right">
                        <p>{module.label}</p>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            </div>
          )}
        </nav>
      </TooltipProvider>
    </aside>
  );
}
