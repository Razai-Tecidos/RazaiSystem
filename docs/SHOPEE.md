# Integracao Shopee

Ultima atualizacao: 2026-02-12

## Leitura rapida (para agentes)
1. Fluxo de anuncio end-to-end: `docs/SHOPEE_ANUNCIOS.md`
2. Status e historico consolidado: `docs/SHOPEE_ANUNCIOS.md` + `docs/ENTREGAS_2026-02-11.md`
3. Endpoints e contratos: `docs/SHOPEE_API_REFERENCIA.md`
4. Entrypoints de codigo:
- `frontend/src/pages/CriarAnuncioShopee.tsx`
- `functions/src/services/shopee-product.service.ts`
- `functions/src/routes/shopee-products.routes.ts`

## Entrypoints de codigo (onde comecar)
- Assinatura e chamadas Shopee Open API:
  - `functions/src/services/shopee.service.ts`
- Publicacao/sync de anuncios:
  - `functions/src/services/shopee-product.service.ts`
  - `functions/src/routes/shopee-products.routes.ts`
- Categorias, atributos, marcas:
  - `functions/src/services/shopee-category.service.ts`
  - `functions/src/routes/shopee-categories.routes.ts`
- Logistica:
  - `functions/src/services/shopee-logistics.service.ts`
  - `functions/src/routes/shopee-logistics.routes.ts`
- Item limit / size chart:
  - `functions/src/services/shopee-item-limit.service.ts`
  - `functions/src/routes/shopee-item-limit.routes.ts`
- UI de criacao Shopee:
  - `frontend/src/pages/CriarAnuncioShopee.tsx`
  - `frontend/src/components/Shopee/*.tsx`

## Task -> arquivo
- Mudar ordem dos steps de criacao:
  - `frontend/src/pages/CriarAnuncioShopee.tsx`
- Mudar formula de preco/lucro:
  - `frontend/src/lib/shopeePricing.ts`
- Mudar payload de publish (`add_item` / `init_tier_variation` / `update_item`):
  - `functions/src/services/shopee-product.service.ts`
- Mudar validacoes pre-publish (atributos/marca/logistica/size chart):
  - `functions/src/services/shopee-product.service.ts`
  - `frontend/src/components/Shopee/CategoryAttributes.tsx`
  - `frontend/src/components/Shopee/BrandSelector.tsx`
  - `frontend/src/components/Shopee/SizeChartSelector.tsx`
- Mudar auto-fill de atributos (material, estampa, largura, comprimento):
  - `frontend/src/components/Shopee/CategoryAttributes.tsx` (logica de auto-fill + `ATTR_UNITS`)
  - `frontend/src/pages/CriarAnuncioShopee.tsx` (monta `tecidoDataForAttributes`)
- Mudar defaults/preferencias Shopee:
  - `functions/src/services/shopee-preferences.service.ts`
  - `functions/src/routes/shopee-preferences.routes.ts`
  - `frontend/src/hooks/useShopeePreferences.ts`

## Rotas de operacao (resumo)

### Inventario e disponibilidade
- `POST /api/shopee/inventory`
- `POST /api/shopee/update-color-availability`
- `POST /api/shopee/update-model-status`

### Produtos e anuncios
- `GET /api/shopee/products`
- `GET /api/shopee/products/:id`
- `POST /api/shopee/products`
- `PUT /api/shopee/products/:id`
- `DELETE /api/shopee/products/:id`
- `POST /api/shopee/products/:id/publish`
- `POST /api/shopee/products/:id/sync`
- `POST /api/shopee/products/sync-all`

### Categorias, logistica e preferencias
- `GET /api/shopee/categories`
- `GET /api/shopee/categories/:id/attributes`
- `GET /api/shopee/categories/:id/brands`
- `GET /api/shopee/logistics/enabled`
- `GET /api/shopee/preferences/defaults`

### Webhook
- `POST /api/shopee/webhook`

## Fluxos criticos

### Publish (3 etapas API)
1. Validar draft + ownership + pre-publish (atributos, marca, logistica, size chart).
2. Adquirir lock transacional (`publish_lock` com TTL).
3. Upload de imagens (1:1 + variacoes) para `image_id` (com retry/backoff).
4. `add_item` (item base, SEM tier/model).
5. Esperar 5s (tempo de processamento Shopee).
6. `init_tier_variation` (tiers + models).
7. Esperar 5s, entao `update_item` para imagens 3:4 (com retry se `not_found`).
8. Persistir `item_id`, status e sincronizacao.
9. Em falha parcial, executar rollback (`delete_item`).

### Estoque por disponibilidade
- Regra principal: disponibilidade de cor por estoque (`total_available_stock`), nao por `model_status`.
- Cor desativada: estoque `0`.
- Cor ativada: estoque volta para valor configurado.

## Comandos rapidos
```powershell
# localizar rotas Shopee
rg -n "router\.(get|post|put|delete)\('/api/shopee|/:id/publish|sync-all" functions/src/routes

# localizar payload de publish
rg -n "add_item|init_tier_variation|update_item|size_chart_info|publish_lock" functions/src/services/shopee-product.service.ts

# localizar validacao de steps no frontend
rg -n "canProceedFrom|validationErrors|STEP_ORDER" frontend/src/pages/CriarAnuncioShopee.tsx

# localizar auto-fill de atributos
rg -n "buildDynamicDefaults|ATTR_UNITS|DYNAMIC_ATTR_KEYS|autoFilledRef" frontend/src/components/Shopee/CategoryAttributes.tsx

# localizar dados de tecido para auto-fill
rg -n "tecidoDataForAttributes|extractMetersFromTamanhoNome" frontend/src/pages/CriarAnuncioShopee.tsx
```

## Documentos relacionados
- Fluxo de anuncio: `docs/SHOPEE_ANUNCIOS.md`
- Historico consolidado de entregas: `docs/ENTREGAS_2026-02-11.md`
- Referencia de endpoints: `docs/SHOPEE_API_REFERENCIA.md`
- Setup de webhook: `docs/SHOPEE_WEBHOOK_SETUP.md`
- Revisao de estoque: `docs/SHOPEE_STOCK_REVIEW.md`
