import type { LucideIcon } from 'lucide-react';
import {
  BookOpen,
  Brain,
  Camera,
  Home,
  Image as ImageIcon,
  Link as LinkIcon,
  Package,
  Palette,
  PlusCircle,
  Ruler,
  ShoppingBag,
} from 'lucide-react';

export type PageId =
  | 'home'
  | 'tecidos'
  | 'estampas'
  | 'cores'
  | 'captura-cor'
  | 'vinculos'
  | 'gestao-imagens'
  | 'catalogo'
  | 'tamanhos'
  | 'shopee'
  | 'anuncios-shopee'
  | 'criar-anuncio-shopee'
  | 'ml-diagnostico';

export type ModuleGroupId = 'principal' | 'operacao' | 'marketplace' | 'ferramentas';

export interface ModuleDefinition {
  id: PageId;
  label: string;
  shortLabel?: string;
  group: ModuleGroupId;
  icon: LucideIcon;
  desktopVisible: boolean;
  mobileVisible: boolean;
  mobileMain?: boolean;
  shortcut?: string;
}

const PAGE_ID_SET: ReadonlySet<PageId> = new Set<PageId>([
  'home',
  'tecidos',
  'estampas',
  'cores',
  'captura-cor',
  'vinculos',
  'gestao-imagens',
  'catalogo',
  'tamanhos',
  'shopee',
  'anuncios-shopee',
  'criar-anuncio-shopee',
  'ml-diagnostico',
]);

export const MODULES: Record<PageId, ModuleDefinition> = {
  home: {
    id: 'home',
    label: 'Home',
    group: 'principal',
    icon: Home,
    desktopVisible: true,
    mobileVisible: true,
    mobileMain: true,
    shortcut: 'Alt+H',
  },
  tecidos: {
    id: 'tecidos',
    label: 'Tecidos',
    group: 'operacao',
    icon: Package,
    desktopVisible: true,
    mobileVisible: true,
    mobileMain: true,
    shortcut: 'Alt+1',
  },
  estampas: {
    id: 'estampas',
    label: 'Estampas',
    group: 'operacao',
    icon: ImageIcon,
    desktopVisible: true,
    mobileVisible: true,
    shortcut: 'Alt+2',
  },
  cores: {
    id: 'cores',
    label: 'Cores',
    group: 'operacao',
    icon: Palette,
    desktopVisible: true,
    mobileVisible: true,
    mobileMain: true,
    shortcut: 'Alt+3',
  },
  'captura-cor': {
    id: 'captura-cor',
    label: 'Capturar Cor',
    shortLabel: 'Capturar',
    group: 'operacao',
    icon: Camera,
    desktopVisible: true,
    mobileVisible: true,
    shortcut: 'Alt+4',
  },
  vinculos: {
    id: 'vinculos',
    label: 'Vinculos',
    group: 'operacao',
    icon: LinkIcon,
    desktopVisible: true,
    mobileVisible: true,
    shortcut: 'Alt+5',
  },
  'gestao-imagens': {
    id: 'gestao-imagens',
    label: 'Gestao de Imagens',
    shortLabel: 'Imagens',
    group: 'operacao',
    icon: ImageIcon,
    desktopVisible: true,
    mobileVisible: true,
  },
  catalogo: {
    id: 'catalogo',
    label: 'Catalogo',
    group: 'operacao',
    icon: BookOpen,
    desktopVisible: true,
    mobileVisible: true,
    shortcut: 'Alt+6',
  },
  tamanhos: {
    id: 'tamanhos',
    label: 'Tamanhos',
    group: 'operacao',
    icon: Ruler,
    desktopVisible: true,
    mobileVisible: true,
    shortcut: 'Alt+7',
  },
  shopee: {
    id: 'shopee',
    label: 'Shopee',
    group: 'marketplace',
    icon: ShoppingBag,
    desktopVisible: true,
    mobileVisible: true,
    mobileMain: true,
    shortcut: 'Alt+8',
  },
  'anuncios-shopee': {
    id: 'anuncios-shopee',
    label: 'Anuncios Shopee',
    shortLabel: 'Anuncios',
    group: 'marketplace',
    icon: PlusCircle,
    desktopVisible: true,
    mobileVisible: true,
    shortcut: 'Alt+9',
  },
  'criar-anuncio-shopee': {
    id: 'criar-anuncio-shopee',
    label: 'Criar Anuncio',
    group: 'marketplace',
    icon: PlusCircle,
    desktopVisible: false,
    mobileVisible: false,
  },
  'ml-diagnostico': {
    id: 'ml-diagnostico',
    label: 'Diagnostico ML',
    shortLabel: 'ML',
    group: 'ferramentas',
    icon: Brain,
    desktopVisible: true,
    mobileVisible: false,
  },
};

export const DESKTOP_GROUPS: Array<{ id: ModuleGroupId; label: string; pages: PageId[] }> = [
  { id: 'principal', label: 'Principal', pages: ['home'] },
  {
    id: 'operacao',
    label: 'Operacao',
    pages: ['tecidos', 'estampas', 'cores', 'captura-cor', 'vinculos', 'gestao-imagens', 'catalogo'],
  },
  { id: 'marketplace', label: 'Marketplace', pages: ['shopee'] },
  { id: 'ferramentas', label: 'Ferramentas', pages: ['ml-diagnostico'] },
];

export const MOBILE_MAIN_PAGE_IDS: PageId[] = ['home', 'tecidos', 'cores', 'shopee'];
export const MOBILE_MORE_PAGE_IDS: PageId[] = [
  'estampas',
  'vinculos',
  'gestao-imagens',
  'catalogo',
  'captura-cor',
];
export const SHORTCUT_PAGE_IDS: PageId[] = [
  'tecidos',
  'estampas',
  'cores',
  'captura-cor',
  'vinculos',
  'catalogo',
  'shopee',
];

const CANONICAL_ACTIVE_PAGE_MAP: Partial<Record<PageId, PageId>> = {
  tamanhos: 'shopee',
  'anuncios-shopee': 'shopee',
  'criar-anuncio-shopee': 'shopee',
};

export function isPageId(value: string): value is PageId {
  return PAGE_ID_SET.has(value as PageId);
}

export function getCanonicalActivePage(page: PageId): PageId {
  return CANONICAL_ACTIVE_PAGE_MAP[page] ?? page;
}
