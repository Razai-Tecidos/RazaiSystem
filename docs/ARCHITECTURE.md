# Arquitetura do Projeto

Ultima atualizacao: 2026-02-10

## Visao geral

O RazaiSystem roda com frontend React + Firebase (Firestore, Storage, Auth) e backend em Cloud Functions (Express + TypeScript).

- Frontend: `frontend/src`
- Backend: `functions/src`
- Dados: Firestore (`tecidos`, `cores`, `cor_tecido`, `shopee_products`, etc.)
- Arquivos: Firebase Storage

## Camadas

1. `Frontend`:
- UI, navegacao, validacoes de formulario, upload de arquivos.
- Acesso direto ao Firebase Client SDK para CRUD interno.
- Consumo de API backend para fluxo Shopee.

2. `Cloud Functions`:
- Regras de negocio para Shopee.
- Assinatura e chamadas da Shopee Open API.
- Publicacao, sincronizacao e manutencao de anuncios.

3. `Firebase`:
- Firestore para entidades e estados.
- Storage para imagens (tecidos, vinculos, mosaicos, etc.).
- Auth para controle de acesso.

## Navegacao (frontend)

### Modelo unico
- Tipo canonico: `PageId` em `frontend/src/navigation/modules.ts`.
- Registry de modulos com metadados de menu desktop/mobile, grupos e atalhos.
- Pagina canonica ativa:
- `tamanhos` destaca `shopee`.
- `anuncios-shopee` destaca `shopee`.
- `criar-anuncio-shopee` destaca `shopee`.

### Shell de navegacao
- `Home.tsx` atua como orquestrador de navegacao.
- Desktop: `DesktopSidebar` persistente.
- Mobile: `MobileBottomNav`.
- Conteudo de pagina carregado dentro do mesmo shell.

### Sincronizacao com URL hash
Implementado em `frontend/src/navigation/url-state.ts`.

Formato:
- `#/tecidos`
- `#/cores`
- `#/gestao-imagens`
- `home` sem hash

Precedencia de abertura em `frontend/src/App.tsx`:
1. `catalogo` publico (`?catalogo=...`)
2. callback Shopee (`code` + `shop_id`) ou path `/shopee`
3. hash valido
4. fallback `home`

Comportamento:
- Navegar modulo faz `pushState` por hash.
- Inicializacao usa `replaceState` para nao poluir historico.
- `hashchange` e `popstate` sincronizam a tela.
- Hash invalido cai para `home`.

### Persistencia local de UX
- `desktop_sidebar_collapsed` em `localStorage`.
- `desktop_recent_pages` com ultimos 5 modulos (exceto Home).
- Atalhos desktop:
- `Alt+H` -> Home
- `Alt+1..7` -> modulos principais do registry

## Modulos e fluxos relevantes

### Vinculos
- Pagina: `frontend/src/pages/Vinculos.tsx`
- Clique na miniatura abre `ImageLightbox` (sem scroll interno da imagem).
- A imagem respeita o container com `object-contain`.

### Gestao de Imagens (novo)
- Pagina: `frontend/src/pages/GestaoImagens.tsx`
- Fonte de dados base: `cor_tecido`.
- Funcionalidades:
- tabela separada por tecido (agrupamento por `tecidoId`)
- regeneracao em lote por tecido (`Regenerar todos deste tecido`)
- gerar imagem de variacao (com logo + nome da cor)
- upload de foto de modelo
- selecao de imagens para mosaico
- gerar e salvar mosaicos por template

Regras de geracao:
- campo de cache: `imagemGeradaFingerprint`
- se fingerprint mudar (`imagemTingida` ou `corNome`), a imagem e regenerada
- geracao salva resultado no Firebase para reuso
- acao individual de regeneracao por linha foi removida nesta fase

### Shopee como modulo pai
- Pagina: `frontend/src/pages/Shopee.tsx`
- Cards de menu atuais:
  - `Estoque`
  - `Criar Anuncio` (abre `anuncios-shopee`)
  - `Tamanhos` (abre `tamanhos`)
- Card `Pedidos` removido.
- `anuncios-shopee` e `tamanhos` continuam validos por hash legado (`#/anuncios-shopee`, `#/tamanhos`), com highlight canonico em `Shopee`.

## Modelos de dados principais

### `cor_tecido`
Campos relevantes (alem dos ja existentes):
- `imagemGerada?: string`
- `imagemGeradaFingerprint?: string`
- `imagemGeradaAt?: Timestamp`
- `imagemModelo?: string`
- `imagemModeloAt?: Timestamp`

### `gestao_imagens_mosaicos` (novo)
- `tecidoId`
- `tecidoNomeSnapshot`
- `templateId` (`grid-2x2` | `hero-vertical` | `triptych`)
- `sourcePolicy` (`gerada`)
- `selectedVinculoIds`
- `selectedImageUrls`
- `outputSquareUrl`
- `outputPortraitUrl`
- `createdBy`
- `createdAt`

### `shopee_products`
Campos relevantes nesta fase:
- `titulo_anuncio?: string`
- `tier_variations[].options[].imagem_url`
- `tier_variations[].options[].imagem_gerada?: boolean`

## Storage

Paths usados neste fluxo:
- `cor-tecido/{vinculoId}/tingida_*.jpg`
- `cor-tecido/{vinculoId}/gerada_*.png`
- `cor-tecido/{vinculoId}/modelo_*.*`
- `mosaicos/{tecidoId}/{mosaicoId}/square_1024.jpg`
- `mosaicos/{tecidoId}/{mosaicoId}/portrait_1062x1416.jpg`

## Fluxo Shopee com imagens geradas

No backend (`functions/src/services/shopee-product.service.ts`):

1. Cria/atualiza rascunho salvando `titulo_anuncio`.
2. Para variacoes de cor, prioriza `imagemGerada`; fallback para `imagemTingida`.
3. Publicacao:
- se `imagem_gerada = true`, faz upload direto da imagem
- se `imagem_gerada = false`, aplica overlay no backend antes do upload
4. `item_name` final usa `titulo_anuncio` quando preenchido.

## Regras de seguranca

### Firestore (`firestore.rules`)
- `gestao_imagens_mosaicos`: read/write autenticado.

### Storage (`storage.rules`)
- `mosaicos/{tecidoId}/**`: leitura publica, escrita autenticada.

## Testes adicionados

- `frontend/src/navigation/url-state.test.ts`
- `frontend/src/pages/Home.navigation.test.tsx`
- `frontend/src/pages/Cores.navigation.test.tsx`
- `frontend/src/pages/Shopee.navigation.test.tsx`
- `frontend/src/pages/GestaoImagens.regeneration.test.tsx`

Cobertura principal:
- parse/serialize hash
- navegacao + hashchange/popstate
- destaque canonico de menu
- callback `Cores -> Vinculos`
