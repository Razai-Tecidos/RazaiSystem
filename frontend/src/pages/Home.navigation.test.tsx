import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Home } from './Home';

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: {
      displayName: 'Test User',
      email: 'test@example.com',
    },
    logout: vi.fn(),
  }),
}));

vi.mock('./Tecidos', () => ({
  Tecidos: () => <div>PAGE_TECIDOS</div>,
}));
vi.mock('./Estampas', () => ({
  Estampas: () => <div>PAGE_ESTAMPAS</div>,
}));
vi.mock('./Cores', () => ({
  Cores: () => <div>PAGE_CORES</div>,
}));
vi.mock('./CapturaCor', () => ({
  CapturaCor: () => <div>PAGE_CAPTURA_COR</div>,
}));
vi.mock('./Shopee', () => ({
  Shopee: ({
    onNavigateToAnuncios,
  }: {
    onNavigateToAnuncios?: () => void;
  }) => (
    <div>
      PAGE_SHOPEE
      <button type="button" onClick={() => onNavigateToAnuncios?.()}>
        IR_ANUNCIOS
      </button>
    </div>
  ),
}));
vi.mock('./MLDiagnostico', () => ({
  MLDiagnostico: () => <div>PAGE_ML</div>,
}));
vi.mock('./Vinculos', () => ({
  Vinculos: () => <div>PAGE_VINCULOS</div>,
}));
vi.mock('./Catalogo', () => ({
  Catalogo: () => <div>PAGE_CATALOGO</div>,
}));
vi.mock('./AnunciosShopee', () => ({
  AnunciosShopee: ({ onNavigateToCriar }: { onNavigateToCriar?: (draftId?: string) => void }) => (
    <div>
      PAGE_ANUNCIOS
      <button type="button" onClick={() => onNavigateToCriar?.('draft-123')}>
        IR_CRIAR
      </button>
    </div>
  ),
}));
vi.mock('./CriarAnuncioShopee', () => ({
  CriarAnuncioShopee: ({
    onNavigateToAnuncios,
    draftId,
  }: {
    onNavigateToAnuncios?: () => void;
    draftId?: string;
  }) => (
    <div>
      PAGE_CRIAR_{draftId}
      <button type="button" onClick={() => onNavigateToAnuncios?.()}>
        VOLTAR_ANUNCIOS
      </button>
    </div>
  ),
}));

describe('Home navigation', () => {
  beforeEach(() => {
    localStorage.clear();
    window.location.pathname = '/';
    window.location.search = '';
    window.location.hash = '';
    Object.defineProperty(window, 'innerWidth', {
      value: 1280,
      writable: true,
    });
  });

  it('updates state and hash when navigating', () => {
    render(<Home initialPage="home" />);

    fireEvent.click(screen.getAllByRole('button', { name: /Tecidos/i })[0]);

    expect(screen.getByText('PAGE_TECIDOS')).toBeInTheDocument();
    expect(window.history.pushState).toHaveBeenCalledWith(null, '', '/#/tecidos');
  });

  it('reacts to hashchange and renders the matching module', async () => {
    render(<Home initialPage="home" />);

    window.location.hash = '#/catalogo';
    fireEvent(window, new HashChangeEvent('hashchange'));

    await waitFor(() => {
      expect(screen.getByText('PAGE_CATALOGO')).toBeInTheDocument();
    });
  });

  it('highlights Shopee as active when current page is criar-anuncio-shopee', () => {
    render(<Home initialPage="criar-anuncio-shopee" />);

    const shopeeButtons = screen.getAllByRole('button', { name: /Shopee/i });
    expect(shopeeButtons.some((button) => button.getAttribute('aria-current') === 'page')).toBe(true);
  });

  it('highlights Shopee as active when current page is anuncios-shopee or tamanhos', () => {
    const { rerender } = render(<Home initialPage="anuncios-shopee" />);
    let shopeeButtons = screen.getAllByRole('button', { name: /Shopee/i });
    expect(shopeeButtons.some((button) => button.getAttribute('aria-current') === 'page')).toBe(true);

    rerender(<Home initialPage="tamanhos" />);
    shopeeButtons = screen.getAllByRole('button', { name: /Shopee/i });
    expect(shopeeButtons.some((button) => button.getAttribute('aria-current') === 'page')).toBe(true);
  });

  it('does not show Tamanhos and Criar Anuncio cards on home dashboard', () => {
    render(<Home initialPage="home" />);

    expect(screen.queryByRole('button', { name: /Tamanhos/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Criar Anuncio/i })).not.toBeInTheDocument();
  });

  it('supports desktop keyboard shortcuts', () => {
    render(<Home initialPage="home" />);

    fireEvent.keyDown(window, { key: '1', altKey: true });
    expect(screen.getByText('PAGE_TECIDOS')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'h', altKey: true });
    expect(screen.getByText(/O que voce gostaria de fazer hoje/i)).toBeInTheDocument();
  });
});
