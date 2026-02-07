import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Package, Palette, Camera, ChevronRight, Image as ImageIcon, ShoppingBag, Brain, Link as LinkIcon, BookOpen } from 'lucide-react';
import { Tecidos } from './Tecidos';
import { Estampas } from './Estampas';
import { Cores } from './Cores';
import { CapturaCor } from './CapturaCor';
import { Shopee } from './Shopee';
import { MLDiagnostico } from './MLDiagnostico';
import { Vinculos } from './Vinculos';
import { Catalogo } from './Catalogo';
import { Header } from '@/components/Layout/Header';
import { cn } from '@/lib/utils';

interface NavCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
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

interface HomeProps {
  initialPage?: 'home' | 'shopee';
}

export function Home({ initialPage = 'home' }: HomeProps) {
  const { user } = useAuth();
  const [currentPage, setCurrentPage] = useState<'home' | 'tecidos' | 'estampas' | 'cores' | 'captura-cor' | 'shopee' | 'ml-diagnostico' | 'vinculos' | 'catalogo'>(initialPage);

  const handleNavigateHome = () => {
    setCurrentPage('home');
  };

  if (currentPage === 'tecidos') {
    return <Tecidos onNavigateHome={handleNavigateHome} />;
  }

  if (currentPage === 'estampas') {
    return <Estampas onNavigateHome={handleNavigateHome} />;
  }

  if (currentPage === 'cores') {
    return <Cores onNavigateHome={handleNavigateHome} />;
  }

  if (currentPage === 'captura-cor') {
    return <CapturaCor onNavigateHome={handleNavigateHome} />;
  }

  if (currentPage === 'shopee') {
    return <Shopee onNavigateHome={handleNavigateHome} />;
  }

  if (currentPage === 'ml-diagnostico') {
    return <MLDiagnostico onNavigateHome={handleNavigateHome} />;
  }

  if (currentPage === 'vinculos') {
    return <Vinculos onNavigateHome={handleNavigateHome} />;
  }

  if (currentPage === 'catalogo') {
    return <Catalogo onNavigateHome={handleNavigateHome} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <Header onNavigateHome={handleNavigateHome} />

      <main className="container mx-auto px-4 py-6 sm:py-8 safe-bottom">
        {/* Saudacao */}
        <div className="mb-6 sm:mb-8 animate-fade-in">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">
            {getGreeting()}, {user?.displayName?.split(' ')[0] || 'Usuário'}!
          </h1>
          <p className="text-sm sm:text-base text-gray-600">
            O que você gostaria de fazer hoje?
          </p>
        </div>

        {/* Grid de cards - responsivo */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <NavCard
            title="Tecidos"
            description="Cadastre tecidos lisos e estampados"
            icon={<Package className="h-6 w-6 text-white" />}
            onClick={() => setCurrentPage('tecidos')}
            color="blue"
            delay={0}
          />
          <NavCard
            title="Estampas"
            description="Vincule estampas aos tecidos"
            icon={<ImageIcon className="h-6 w-6 text-white" />}
            onClick={() => setCurrentPage('estampas')}
            color="pink"
            delay={100}
          />
          <NavCard
            title="Gerenciar Cores"
            description="Visualize e edite suas cores"
            icon={<Palette className="h-6 w-6 text-white" />}
            onClick={() => setCurrentPage('cores')}
            color="purple"
            delay={200}
          />
          <NavCard
            title="Capturar Cor"
            description="Use o colorímetro Bluetooth"
            icon={<Camera className="h-6 w-6 text-white" />}
            onClick={() => setCurrentPage('captura-cor')}
            color="green"
            delay={300}
          />
          <NavCard
            title="Shopee"
            description="Integração com sua loja"
            icon={<ShoppingBag className="h-6 w-6 text-white" />}
            onClick={() => setCurrentPage('shopee')}
            color="orange"
            delay={400}
          />
          <NavCard
            title="Vínculos"
            description="Vincule cores a tecidos"
            icon={<LinkIcon className="h-6 w-6 text-white" />}
            onClick={() => setCurrentPage('vinculos')}
            color="blue"
            delay={500}
          />
          <NavCard
            title="Catálogo"
            description="Gere PDF ou link para clientes"
            icon={<BookOpen className="h-6 w-6 text-white" />}
            onClick={() => setCurrentPage('catalogo')}
            color="green"
            delay={600}
          />
        </div>

        {/* Links para ferramentas de desenvolvimento */}
        <div className="mt-4 text-center">
          <button
            onClick={() => setCurrentPage('ml-diagnostico')}
            className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            <Brain className="h-4 w-4" />
            Diagnóstico ML
          </button>
        </div>

        {/* Info do usuario */}
        <div className="mt-8 sm:mt-10 p-4 bg-white rounded-xl border border-gray-200 shadow-sm animate-slide-up" style={{ animationDelay: '300ms' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center text-white font-semibold text-sm">
              {(user?.displayName || user?.email || 'U').charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {user?.displayName || 'Usuário'}
              </p>
              <p className="text-xs text-gray-500 truncate">{user?.email}</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// Helper para saudacao baseada no horario
function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}
