import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Login } from './pages/Login';
import { Home } from './pages/Home';
import { CatalogoPublico } from './pages/CatalogoPublico';
import { PageId } from '@/navigation/modules';
import { parsePageFromHash } from '@/navigation/url-state';

function App() {
  const { user, loading } = useAuth();
  const [initialPage, setInitialPage] = useState<PageId | null>(null);
  const [catalogoId, setCatalogoId] = useState<string | null>(null);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const shopId = urlParams.get('shop_id');
    const catalogo = urlParams.get('catalogo');
    const path = window.location.pathname;
    const pageFromHash = parsePageFromHash(window.location.hash);

    if (catalogo) {
      setCatalogoId(catalogo);
      return;
    }

    if ((code && shopId) || path === '/shopee') {
      setInitialPage('shopee');
      return;
    }

    if (pageFromHash) {
      setInitialPage(pageFromHash);
      return;
    }

    setInitialPage('home');
  }, []);

  if (catalogoId) {
    return <CatalogoPublico catalogoId={catalogoId} />;
  }

  if (loading || initialPage === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  return user ? <Home initialPage={initialPage} /> : <Login />;
}

export default App;
