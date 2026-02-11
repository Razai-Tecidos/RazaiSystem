# Referencia API Shopee (agent-first)

Ultima atualizacao: 2026-02-11

## Leitura rapida
- Source of truth externa: Shopee Open API docs.
- Source of truth interna (implementacao):
  - `functions/src/services/shopee.service.ts`
  - `functions/src/services/shopee-product.service.ts`
  - `functions/src/routes/shopee-*.routes.ts`

## Task -> endpoint -> codigo
- Buscar categorias:
  - Endpoint: `GET /api/v2/product/get_category`
  - Codigo: `functions/src/services/shopee-category.service.ts`
- Buscar atributos da categoria:
  - Endpoint: `GET /api/v2/product/get_attribute_tree`
  - Codigo: `functions/src/services/shopee-category.service.ts`
- Buscar marcas:
  - Endpoint: `GET /api/v2/product/get_brand_list`
  - Codigo: `functions/src/services/shopee-category.service.ts`
- Buscar canais logisticos:
  - Endpoint: `GET /api/v2/logistics/get_channel_list`
  - Codigo: `functions/src/services/shopee-logistics.service.ts`
- Publicar anuncio:
  - Endpoint: `POST /api/v2/product/add_item`
  - Endpoint: `POST /api/v2/product/init_tier_variation`
  - Codigo: `functions/src/services/shopee-product.service.ts`
- Upload de imagem:
  - Endpoint: `POST /api/v2/mediaspace/upload_image` (multipart)
  - Codigo: `functions/src/services/shopee.service.ts`
- Excluir item (rollback/manual):
  - Endpoint: `POST /api/v2/product/delete_item`
  - Codigo: `functions/src/services/shopee-product.service.ts`

## Contrato critico de publicacao

### Regra estrutural
- `add_item` NAO deve levar tier/model completos.
- Variacoes entram em `init_tier_variation`.

### add_item (campos essenciais)
- `item_name`
- `description`
- `original_price`
- `seller_stock` (top-level)
- `category_id`
- `weight`
- `dimension`
- `image.image_id_list`
- `logistic_info`
- `condition`
- `item_status`
- `brand` (`brand_id` + `original_brand_name`)
- `size_chart_info` (quando aplicavel)

### init_tier_variation (campos essenciais)
- `item_id`
- `standardise_tier_variation`
- `model` (com `tier_index`, `model_sku`, `original_price`, `seller_stock`)

## Regras de request que mais quebram
- `seller_stock` precisa existir no nivel correto (top-level e model, conforme endpoint).
- Imagem em Shopee usa `image_id`, nao URL crua.
- `brand` deve ser consistente com obrigatoriedade da categoria.
- Size chart precisa ser valido para a categoria.
- Logistica precisa estar habilitada e compativel com peso/dimensoes.

## Endpoints validados (resumo)

### Produto
- `POST /api/v2/product/add_item`
- `POST /api/v2/product/init_tier_variation`
- `POST /api/v2/product/add_model`
- `POST /api/v2/product/delete_item`
- `GET /api/v2/product/get_item_list`
- `GET /api/v2/product/get_item_base_info`
- `GET /api/v2/product/get_model_list`
- `POST /api/v2/product/update_model`
- `POST /api/v2/product/update_price`
- `POST /api/v2/product/update_stock`

### Catalogo
- `GET /api/v2/product/get_category`
- `GET /api/v2/product/get_attribute_tree`
- `GET /api/v2/product/get_brand_list`
- `GET /api/v2/product/get_item_limit`

### Midia e logistica
- `POST /api/v2/mediaspace/upload_image`
- `GET /api/v2/logistics/get_channel_list`
- `GET /api/v2/shop/get_warehouse_detail`

## Endpoints bloqueados por politica interna
Nao implementar em projetos:
- `v2.order.get_order_detail`
- `v2.returns.get_return_list`
- `v2.returns.get_return_detail`
- `v2.order.get_buyer_invoice_info`

## Idioma/regionalizacao
- Quando suportado no endpoint, preferir parametros de linguagem/regiao em portugues (`pt-BR`/`BR`).
- Em caso de conflito de contrato, prevalece o campo exigido pela documentacao oficial do endpoint.

## Checklist pre-publish (agente)
1. Categoria escolhida e valida.
2. Atributos obrigatorios preenchidos.
3. Marca valida para categoria.
4. Logistica habilitada e compativel.
5. Imagens convertidas para `image_id`.
6. Payload `add_item` sem campos de variacao fora de lugar.
7. `init_tier_variation` com `standardise_tier_variation` e `model` validos.

## Comandos rapidos de localizacao
```powershell
rg -n "add_item|init_tier_variation|upload_image|get_attribute_tree|get_brand_list|get_channel_list" functions/src
rg -n "callShopeeApi|ensureValidToken|uploadImageToShopeeMultipart" functions/src/services
```
