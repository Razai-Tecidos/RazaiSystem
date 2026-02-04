# Integração Shopee

Documentação dos endpoints e do fluxo de integração Shopee no RazaiSystem.

## Visão geral

A integração Shopee usa:
- **Frontend** para autenticação do usuário e UI de gestão.
- **Firebase Functions** como backend para assinar chamadas e centralizar regras.

## Endpoints disponíveis

### POST `/api/shopee/inventory`

Agrega dados de anúncios, detalhes e modelos em uma resposta normalizada.

**Request**
```json
{
  "shop_id": 803215808,
  "page_size": 50,
  "offset": 0
}
```

**Response**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "item_id": "123456",
        "item_status": "NORMAL",
        "item_name": "Produto X",
        "item_sku": "SKU-123",
        "variation_options": ["Azul", "Preto"],
        "models": [
          {
            "model_id": 987,
            "model_name": "Azul",
            "model_status": "NORMAL",
            "total_available_stock": 48,
            "color_option": "Azul"
          }
        ]
      }
    ]
  }
}
```

### POST `/api/shopee/update-color-availability`

Controla disponibilidade de cores através do estoque (não usa mais `model_status`).  
Quando `model_status = UNAVAILABLE`, zera o estoque para 0 e inicia monitoramento automático.  
Quando `model_status = NORMAL`, remove o monitoramento e atualiza o estoque para o valor especificado.

**Request (múltiplos anúncios do mesmo SKU)**
```json
{
  "shop_id": 803215808,
  "model_status": "UNAVAILABLE",
  "item_sku": "SKU-123",
  "color_option": "Azul",
  "targets": [
    { "item_id": "111", "model_ids": [1, 2, 3] },
    { "item_id": "222", "model_ids": [4, 5] }
  ]
}
```

**Request com estoque ao voltar para NORMAL**
```json
{
  "shop_id": 803215808,
  "model_status": "NORMAL",
  "item_sku": "SKU-123",
  "color_option": "Azul",
  "stock": 500,
  "targets": [
    { "item_id": "111", "model_ids": [1, 2, 3] }
  ]
}
```

**Response**
```json
{
  "success": true,
  "data": {
    "results": [
      {
        "item_id": 111,
        "model_id": 1,
        "response": {
          "success": true,
          "message": "Estoque zerado"
        }
      }
    ]
  },
  "stockBased": true
}
```

**Comportamento:**
- **UNAVAILABLE**: Zera estoque para 0, salva estado no Firestore (`disabled_colors`) para monitoramento contínuo
- **NORMAL**: Remove do Firestore, atualiza estoque para o valor especificado (padrão: 500)

**Nota**: O sistema não usa mais `model_status` da API Shopee (não suportado para todos os tipos de vendedores). Usa apenas controle de estoque.

### POST `/api/shopee/update-model-status`

Atualiza o status de um único modelo.

**Request**
```json
{
  "shop_id": 803215808,
  "model_id": 987,
  "model_status": "UNAVAILABLE"
}
```

### POST `/api/shopee/webhook`

Endpoint público para receber webhooks da Shopee.  
Processa eventos `reserved_stock_change_push` para manter estoque zerado quando pedidos são cancelados.

**Headers**
```
x-shopee-signature: <HMAC-SHA256 signature>
```

**Request (reserved_stock_change_push)**
```json
{
  "code": 8,
  "data": {
    "shop_id": 803215808,
    "item_id": 123456,
    "variation_id": 789,
    "action": "cancel_order",
    "changed_values": [
      {
        "name": "reserved_stock",
        "old": 10,
        "new": 11
      }
    ]
  },
  "timestamp": 1660124246
}
```

**Response**
```json
{
  "success": true
}
```

**Nota:** Sempre retorna 200 para evitar retries desnecessários pela Shopee.

### POST `/api/shopee/proxy`

Proxy genérico para endpoints `v2` da Shopee (somente `/api/v2/*`).

**Request**
```json
{
  "shop_id": 803215808,
  "path": "/api/v2/product/get_item_list",
  "method": "GET",
  "query": { "item_status": "NORMAL", "page_size": 20, "offset": 0 }
}
```

## Fluxo de listagem oficial

1. `get_item_list` → IDs e status
2. `get_item_base_info` → `item_name`, `item_sku`
3. `get_model_list` → `model_status`, `total_available_stock`, cor (`tier_variation[0]`)

## Toggle por cor (regra atual)

- O toggle é por **cor** (primeira variação) agrupada por `item_sku`.
- **Desativar**: 
  - Estoque é zerado para 0 (não usa mais `model_status`)
  - Estado é salvo no Firestore (`disabled_colors`) para monitoramento contínuo
  - Sistema monitora automaticamente via webhook e função agendada
- **Ativar**: 
  - Estoque é atualizado para 500 unidades
  - Estado é removido do Firestore (para de monitorar)

**Importante**: O sistema determina se uma cor está desativada verificando se o `total_available_stock === 0`, não mais através de `model_status`.

## Monitoramento automático de estoque

Quando uma cor é desativada, o sistema implementa duas camadas de proteção para manter o estoque zerado:

### 1. Webhook `reserved_stock_change_push`
- **Evento**: Quando um pedido não pago é cancelado e o estoque reservado retorna ao disponível
- **Ação**: Detecta automaticamente e zera o estoque novamente
- **Configuração**: Deve ser configurado no Shopee Partner Center:
  - URL: `https://us-central1-razaisystem.cloudfunctions.net/api/api/shopee/webhook`
  - Evento: `reserved_stock_change_push` (Code: 8)

### 2. Função agendada `maintainDisabledColors`
- **Frequência**: Executa a cada 1 hora
- **Ação**: Verifica todas as cores desativadas e zera estoque se encontrar valores > 0
- **Fallback**: Garante que mesmo se o webhook falhar, o estoque será corrigido periodicamente

### Estrutura Firestore `disabled_colors`

```typescript
{
  shop_id: number;
  item_sku: string;
  color_option: string;
  item_ids: string[];      // IDs de todos os anúncios com esse SKU
  model_ids: number[];     // IDs de todos os modelos dessa cor
  disabled_at: Timestamp;
  disabled_by: string;     // UID do usuário
  last_maintained: Timestamp;  // Última vez que foi verificado/zerado
}
```

**Índices necessários:**
- `shop_id` (ascending)
- `disabled_at` (descending)
- Composto: `shop_id` + `item_ids` + `model_ids`

## Observações

- `total_available_stock` vem de `stock_info_v2.summary_info.total_available_stock`.
- O sistema **não usa mais `model_status`** - usa apenas controle de estoque para determinar disponibilidade.
- `model_status` da API Shopee só é suportado para vendedores CNSC (China Cross-border) e KRSC (Korea Cross-border).
- O sistema foi adaptado para funcionar com todos os tipos de vendedores usando apenas controle de estoque.

## Configuração do Webhook

Para configurar o webhook `reserved_stock_change_push` no Shopee Partner Center, consulte o guia completo:

📖 **[SHOPEE_WEBHOOK_SETUP.md](SHOPEE_WEBHOOK_SETUP.md)** - Guia passo a passo completo

**Resumo rápido**:
1. Acesse https://open.shopee.com/
2. Vá em Partner Center → Webhooks
3. Configure URL: `https://us-central1-razaisystem.cloudfunctions.net/api/api/shopee/webhook`
4. Selecione evento: `reserved_stock_change_push` (Code: 8)
5. Salve e teste

## Referências

- [Shopee Open Platform - Webhooks](https://open.shopee.com/documents?module=2&type=1&id=365)
- [reserved_stock_change_push Documentation](https://open.shopee.com/documents?module=2&type=1&id=365&subtype=8)
- [Guia de Configuração do Webhook](SHOPEE_WEBHOOK_SETUP.md)
