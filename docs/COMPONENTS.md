# Documentacao de Componentes

Ultima atualizacao: 2026-02-10

## Layout

### Header
Arquivo: `frontend/src/components/Layout/Header.tsx`

Responsavel por:
- identidade da aplicacao
- dados do usuario autenticado
- logout
- callback opcional para voltar a Home

### DesktopSidebar (novo)
Arquivo: `frontend/src/components/Layout/DesktopSidebar.tsx`

Props:
```ts
interface DesktopSidebarProps {
  currentPage: PageId;
  onNavigate: (page: PageId) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  recentPages: PageId[];
}
```

Comportamento:
- visivel em `md+`
- fixa na lateral
- estado recolhido/expandido
- destaque de modulo ativo com `aria-current="page"`
- grupos de menu por dominio (`Principal`, `Operacao`, `Marketplace`, `Ferramentas`)
- secao `Recentes` com ate 5 modulos
- tooltip no modo recolhido

### MobileBottomNav
Arquivo: `frontend/src/components/Layout/MobileBottomNav.tsx`

Props:
```ts
interface MobileBottomNavProps {
  currentPage: PageId;
  onNavigate: (page: PageId) => void;
}
```

Comportamento:
- continua sendo a navegacao mobile principal
- itens fixos + menu `Mais`
- sincronizado com o mesmo `PageId` usado no desktop

## UI

### ImageLightbox (novo)
Arquivo: `frontend/src/components/ui/image-lightbox.tsx`

Props:
```ts
interface ImageLightboxProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageUrl: string | null;
  title?: string;
  subtitle?: string;
}
```

Comportamento:
- modal de preview de imagem para Vinculos e Gestao de Imagens
- imagem em `object-contain`
- evita scroll interno causado por imagem grande

### ConfirmDialog
Arquivo: `frontend/src/components/ui/confirm-dialog.tsx`

Mantido como dialog padrao de confirmacao destrutiva/nao destrutiva.

## Paginas

### Home
Arquivo: `frontend/src/pages/Home.tsx`

Responsavel por:
- orquestracao de paginas internas por `PageId`
- shell desktop/mobile
- sincronizacao com hash
- atalhos de teclado desktop
- persistencia de estado de sidebar e recentes

### GestaoImagens (novo)
Arquivo: `frontend/src/pages/GestaoImagens.tsx`

Responsavel por:
- listar vinculos agrupados por tecido para operacoes de imagem
- regenerar imagens em lote por tecido
- gerar `imagemGerada` e salvar no Firebase
- upload de `imagemModelo`
- montar e salvar mosaicos
- preview de imagens em lightbox

### Shopee
Arquivo: `frontend/src/pages/Shopee.tsx`

Atualizacoes:
- menu interno com cards `Estoque`, `Criar Anuncio` e `Tamanhos`
- card `Pedidos` removido
- callbacks novos:
  - `onNavigateToAnuncios?: () => void`
  - `onNavigateToTamanhos?: () => void`

### Vinculos
Arquivo: `frontend/src/pages/Vinculos.tsx`

Atualizacoes:
- clique na miniatura abre `ImageLightbox`
- preview ampliado sem distorcer e sem scroll interno de imagem

### Cores
Arquivo: `frontend/src/pages/Cores.tsx`

Atualizacoes de navegacao:
- `CoresProps` agora aceita `onNavigateToVinculos?: () => void`
- fallback para `onNavigateHome` quando callback especifico nao existe

## Componentes de tabela relacionados

### CoresTable
Arquivo: `frontend/src/components/Cores/CoresTable.tsx`

Interface relevante:
```ts
interface CoresTableProps {
  onNavigateVinculos?: () => void;
  onEditVinculo?: (vinculo: CorTecido) => void;
}
```

Uso:
- acao `+X mais...` da coluna de vinculos direciona para modulo de Vinculos.

## Registry de navegacao

Arquivo: `frontend/src/navigation/modules.ts`

Ponto unico para:
- `PageId`
- rotulos/icones
- visibilidade desktop/mobile
- atalhos
- grupos de menu
- regra canonica de destaque (`tamanhos`, `anuncios-shopee`, `criar-anuncio-shopee` -> `shopee`)
