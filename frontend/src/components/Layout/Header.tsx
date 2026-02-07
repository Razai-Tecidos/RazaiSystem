import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { LogOut, User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HeaderProps {
  onNavigateHome?: () => void;
}

export function Header({ onNavigateHome }: HeaderProps) {
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    }
  };

  return (
    <header className="bg-white shadow-sm sticky top-0 z-50 safe-top animate-slide-down">
      <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4">
        <div className="flex justify-between items-center gap-2">
          {/* Logo */}
          <button
            onClick={onNavigateHome}
            className={cn(
              "transition-all duration-200",
              onNavigateHome && "hover:opacity-80 active:scale-95 cursor-pointer"
            )}
            aria-label="Ir para página inicial"
          >
            <img 
              src="/Razai.svg" 
              alt="Razai" 
              className="h-8 sm:h-10 w-auto"
            />
          </button>

          {/* User info e logout */}
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Avatar/Email - esconde email em mobile */}
            <div className="flex items-center gap-2 text-gray-700">
              <div className="w-8 h-8 sm:w-auto sm:h-auto rounded-full bg-primary/10 flex items-center justify-center sm:bg-transparent">
                <User className="h-4 w-4 text-primary sm:text-gray-700" />
              </div>
              <span className="text-sm hidden sm:inline max-w-[150px] md:max-w-[200px] truncate">
                {user?.email}
              </span>
            </div>
            
            {/* Botao logout - texto escondido em mobile */}
            <Button
              onClick={handleLogout}
              variant="outline"
              size="sm"
              className="transition-all duration-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 active:scale-95 min-h-[44px] sm:min-h-0"
              aria-label="Sair da conta"
            >
              <LogOut className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Sair</span>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
