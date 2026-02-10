# Documentacao de Hooks

Ultima atualizacao: 2026-02-10

## Hooks de estado global

### useAuth
Arquivo: `frontend/src/hooks/useAuth.ts`

Retorna usuario autenticado, estado de loading e metodos de login/logout.

### use-toast
Arquivo: `frontend/src/hooks/use-toast.ts`

Retorna `toast()` para feedback de sucesso/erro.

## Hooks de dominio

### useTecidos
Arquivo: `frontend/src/hooks/useTecidos.ts`

CRUD de tecidos com UI otimista, upload e rollback em erro.

### useCores
Arquivo: `frontend/src/hooks/useCores.ts`

CRUD de cores, validacoes e sincronizacao de nome/SKU com vinculos.

### useCorTecido
Arquivo: `frontend/src/hooks/useCorTecido.ts`

Entidade de vinculo cor-tecido.

Campos relevantes do modelo nesta fase:
- `imagemTingida?`
- `imagemGerada?`
- `imagemGeradaFingerprint?`
- `imagemGeradaAt?`
- `imagemModelo?`
- `imagemModeloAt?`

Operacoes principais:
- criar/atualizar/deletar vinculo
- listar por cor ou por tecido
- verificar existencia de vinculo

### useEstampas
Arquivo: `frontend/src/hooks/useEstampas.ts`

CRUD de estampas com suporte a cadastro em lote.

### useTamanhos
Arquivo: `frontend/src/hooks/useTamanhos.ts`

CRUD de tamanhos e ordenacao.

### useCapturaLista
Arquivo: `frontend/src/hooks/useCapturaLista.ts`

Lista de capturas com validacao automatica de conflitos Delta E.

### useColorimetro
Arquivo: `frontend/src/hooks/useColorimetro.ts`

Integracao BLE com LS173 e parse de dados LAB.

### useReinhardTingimento
Arquivo: `frontend/src/hooks/useReinhardTingimento.ts`

Processamento de tingimento em canvas no frontend.

### useReinhardML
Arquivo: `frontend/src/hooks/useReinhardML.ts`

Treino e inferencia do suporte ML para ajustes de tingimento.

## Hooks de Shopee

### useShopee
Arquivo: `frontend/src/hooks/useShopee.ts`

Conexao de loja(s) Shopee.

### useShopeeProducts
Arquivo: `frontend/src/hooks/useShopeeProducts.ts`

CRUD e publicacao de anuncios.

Dados relevantes nesta fase:
- suporta `titulo_anuncio`
- usa `imagens_principais`
- publica combinacoes de variacao com imagens por cor

### useShopeeCategories
Arquivo: `frontend/src/hooks/useShopeeCategories.ts`

Carrega e navega na arvore de categorias.

### Outros hooks Shopee
- `useShopeePreferences.ts`
- `useShopeeTemplates.ts`
- `useShopeeLogistics.ts`
- `useShopeeSync.ts`
- `useShopeeAnalytics.ts`

## Utilitarios de navegacao (nao hook)

### modules.ts
Arquivo: `frontend/src/navigation/modules.ts`

Define `PageId`, grupos de menu e atalhos.

### url-state.ts
Arquivo: `frontend/src/navigation/url-state.ts`

Responsavel por:
- parse de hash para `PageId`
- serializacao de hash por pagina
- sync de URL via `pushState`/`replaceState`

## Testes de navegacao

- `frontend/src/navigation/url-state.test.ts`
- `frontend/src/pages/Home.navigation.test.tsx`
- `frontend/src/pages/Cores.navigation.test.tsx`
- `frontend/src/pages/Shopee.navigation.test.tsx`
- `frontend/src/pages/GestaoImagens.regeneration.test.tsx`

Esses testes cobrem o comportamento de hash, atalhos e callbacks de navegacao cruzada.
