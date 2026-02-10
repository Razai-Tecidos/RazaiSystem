import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Shopee } from './Shopee';

vi.mock('@/hooks/useShopee', () => ({
  useShopee: () => ({
    shops: [{ shopId: 12345 }],
    loading: false,
    connecting: false,
    connected: true,
    connect: vi.fn(),
    disconnect: vi.fn(),
    handleCallback: vi.fn().mockResolvedValue(undefined),
    checkForCallback: vi.fn().mockReturnValue(null),
    refresh: vi.fn(),
  }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

vi.mock('@/components/Layout/Header', () => ({
  Header: () => <div>HEADER</div>,
}));

vi.mock('@/components/Layout/BreadcrumbNav', () => ({
  BreadcrumbNav: () => <div>BREADCRUMB</div>,
}));

vi.mock('@/components/ui/confirm-dialog', () => ({
  ConfirmDialog: () => null,
}));

describe('Shopee navigation cards', () => {
  it('renders Estoque, Criar Anuncio and Tamanhos cards without Pedidos', () => {
    render(<Shopee />);

    expect(screen.getByRole('button', { name: /Estoque/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Criar Anuncio/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Tamanhos/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Pedidos/i })).not.toBeInTheDocument();
  });

  it('calls anuncios callback when clicking Criar Anuncio', () => {
    const onNavigateToAnuncios = vi.fn();
    render(<Shopee onNavigateToAnuncios={onNavigateToAnuncios} />);

    fireEvent.click(screen.getByRole('button', { name: /Criar Anuncio/i }));
    expect(onNavigateToAnuncios).toHaveBeenCalledTimes(1);
  });

  it('calls tamanhos callback when clicking Tamanhos', () => {
    const onNavigateToTamanhos = vi.fn();
    render(<Shopee onNavigateToTamanhos={onNavigateToTamanhos} />);

    fireEvent.click(screen.getByRole('button', { name: /Tamanhos/i }));
    expect(onNavigateToTamanhos).toHaveBeenCalledTimes(1);
  });
});
