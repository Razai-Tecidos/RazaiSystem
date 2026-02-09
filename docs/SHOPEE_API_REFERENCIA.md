# Referência da API Shopee — add_item

Payload validado em produção (2026-02-09). Produto criado com sucesso: item_id 46356035385.

---

## 1. PAYLOAD CORRETO (VALIDADO)

```json
{
  "item_name": "Anarruga 96% Poliéster - 4% Elastano",
  "description": "Descrição com mínimo 100 caracteres...",
  "item_sku": "T001",
  "original_price": 10,
  "seller_stock": [{ "stock": 100 }],
  "category_id": 100416,
  "weight": 0.3,
  "dimension": {
    "package_length": 30,
    "package_width": 30,
    "package_height": 10
  },
  "image": {
    "image_id_list": ["sg-11134201-xxxx-xxxxx"]
  },
  "tier_variation": [
    {
      "name": "Cor",
      "option_list": [
        { "option": "Azul", "image": { "image_id": "sg-xxx" } }
      ]
    },
    {
      "name": "Tamanho",
      "option_list": [
        { "option": "1m x 1,60m" }
      ]
    }
  ],
  "model": [
    {
      "model_sku": "T001-AZ001-TAM006",
      "tier_index": [0, 0],
      "original_price": 10,
      "seller_stock": [{ "stock": 100 }]
    }
  ],
  "logistic_info": [
    { "logistic_id": 90033, "enabled": true }
  ],
  "condition": "NEW",
  "item_status": "NORMAL",
  "pre_order": { "is_pre_order": false },
  "days_to_ship": 2,
  "brand": {
    "brand_id": 0,
    "original_brand_name": "No Brand"
  }
}
```

---

## 2. REGRAS CRÍTICAS (APRENDIDAS NA PRÁTICA)

### 2.1 seller_stock — OBRIGATÓRIO EM DOIS NÍVEIS
```
✅ Top-level:  "seller_stock": [{ "stock": 100 }]
✅ Cada model: "seller_stock": [{ "stock": 100 }]
❌ NÃO usar stock_info_v2 (campo de update_stock, não de add_item)
❌ NÃO omitir seller_stock (erro: "invalid field seller_stock, value must Not Null")
```

### 2.2 brand — AMBOS CAMPOS OBRIGATÓRIOS
```
✅ { "brand_id": 0, "original_brand_name": "No Brand" }
❌ { "brand_id": 0 }  (falta original_brand_name → erro)
❌ Omitir brand  (API aceita mas pode falhar em algumas categorias)
```

### 2.3 image — USAR image_id, NÃO URL
```
✅ "image": { "image_id_list": ["sg-11134201-xxxx"] }
✅ Variação: "image": { "image_id": "sg-11134201-xxxx" }
❌ "image": { "image_url_list": [...] }  (campo errado para add_item)
```
Upload retorna `image_id` via `POST /api/v2/mediaspace/upload_image` (multipart/form-data).

### 2.4 Imagens — Compressão obrigatória
- Máximo 2MB por imagem
- Formato: JPG/PNG
- Sistema comprime automaticamente via Sharp antes do upload
- Proporção 1:1 recomendada (500x500 mínimo)

---

## 3. CAMPOS DO PAYLOAD

### Obrigatórios
| Campo | Tipo | Limites |
|-------|------|---------|
| `item_name` | string | 20-120 caracteres |
| `description` | string | 100-3000 caracteres |
| `original_price` | float | 0.01 - 999999999 |
| `seller_stock` | object[] | `[{ stock: N }]` |
| `category_id` | int | ID válido Shopee |
| `weight` | float | 0.001 - 300 kg |
| `dimension` | object | package_length/width/height (cm) |
| `image.image_id_list` | string[] | 1-9 image_ids |
| `logistic_info` | object[] | Pelo menos 1 canal habilitado |
| `condition` | string | "NEW" ou "USED" |
| `item_status` | string | "NORMAL" ou "UNLIST" |

### Condicionais (quando há variações)
| Campo | Tipo | Notas |
|-------|------|-------|
| `tier_variation` | object[] | Máx 2 tiers, máx 50 opções cada |
| `model` | object[] | Máx 50 modelos. Cada um: model_sku, tier_index, original_price, seller_stock |

### Opcionais
| Campo | Tipo | Notas |
|-------|------|-------|
| `brand` | object | `{brand_id, original_brand_name}` — recomendado sempre enviar |
| `item_sku` | string | Máx 100 caracteres |
| `pre_order` | object | `{is_pre_order: bool, days_to_ship?: int}` |
| `days_to_ship` | int | 1-3 se não pre-order |
| `attribute_list` | object[] | Atributos obrigatórios da categoria |
| `video` | object | `{video_url: string}` |
| `size_chart` | int | ID do size chart |
| `wholesale` | object[] | Tiers de preço atacado |
| `description_type` | string | "normal" ou "extended" |
| `extended_description` | object | Para vendedores whitelisted |
| `tax_info` | object | NCM, GTIN (dentro de cada model) |

---

## 4. ERROS COMUNS E SOLUÇÕES

| Erro | Causa | Solução |
|------|-------|---------|
| `seller_stock, value must Not Null` | seller_stock faltando no top-level ou model | Incluir em AMBOS níveis |
| `api_suspended` | Endpoint path errado | Verificar path correto na doc |
| Brand rejeitado | Falta `original_brand_name` | Enviar ambos: `brand_id` + `original_brand_name` |
| Image validation | Imagem > 2MB ou formato errado | Comprimir com Sharp antes do upload |
| Logistic info | Peso/dimensões incompatíveis | Verificar limites do canal logístico |
| Category attribute | Atributo obrigatório faltando | Buscar via `get_attribute_tree` |

---

## 5. ENDPOINTS VALIDADOS

| Endpoint | Path | Método |
|----------|------|--------|
| Criar item | `/api/v2/product/add_item` | POST |
| Init variações | `/api/v2/product/init_tier_variation` | POST |
| Add modelos | `/api/v2/product/add_model` | POST |
| Deletar item | `/api/v2/product/delete_item` | POST |
| Upload imagem | `/api/v2/mediaspace/upload_image` | POST (multipart) |
| Categorias | `/api/v2/product/get_category` | GET |
| Atributos | `/api/v2/product/get_attribute_tree` | GET |
| Marcas | `/api/v2/product/get_brand_list` | GET |
| Limites | `/api/v2/product/get_item_limit` | GET |
| Lista itens | `/api/v2/product/get_item_list` | GET |
| Info item | `/api/v2/product/get_item_base_info` | GET |
| Modelos | `/api/v2/product/get_model_list` | GET |
| Update modelo | `/api/v2/product/update_model` | POST |
| Update preço | `/api/v2/product/update_price` | POST |
| Update estoque | `/api/v2/product/update_stock` | POST |
| Logística | `/api/v2/logistics/get_channel_list` | GET |
| Warehouse | `/api/v2/shop/get_warehouse_detail` | GET |

**Endpoints que NÃO existem:**
- `get_attributes` → usar `get_attribute_tree`
- `support_size_chart` (só em `globalproductcb_seller_only`)
- `media_space/upload_image` → usar `mediaspace/upload_image`

---

## 6. FLUXO DE PUBLICAÇÃO (publishProduct) — 2 chamadas

**CRÍTICO: `add_item` NÃO aceita `tier_variation` nem `model` — Shopee ignora silenciosamente!**

```
1. Lê rascunho do Firestore
2. Verifica permissão (created_by === userId)
3. Busca dados do tecido (formatação nome/descrição)
4. Valida payload (shopee-validation.ts)
5. Atualiza status → "publishing"
6. Busca access_token (ensureValidToken)
7. Busca canais logísticos (buildLogisticInfoForProduct)
8. Upload imagens principais (comprime → upload → retorna image_id)
9. Upload imagens de variação (cores com overlay)
10. POST /api/v2/product/add_item (SEM variações)
11. Aguarda 5 segundos
12. POST /api/v2/product/init_tier_variation (tiers + models)
13. Atualiza Firestore: item_id, status="created", published_at
```

**Dry-run:** `POST /:id/publish?dry_run=true` — retorna `{ add_item, init_tier_variation }`.

---

## 6.1 init_tier_variation — Formato Correto

**Usa `standardise_tier_variation` (NÃO `tier_variation`)**

```json
{
  "item_id": 12345,
  "standardise_tier_variation": [
    {
      "variation_id": 0,
      "variation_group_id": 0,
      "variation_name": "Cor",
      "variation_option_list": [
        { "variation_option_id": 0, "variation_option_name": "Azul", "image_id": "sg-xxx" }
      ]
    },
    {
      "variation_id": 0,
      "variation_group_id": 0,
      "variation_name": "Tamanho",
      "variation_option_list": [
        { "variation_option_id": 0, "variation_option_name": "1m x 1,50m" }
      ]
    }
  ],
  "model": [
    {
      "tier_index": [0, 0],
      "model_sku": "T001-AZ001-TAM006",
      "original_price": 10,
      "seller_stock": [{ "stock": 100 }]
    }
  ]
}
```

**Diferenças do formato antigo:**
| add_item (antigo, errado) | init_tier_variation (correto) |
|---------------------------|-------------------------------|
| `tier_variation` | `standardise_tier_variation` |
| `name` | `variation_name` |
| `option_list` | `variation_option_list` |
| `option` | `variation_option_name` |
| `image: { image_id }` | `image_id` (direto) |
| — | `variation_id: 0` |
| — | `variation_option_id: 0` |
| — | `variation_group_id: 0` |

---

## 7. CONFIGURAÇÃO DA LOJA (803215808)

- **Multi-warehouse:** NÃO (whitelist error)
- **Logísticas:** SPX Entrega Rápida (90033), Shopee Xpress (91003), Retirada (90024)
- **Ambiente:** Produção (partner.shopeemobile.com)
- **Credenciais:** .env em `functions/.env` (SHOPEE_PARTNER_ID, SHOPEE_PARTNER_KEY)
