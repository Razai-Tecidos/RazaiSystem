import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { GestaoImagens } from './GestaoImagens';

const updateVinculoMock = vi.fn().mockResolvedValue(undefined);

const vinculosFixture = [
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
    imagemModelo: 'https://example.com/modelo-1.png',
    createdAt: {},
    updatedAt: {},
  },
];

const tecidosFixture = [
  {
    id: 't1',
    nome: 'Algodao',
    tipo: 'liso',
    largura: 1.5,
    composicao: '100% algodao',
    sku: 'T001',
    createdAt: {},
    updatedAt: {},
  },
];

vi.mock('@/hooks/useCorTecido', () => ({
  useCorTecido: () => ({
    vinculos: vinculosFixture,
    loading: false,
    updateVinculo: updateVinculoMock,
  }),
}));

vi.mock('@/hooks/useTecidos', () => ({
  useTecidos: () => ({
    tecidos: tecidosFixture,
    loading: false,
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
  generateBrandOverlay: vi.fn().mockResolvedValue('data:image/png;base64,AAAA'),
}));

vi.mock('@/lib/firebase/cor-tecido', () => ({
  uploadImagemGerada: vi.fn().mockResolvedValue('https://example.com/gerada.png'),
  uploadImagemModelo: vi.fn(),
  uploadImagemPremium: vi.fn(),
}));

vi.mock('@/lib/mosaicBuilder', () => ({
  buildMosaicOutputs: vi.fn(),
  buildPremiumVinculoOutputs: vi.fn(),
}));

vi.mock('@/lib/firebase/gestao-imagens', () => ({
  createGestaoImagemMosaico: vi.fn(),
  getLatestMosaicoByTecido: vi.fn().mockResolvedValue(null),
  listMosaicosByTecido: vi.fn().mockResolvedValue([]),
  uploadMosaicoImage: vi.fn(),
}));

describe.skip('GestaoImagens (fixture minima)', () => {
  it('renderiza somente uma linha e acoes de lote por tecido sem executar regeneracao', () => {
    render(<GestaoImagens />);

    expect(screen.getByText('Algodao')).toBeInTheDocument();
    expect(screen.getByText('Preto')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Regenerar todos deste tecido/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Gerar premium deste tecido/i })).toBeInTheDocument();
  });
});
