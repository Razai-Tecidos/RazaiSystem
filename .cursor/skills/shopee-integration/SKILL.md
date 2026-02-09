---
name: shopee-integration
description: Referência completa da integração com a API Shopee no RazaiSystem. Use quando trabalhar com endpoints Shopee, criar/editar anúncios, manipular estoque, upload de imagens, ou resolver problemas de integração com a Shopee.
---

# Integração Shopee - RazaiSystem

> A documentação oficial da Shopee é uma SPA que NÃO carrega via fetch/web scraping. Todo conhecimento necessário está neste arquivo.

## Endpoints Shopee Utilizados

### Autenticação
| Endpoint | Método | Onde é chamado |
|---|---|---|
| `/api/v2/auth/token/get` | POST | `shopee.service.ts` → `getAccessToken()` |
| `/api/v2/auth/access_token/get` | POST | `shopee.service.ts` → `refreshAccessToken()` |

### Produto
| Endpoint | Método | Onde é chamado | Observação |
|---|---|---|---|
| `/api/v2/product/add_item` | POST | `shopee-product.service.ts` → `publishProduct()` | Payload complexo, ver abaixo |
| `/api/v2/product/get_item_list` | GET | `shopee.routes.ts` | Paginado |
| `/api/v2/product/get_item_base_info` | GET | `shopee.routes.ts`, `shopee-sync.service.ts` | Até 50 item_ids |
| `/api/v2/product/get_model_list` | GET | `shopee.routes.ts`, `maintain-disabled-colors.ts` | Modelos/variações |
| `/api/v2/product/update_stock` | POST | `shopee.routes.ts`, `shopee-webhook.service.ts` | Formato seller_stock |
| `/api/v2/product/update_price` | POST | `shopee.service.ts` → `updatePrice()` | |
| `/api/v2/product/get_category` | GET | `shopee-category.service.ts` | Cache 24h no Firestore |
| `/api/v2/product/get_attributes` | GET | `shopee-category.service.ts` | Atributos obrigatórios |
| `/api/v2/product/get_brand_list` | GET | `shopee-category.service.ts` | Marcas por categoria |
| `/api/v2/product/get_item_limit` | GET | `shopee-item-limit.service.ts` | Limites do vendedor |
| `/api/v2/product/get_size_chart_list` | GET | `shopee-item-limit.service.ts` | |
| `/api/v2/product/support_size_chart` | GET | `shopee-item-limit.service.ts` | |

### Mídia
| Endpoint | Método | Onde é chamado | Observação |
|---|---|---|---|
| `/api/v2/media_space/upload_image` | POST | `shopee-product.service.ts` → `uploadImageToShopee()` | **MULTIPART/FORM-DATA, não JSON** |

### Pagamentos
| Endpoint | Método | Onde é chamado |
|---|---|---|
| `/api/v2/payment/get_escrow_list` | GET | `shopee.service.ts` |
| `/api/v2/payment/get_escrow_detail` | GET | `shopee.service.ts` |
| `/api/v2/payment/get_escrow_detail_batch` | GET | `shopee.service.ts` |
| `/api/v2/payment/get_income_overview` | GET | `shopee.service.ts` |
| `/api/v2/payment/generate_income_report` | POST | `shopee.service.ts` |
| `/api/v2/payment/get_income_report` | GET | `shopee.service.ts` |

### Pedidos
| Endpoint | Método | Onde é chamado |
|---|---|---|
| `/api/v2/order/get_order_list` | GET | `shopee.service.ts` |
| `/api/v2/order/get_order_detail` | GET | `shopee.service.ts` |

### Logística
| Endpoint | Método | Onde é chamado |
|---|---|---|
| `/api/v2/logistics/get_channel_list` | GET | `shopee-logistics.service.ts` |

## Payload add_item (Estrutura Real)

```json
{
  "original_price": 29.90,
  "description": "Tecido Oxford Premium...",
  "item_name": "Tecido Oxford Premium - Azul",
  "normal_stock": 100,
  "logistic_info": [{ "logistic_id": 123, "enabled": true }],
  "attribute_list": [
    { "attribute_id": 123, "attribute_value_list": [{ "value_id": 456 }] }
  ],
  "category_id": 100636,
  "image": {
    "image_id_list": ["sg-123456"]
  },
  "weight": 0.5,
  "item_status": "NORMAL",
  "dimension": {
    "package_length": 30,
    "package_width": 20,
    "package_height": 5
  },
  "condition": "NEW",
  "item_sku": "T007",
  "pre_order": {
    "is_pre_order": false
  },
  "days_to_ship": 2,
  "tier_variation": [
    {
      "name": "Cor",
      "option_list": [
        { "option": "Azul Royal", "image": { "image_id": "sg-111" } },
        { "option": "Vermelho", "image": { "image_id": "sg-222" } }
      ]
    },
    {
      "name": "Tamanho",
      "option_list": [
        { "option": "P" },
        { "option": "M" },
        { "option": "G" }
      ]
    }
  ],
  "model": [
    {
      "tier_index": [0, 0],
      "normal_stock": 10,
      "original_price": 25.90,
      "model_sku": "T007-AZ001-P",
      "seller_stock": [{ "stock": 10 }],
      "tax_info": {
        "ncm": "58013600",
        "gtin": "00",
        "item_name_in_invoice": "Tecido Oxford Azul Royal P"
      }
    }
  ]
}
```

## Gotchas Conhecidos (Bugs Evitados)

### 1. Upload de Imagem: MULTIPART, não JSON
```typescript
// ERRADO - Shopee rejeita
await callShopeeApi({ path: '/api/v2/media_space/upload_image', body: { image: base64 } });

// CORRETO - Usar uploadImageToShopeeMultipart()
import { uploadImageToShopeeMultipart } from '../services/shopee.service';
await uploadImageToShopeeMultipart(shopId, accessToken, imageBuffer, 'image.jpg');
```
Arquivo: `functions/src/services/shopee.service.ts` → `uploadImageToShopeeMultipart()`

### 2. update_stock: Formato seller_stock
```typescript
// ERRADO
body: { item_id, stock_list: [{ model_id, stock: 0 }] }

// CORRETO
body: { item_id, stock_list: [{ model_id, seller_stock: [{ stock: 0 }] }] }
```

### 3. Preço: Por TAMANHO, não por COR
- Frontend: `precosPorTamanho: Record<string, number>` (tamanhoId → preço)
- Backend: `buildModelList()` aplica preço do tamanho a todas as cores daquele tamanho
- Se não tem tamanhos: usa `preco_base` como preço único

### 4. Dimensões do Pacote
- Shopee API usa dimensões ÚNICAS para o produto inteiro (não por variação)
- Campos: `package_length`, `package_width`, `package_height` (em cm)
- Campo `weight` em kg

### 5. Categorias: parent_category_id pode ser NULL
```typescript
// ERRADO - Firestore rejeita undefined
parent_category_id: cat.parent_category_id  // pode ser undefined

// CORRETO
parent_category_id: cat.parent_category_id ?? null
```

### 6. pre_order e days_to_ship
```typescript
// Se NÃO é pre-order: days_to_ship no root (1-3 dias)
// Se É pre-order: days_to_ship DENTRO de pre_order (7-30 dias)
pre_order: {
  is_pre_order: false
},
days_to_ship: 2  // root level

// vs
pre_order: {
  is_pre_order: true,
  days_to_ship: 15  // dentro de pre_order
}
// SEM days_to_ship no root
```

### 7. Payload: Remover undefined antes de enviar
```typescript
// Shopee rejeita campos com valor undefined
// Usar removeUndefinedValues() em shopee-product.service.ts
const cleanPayload = removeUndefinedValues(shopeePayload);
```

### 8. Imagens Shopee
- Máximo: 9 imagens principais (galeria) + 1 por variação de cor
- Formato: JPG, PNG
- Tamanho máximo: 2MB (nosso target: 1.99MB)
- Resolução mínima: 500x500px
- Aspecto: 1:1 (quadrada) - sistema adiciona padding branco se necessário
- Compressão backend: `image-compressor.service.ts` (sharp, mantém formato original)

## Fluxo de Publicação

```
1. Frontend cria rascunho (POST /api/shopee/products)
   → Salva em shopee_products com status: 'draft'

2. Frontend solicita publicação (POST /api/shopee/products/:id/publish)
   → Backend:
     a. Busca rascunho do Firestore
     b. Busca dados do tecido, cores, tamanhos
     c. Upload de imagens → uploadImageToShopeeMultipart()
     d. Monta payload add_item
     e. removeUndefinedValues() no payload
     f. Chama /api/v2/product/add_item
     g. Salva item_id no Firestore, status: 'published'
```

## Assinatura da API Shopee

```typescript
// functions/src/config/shopee.ts
sign = HMAC-SHA256(partnerKey, partnerId + path + timestamp + accessToken + shopId)
```

Todas as chamadas passam por `callShopeeApi()` em `shopee.service.ts`, que:
1. Monta a URL com partner_id, timestamp, sign, shop_id, access_token
2. Adiciona headers `Content-Type: application/json`
3. Faz a request via axios

**Exceção**: Upload de imagem usa `uploadImageToShopeeMultipart()` com `Content-Type: multipart/form-data`

## Push Mechanism (Webhooks)

Endpoint: `POST /api/shopee/webhook`
Eventos habilitados:
- `order_status_push` → Atualiza status do pedido
- `reserved_stock_change_push` → Atualiza estoque reservado
- `video_upload_push` → Status de upload de vídeo
- `violation_item_push` → Alerta de violação
- `item_price_update_push` → Sync de preço
- `item_scheduled_publish_failed_push` → Falha de publicação agendada

Processamento: `shopee-webhook.service.ts` → salva em `shopee_webhook_logs` e `shopee_order_events`
