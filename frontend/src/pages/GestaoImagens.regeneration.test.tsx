import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { GestaoImagens } from './GestaoImagens';
const { updateVinculoMock, generateBrandOverlayMock, uploadImagemGeradaMock } = vi.hoisted(() => ({
  updateVinculoMock: vi.fn().mockResolvedValue(undefined),
  generateBrandOverlayMock: vi.fn().mockResolvedValue('data:image/png;base64,AAAA'),
  uploadImagemGeradaMock: vi.fn().mockResolvedValue('https://example.com/gerada.png'),
}));

const { vinculosFixture } = vi.hoisted(() => ({
  vinculosFixture: [
    {
      id: 'v1',
      corId: 'c1',
      corNome: 'Preto',
      tecidoId: 't1',
      tecidoNome: 'Algodao',
      sku: 'SKU-1',
      imagemTingida: 'https://example.com/base-1.jpg',
      imagemGerada: 'https://example.com/gerada-1.png',
      imagemGeradaFingerprint: 'https://example.com/base-1.jpg::Preto',
      createdAt: {},
      updatedAt: {},
    },
    {
      id: 'v2',
      corId: 'c2',
      corNome: 'Branco',
      tecidoId: 't1',
      tecidoNome: 'Algodao',
      sku: 'SKU-2',
      imagemTingida: 'https://example.com/base-2.jpg',
      imagemGerada: 'https://example.com/gerada-2.png',
      imagemGeradaFingerprint: 'https://example.com/base-2.jpg::Branco',
      createdAt: {},
      updatedAt: {},
    },
    {
      id: 'v3',
      corId: 'c3',
      corNome: 'Azul',
      tecidoId: 't2',
      tecidoNome: 'Linho',
      sku: 'SKU-3',
      imagemTingida: 'https://example.com/base-3.jpg',
      imagemGerada: 'https://example.com/gerada-3.png',
      imagemGeradaFingerprint: 'https://example.com/base-3.jpg::Azul',
      createdAt: {},
      updatedAt: {},
    },
  ],
}));

vi.mock('@/hooks/useCorTecido', () => ({
  useCorTecido: () => ({
    vinculos: vinculosFixture,
    loading: false,
    updateVinculo: updateVinculoMock,
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

vi.mock('@/components/Layout/EmptyState', () => ({
  EmptyState: ({ title }: { title: string }) => <div>{title}</div>,
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children: ReactNode }) => <button type="button">{children}</button>,
  SelectValue: () => null,
}));

vi.mock('@/components/ui/table', () => ({
  Table: ({ children }: { children: ReactNode }) => <table>{children}</table>,
  TableHeader: ({ children }: { children: ReactNode }) => <thead>{children}</thead>,
  TableBody: ({ children }: { children: ReactNode }) => <tbody>{children}</tbody>,
  TableRow: ({ children }: { children: ReactNode }) => <tr>{children}</tr>,
  TableHead: ({ children }: { children: ReactNode }) => <th>{children}</th>,
  TableCell: ({ children }: { children: ReactNode }) => <td>{children}</td>,
}));

vi.mock('@/components/ui/image-lightbox', () => ({
  ImageLightbox: () => null,
}));

vi.mock('@/lib/brandOverlay', () => ({
  generateBrandOverlay: generateBrandOverlayMock,
}));

vi.mock('@/lib/firebase/cor-tecido', () => ({
  uploadImagemGerada: uploadImagemGeradaMock,
  uploadImagemModelo: vi.fn(),
}));

vi.mock('@/lib/mosaicBuilder', () => ({
  buildMosaicOutputs: vi.fn(),
}));

vi.mock('@/lib/firebase/gestao-imagens', () => ({
  createGestaoImagemMosaico: vi.fn(),
  listMosaicosByTecido: vi.fn().mockResolvedValue([]),
  uploadMosaicoImage: vi.fn(),
}));

describe('GestaoImagens regeneration by tecido', () => {
  beforeEach(() => {
    updateVinculoMock.mockClear();
    generateBrandOverlayMock.mockClear();
    uploadImagemGeradaMock.mockClear();
    vi.mocked(global.fetch).mockResolvedValue({
      blob: async () => new Blob(['mock'], { type: 'image/png' }),
    } as Response);
  });

  it('renders one table section per tecido and no individual regenerate button', () => {
    render(<GestaoImagens />);

    expect(screen.getByText('Algodao')).toBeInTheDocument();
    expect(screen.getByText('Linho')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Regenerar todos deste tecido/i })).toHaveLength(2);
    expect(screen.queryByRole('button', { name: /^Regenerar$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Gerar imagem$/i })).not.toBeInTheDocument();
  });

  it.skip('regenerates only vinculos from selected tecido section', async () => {
    render(<GestaoImagens />);

    const algodaoSection = screen.getByText('Algodao').closest('section');
    expect(algodaoSection).not.toBeNull();

    fireEvent.click(within(algodaoSection as HTMLElement).getByRole('button', { name: /Regenerar todos deste tecido/i }));

    await waitFor(() => {
      expect(updateVinculoMock).toHaveBeenCalledTimes(2);
    });

    const updatedIds = updateVinculoMock.mock.calls.map(([payload]) => payload.id);
    expect(updatedIds).toEqual(expect.arrayContaining(['v1', 'v2']));
    expect(updatedIds).not.toContain('v3');
  });
});
