import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Cores } from './Cores';

vi.mock('@/hooks/useCores', () => ({
  useCores: () => ({
    cores: [],
    loading: false,
    error: null,
    createCor: vi.fn(),
    updateCor: vi.fn(),
    deleteCor: vi.fn(),
    mesclarCores: vi.fn(),
  }),
}));

vi.mock('@/hooks/useCorTecido', () => ({
  useCorTecido: () => ({
    vinculos: [],
    loading: false,
    contarVinculosPorCor: vi.fn().mockReturnValue(0),
  }),
}));

vi.mock('@/hooks/useConfig', () => ({
  useConfig: () => ({
    deltaELimiar: 3,
    setDeltaELimiar: vi.fn(),
    loading: false,
    saving: false,
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

vi.mock('@/components/Cores/CorFormModal', () => ({
  CorFormModal: () => null,
}));

vi.mock('@/components/Cores/CoresTable', () => ({
  CoresTable: ({ onNavigateVinculos }: { onNavigateVinculos?: () => void }) => (
    <button type="button" onClick={() => onNavigateVinculos?.()}>
      IR_VINCULOS
    </button>
  ),
}));

describe('Cores navigation callbacks', () => {
  it('calls onNavigateToVinculos when provided', () => {
    const onNavigateToVinculos = vi.fn();

    render(<Cores onNavigateToVinculos={onNavigateToVinculos} />);
    fireEvent.click(screen.getByRole('button', { name: 'IR_VINCULOS' }));

    expect(onNavigateToVinculos).toHaveBeenCalledTimes(1);
  });

  it('falls back to onNavigateHome when onNavigateToVinculos is not provided', () => {
    const onNavigateHome = vi.fn();

    render(<Cores onNavigateHome={onNavigateHome} />);
    fireEvent.click(screen.getByRole('button', { name: 'IR_VINCULOS' }));

    expect(onNavigateHome).toHaveBeenCalledTimes(1);
  });
});
