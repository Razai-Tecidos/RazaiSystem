---
name: razai-system-map
description: Mapa completo do projeto RazaiSystem. Use SEMPRE como primeira ação ao trabalhar em qualquer arquivo do projeto. Contém estrutura, endpoints, collections Firestore, relações entre entidades, e mapa de páginas/hooks/serviços.
---

# Mapa do Projeto RazaiSystem

## Arquitetura

```
RazaiSystem/
├── functions/src/     # Backend (Cloud Functions + Express)
├── frontend/src/      # Frontend (React + Vite)
├── firestore.rules    # Regras de segurança Firestore
├── firestore.indexes.json  # Índices compostos
├── storage.rules      # Regras Firebase Storage
├── firebase.json      # Config deploy Firebase
└── CONTEXT.md         # Decisões e padrões do projeto
```

- **Backend**: Node.js + Express + TypeScript via Firebase Cloud Functions
- **Frontend**: React 18 + Vite + TypeScript + shadcn/ui + Tailwind CSS
- **DB**: Firestore | **Auth**: Firebase Auth | **Files**: Firebase Storage
- **Shell**: PowerShell (usar `;` em vez de `&&` para encadear comandos)

## Collections Firestore

| Collection | Campos principais | Acesso |
|---|---|---|
| `tecidos` | nome, sku (T001), largura, composicao, imagemPadrao, deletedAt, createdAt | read/write auth |
| `cores` | nome, hex, lab{L,a,b}, sku (AZ001), deletedAt, createdAt | read/write auth |
| `cor_tecido` | corId, tecidoId, corNome, corHex, corSku, tecidoNome, tecidoSku, sku (T007-AZ001), imagemTingida, ajustesReinhard, deletedAt | read/write auth |
| `estampas` | nome, tecidoId, imagemUrl, deletedAt, createdAt | read/write auth |
| `tamanhos` | nome, sku, ordem, ativo, descricao, deletedAt, createdAt | read/write auth |
| `shopee_shops` | shopId, shopName, accessToken, refreshToken, tokenExpiresAt | read auth, write backend-only |
| `shopee_products` | shop_id, item_id, tecido_id, tier_variations[], modelos[], preco_base, precos_por_tamanho, status, categoria_id | read/write auth |
| `shopee_user_preferences` | userId, ncm_padrao, categoria_nome_padrao, peso_padrao, dimensoes_padrao | read/write auth |
| `shopee_product_templates` | nome, created_by, uso_count, configurações do template | read/write auth |
| `shopee_categories_cache` | categories[], updated_at | read auth, write backend-only |
| `shopee_logistics_cache` | channels[], updated_at | read auth, write backend-only |
| `shopee_webhook_logs` | event_type, payload, timestamp | read auth, write backend-only |
| `shopee_order_events` | order_sn, status, timestamp | read auth, write backend-only |
| `disabled_colors` | shop_id, item_id, model_id, vinculo_id, cor_id, disabled_at | read auth, write backend-only |
| `shopee_sku_sales` | shop_id, item_sku, coletadoEm | read/write auth |
| `sku_control` | lastNumber (para tecidos) | read/write auth |
| `sku_control_cor` | lastNumber (para cores) | read/write auth |
| `ml_training_examples` | corId, timestamp | read/write auth |
| `ml_model_metadata` | modelId | read/write auth |
| `system_config` | configId | read/write auth |
| `catalogos` | (público: read sem auth) | read all, write auth |

## Relações entre Entidades

```
tecidos (1) ──── (*) cor_tecido (*) ──── (1) cores
                       │
                       ├── imagemTingida (Reinhard)
                       ├── sku: "TecidoSKU-CorSKU"
                       └── ajustesReinhard
                       
shopee_products usa:
  ├── tecido_id → tecidos
  ├── modelos[].cor_id → cores
  ├── modelos[].tamanho_id → tamanhos
  ├── modelos[].vinculo_id → cor_tecido
  └── categoria_id → shopee_categories_cache
```

## Endpoints API (functions/src/routes/)

### Tecidos `/api/tecidos` → `tecidos.routes.ts`
- GET `/` - Listar tecidos
- POST `/` - Criar tecido
- PUT `/:id` - Atualizar tecido
- DELETE `/:id` - Soft-delete tecido

### Cores `/api/cores` → `cores.routes.ts`
- GET `/` - Listar cores
- POST `/` - Criar cor
- PUT `/:id` - Atualizar cor
- DELETE `/:id` - Soft-delete cor

### Tamanhos `/api/tamanhos` → `tamanhos.routes.ts` → `tamanho.service.ts`
- GET `/` - Listar tamanhos
- POST `/` - Criar tamanho
- PUT `/:id` - Atualizar tamanho
- DELETE `/:id` - Soft-delete tamanho

### Shopee Core `/api/shopee` → `shopee.routes.ts` → `shopee.service.ts`
- GET `/auth-url` - Gerar URL OAuth
- POST `/callback` - Trocar código por tokens
- GET `/shops` - Listar lojas conectadas
- POST `/disconnect` - Desconectar loja
- POST `/api-call` - Proxy genérico para API Shopee
- GET `/products` - Listar produtos (get_item_list + get_item_base_info)
- POST `/toggle-color` - Ativar/desativar cor (update_stock)
- GET `/escrow-list` - Listar pagamentos
- GET `/escrow-detail-batch` - Detalhes de pagamento
- GET `/income-overview` - Resumo financeiro
- GET `/orders` - Listar pedidos
- GET `/order-detail` - Detalhes de pedido
- POST `/update-price` - Atualizar preço

### Shopee Categorias `/api/shopee/categories` → `shopee-categories.routes.ts` → `shopee-category.service.ts`
- GET `/:shopId` - Listar categorias (com cache 24h)
- GET `/:shopId/attributes/:categoryId` - Atributos obrigatórios
- GET `/:shopId/brands/:categoryId` - Marcas da categoria

### Shopee Produtos `/api/shopee/products` → `shopee-products.routes.ts` → `shopee-product.service.ts`
- POST `/` - Criar rascunho
- PUT `/:id` - Atualizar rascunho
- DELETE `/:id` - Deletar rascunho
- POST `/:id/publish` - Publicar na Shopee (add_item)
- GET `/` - Listar rascunhos/produtos

### Shopee Templates `/api/shopee/templates` → `shopee-templates.routes.ts` → `shopee-template.service.ts`
- GET `/` - Listar templates
- POST `/` - Criar template
- PUT `/:id` - Atualizar template
- DELETE `/:id` - Deletar template

### Shopee Preferências `/api/shopee/preferences` → `shopee-preferences.routes.ts` → `shopee-preferences.service.ts`
- GET `/:userId` - Obter preferências
- PUT `/:userId` - Salvar preferências

### Shopee Logística `/api/shopee/logistics` → `shopee-logistics.routes.ts` → `shopee-logistics.service.ts`
- GET `/:shopId` - Listar canais logísticos (com cache)

### Shopee Item Limit `/api/shopee/item-limit` → `shopee-item-limit.routes.ts` → `shopee-item-limit.service.ts`
- GET `/:shopId` - Limites de criação
- GET `/:shopId/size-charts` - Tabelas de medidas
- GET `/:shopId/support-size-chart/:categoryId` - Categoria suporta tabela?

### Shopee Webhook `/api/shopee/webhook` → `shopee-webhook.routes.ts` → `shopee-webhook.service.ts`
- POST `/` - Receber push notifications da Shopee

### Funções Agendadas
- `maintainDisabledColors` → `scheduled/maintain-disabled-colors.ts`
- `scheduledSyncShopeeProducts` → `scheduled/sync-shopee-products.ts`

## Páginas Frontend → Hooks → Backend

| Página | Arquivo | Hooks principais |
|---|---|---|
| Home (menu) | `Home.tsx` | useAuth |
| Login | `Login.tsx` | useAuth |
| Tecidos | `Tecidos.tsx` | useTecidos |
| Cores | `Cores.tsx` | useCores |
| Vínculos | `Vinculos.tsx` | useCorTecido, useTecidos, useCores |
| Editar Vínculo | `EditarVinculo.tsx` | useCorTecido, useReinhardTingimento |
| Captura Cor | `CapturaCor.tsx` | useColorimetro, useBluetooth, useCapturaLista |
| Editar Cor | `EditarCor.tsx` | useCores |
| Tamanhos | `Tamanhos.tsx` | useTamanhos |
| Estampas | `Estampas.tsx` | useEstampas |
| Catálogo | `Catalogo.tsx` | useCatalogos |
| Catálogo Público | `CatalogoPublico.tsx` | (sem auth) |
| Shopee Dashboard | `Shopee.tsx` | useShopee |
| Anúncios Shopee | `AnunciosShopee.tsx` | useShopeeProducts |
| Criar Anúncio | `CriarAnuncioShopee.tsx` | useShopeeProducts, useShopeeCategories, useCorTecido, useTamanhos, useShopeePreferences, useShopeeLogistics |
| Preferências Shopee | `PreferenciasShopee.tsx` | useShopeePreferences |
| Templates Shopee | `TemplatesShopee.tsx` | useShopeeTemplates |
| ML Diagnóstico | `MLDiagnostico.tsx` | useReinhardML |

## Componentes Shopee (frontend/src/components/Shopee/)

| Componente | Função |
|---|---|
| `AdPreview.tsx` | Preview do anúncio antes de publicar |
| `AutoSaveIndicator.tsx` | Indicador de auto-save (debounce 5s) |
| `BrandSelector.tsx` | Seleção de marca da categoria |
| `CategoryAttributes.tsx` | Atributos obrigatórios da categoria |
| `ExtendedDescriptionEditor.tsx` | Editor de descrição estendida |
| `FieldHint.tsx` | Dica contextual para campos |
| `FiscalInfo.tsx` | Informações fiscais (NCM, GTIN) |
| `ShippingConfig.tsx` | Configuração de envio |
| `SizeChartSelector.tsx` | Seleção de tabela de medidas |
| `SyncStatus.tsx` | Status de sincronização |
| `WholesaleConfig.tsx` | Configuração de atacado |

## Tipos TypeScript

| Arquivo (functions/src/types/) | Interfaces principais |
|---|---|
| `shopee-product.types.ts` | ShopeeProduct, CreateShopeeProductData, ProductModel, TierVariation, TaxInfo, ShopeeCategory |
| `shopee-template.types.ts` | ShopeeProductTemplate |
| `shopee-preferences.types.ts` | ShopeeUserPreferences |
| `tamanho.types.ts` | Tamanho, CreateTamanhoData |
| `tecido.types.ts` | Tecido |
| `cor.types.ts` | Cor |

| Arquivo (frontend/src/types/) | Interfaces principais |
|---|---|
| `shopee-product.types.ts` | (mirror do backend) |
| `shopee.types.ts` | ShopeeShop, ShopeeProductItem |
| `tamanho.types.ts` | Tamanho |
| `tecido.types.ts` | Tecido |
| `cor.types.ts` | Cor |
| `estampa.types.ts` | Estampa |

## Padrões Críticos

- **Soft-delete**: Todas as entidades usam `deletedAt: null` (ativo) ou `Timestamp` (deletado)
- **SKU**: Tecidos `T001`, Cores `AZ001` (família), Vínculos `T007-AZ001`, Modelos `T007-AZ001-P`
- **Formato brasileiro**: vírgula como separador decimal, largura em metros
- **UI Otimista**: Atualiza UI antes da confirmação do servidor
- **Preço**: Definido por tamanho (`precos_por_tamanho`), não por cor
- **Imagens**: PNG sem compressão de qualidade, Shopee aceita até 2MB (target 1.99MB)
