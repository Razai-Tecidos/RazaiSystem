# Arquitetura do Projeto

Ultima atualizacao: 2026-02-12

## Leitura rapida (para agentes)
1. Runtime e fronteiras: secoes "Topologia" e "Camadas".
2. Fluxos com maior impacto: secao "Fluxos criticos".
3. Pontos de entrada por tarefa: secao "Task -> entrypoint".
4. Para Shopee detalhado: `docs/SHOPEE_ANUNCIOS.md`.

## Topologia do repositorio
- Frontend (React): `frontend/src`
- Backend operacional Shopee (Cloud Functions): `functions/src`
- Dados: Firestore (`tecidos`, `cores`, `cor_tecido`, `shopee_products`, etc.)
- Arquivos: Firebase Storage

## Camadas e responsabilidades

### Frontend
- UI, navegacao, validacoes de formulario, upload de arquivos.
- Leitura/escrita de dados internos via Firebase Client SDK.
- Consumo de endpoints backend para Shopee.

### Cloud Functions
- Regras de negocio para Shopee.
- Assinatura e chamadas da Shopee Open API.
- Publicacao, sincronizacao e manutencao de anuncios.

### Firebase
- Firestore para entidades e estados.
- Storage para imagens (tecidos, vinculos, mosaicos).
- Auth para controle de acesso.

## Navegacao frontend

### Modelo canonico
- Tipo canonico: `PageId` em `frontend/src/navigation/modules.ts`.
- Modulos com destaque canonico:
  - `tamanhos` destaca `shopee`
  - `anuncios-shopee` destaca `shopee`
  - `criar-anuncio-shopee` destaca `shopee`

### Shell
- Orquestrador: `frontend/src/pages/Home.tsx`
- Desktop: `DesktopSidebar`
- Mobile: `MobileBottomNav`

### URL/hash state
- Implementacao: `frontend/src/navigation/url-state.ts`
- Formato: `#/tecidos`, `#/cores`, `#/gestao-imagens`
- Precedencia em `frontend/src/App.tsx`:
  1. catalogo publico (`?catalogo=...`)
  2. callback Shopee (`code` + `shop_id`) ou `/shopee`
  3. hash valido
  4. fallback `home`

## Task -> entrypoint
- Mudar navegacao/hash:
  - `frontend/src/navigation/url-state.ts`
  - `frontend/src/App.tsx`
  - `frontend/src/pages/Home.tsx`
- Mudar fluxo de criacao Shopee:
  - `frontend/src/pages/CriarAnuncioShopee.tsx`
  - `functions/src/services/shopee-product.service.ts`
- Mudar comportamento de imagens/mosaicos:
  - `frontend/src/pages/GestaoImagens.tsx`
  - `frontend/src/lib/mosaicBuilder.ts`
  - `frontend/src/lib/firebase/gestao-imagens.ts`
- Mudar regras de permissao de dados:
  - `firestore.rules`
  - `storage.rules`

## Fluxos criticos

### Shopee publish (3 chamadas API)
1. Carrega draft + ownership.
2. Adquire lock transacional (`publish_lock` com TTL).
3. Valida pre-publish (atributos, marca, logistica, size chart).
4. Upload de imagens para `image_id` (com retry/backoff).
5. `add_item` (item base, sem variacoes).
6. Aguarda 5s.
7. `init_tier_variation` (tiers + models).
8. Aguarda 5s, `update_item` para imagens 3:4 (com retry em `not_found`).
9. Persistencia de `item_id` e status.
10. Rollback em falha parcial (`delete_item`).

### Gestao de imagens e mosaicos
1. Fontes principais: `cor_tecido` e `estampas` (via `tecidoBaseId`).
2. Geracao/reuso de imagens com fingerprint.
3. Geracao de mosaicos por tecido/template usando selecao mista (cor + estampa).
4. Persistencia em Firestore + Storage.

## Modelos de dados (hotspots)

### `cor_tecido`
- `imagemGerada?`
- `imagemGeradaFingerprint?`
- `imagemGeradaAt?`
- `imagemModelo?`
- `imagemModeloAt?`

### `estampas`
- `imagem?`
- `imagemGerada?`
- `imagemGeradaFingerprint?`
- `imagemGeradaAt?`

### `gestao_imagens_mosaicos`
- `tecidoId`
- `templateId`
- `selectedVinculoIds`
- `selectedImageUrls`
- `outputSquareUrl`
- `outputPortraitUrl`
- `createdBy`
- `createdAt`

Observacao:
- `selectedVinculoIds` pode conter chaves prefixadas (`cor:{id}` ou `estampa:{id}`).

### `shopee_products`
- `titulo_anuncio?`
- `precificacao?`
- `tier_variations[].options[].imagem_url`
- `tier_variations[].options[].imagem_gerada?`
- `publish_lock?`

## Storage (paths principais)
- `cor-tecido/{vinculoId}/tingida_*.jpg`
- `cor-tecido/{vinculoId}/gerada_*.png`
- `cor-tecido/{vinculoId}/modelo_*.*`
- `mosaicos/{tecidoId}/{mosaicoId}/square_1024.jpg`
- `mosaicos/{tecidoId}/{mosaicoId}/portrait_1062x1416.jpg`

## Seguranca

### Firestore
- `gestao_imagens_mosaicos`: leitura/escrita autenticada.

### Storage
- `mosaicos/{tecidoId}/**`: leitura publica, escrita autenticada.

## Comandos de localizacao rapida
```powershell
# localizar fluxos Shopee
rg -n "CriarAnuncioShopee|publishProduct|add_item|init_tier_variation" frontend/src functions/src

# localizar modelos de navegacao
rg -n "PageId|modules|url-state|hash" frontend/src/navigation frontend/src/App.tsx

# localizar dados de mosaicos
rg -n "gestao_imagens_mosaicos|mosaicos/|mosaic" frontend/src functions/src firestore.rules storage.rules
```

## Documentos relacionados
- `docs/README.md`
- `docs/SHOPEE.md`
- `docs/SHOPEE_ANUNCIOS.md`
- `docs/ENTREGAS_2026-02-11.md`
