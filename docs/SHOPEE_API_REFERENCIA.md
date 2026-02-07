# Referência da API Shopee — add_item

Análise detalhada dos campos da API Shopee `v2.product.add_item` usados no módulo de criação de anúncios.

---

## 1. CAMPOS OBRIGATÓRIOS (CRÍTICOS)

### 1.1 Identificação do Produto
| Campo | Tipo | Obrigatório | Limites | Status |
|-------|------|-------------|---------|--------|
| `item_name` | string | ✅ SIM | 20-120 caracteres | ✅ Implementado |
| `category_id` | int | ✅ SIM | ID válido da Shopee | ✅ Implementado |
| `item_sku` | string | ❌ Não | Máx 100 caracteres | ✅ Implementado |

### 1.2 Descrição
| Campo | Tipo | Obrigatório | Limites | Status |
|-------|------|-------------|---------|--------|
| `description` | string | ✅ SIM | 100-3000 caracteres | ✅ Implementado |
| `description_type` | string | ❌ Não | "normal" ou "extended" | ✅ Implementado |
| `extended_description` | object | ❌ Não | Para vendedores whitelisted | ✅ Implementado |

### 1.3 Preço
| Campo | Tipo | Obrigatório | Limites | Status |
|-------|------|-------------|---------|--------|
| `original_price` | float | ✅ SIM | 0.01 - 999999999 | ✅ Implementado |

### 1.4 Peso e Dimensões
| Campo | Tipo | Obrigatório | Limites | Status |
|-------|------|-------------|---------|--------|
| `weight` | float | ✅ SIM | 0.001 - 300 kg | ✅ Implementado |
| `dimension.package_length` | int | ✅ SIM | 0.1 - 300 cm | ✅ Implementado |
| `dimension.package_width` | int | ✅ SIM | 0.1 - 300 cm | ✅ Implementado |
| `dimension.package_height` | int | ✅ SIM | 0.1 - 300 cm | ✅ Implementado |

### 1.5 Imagens (CRÍTICO)
| Campo | Tipo | Obrigatório | Limites | Status |
|-------|------|-------------|---------|--------|
| `image.image_url_list` | array[string] | ✅ SIM | 1-9 imagens | ✅ Implementado |

**Requisitos de Imagem:**
- **Formato:** JPG, JPEG, PNG
- **Tamanho Recomendado:** 1024x1024 pixels (mínimo 500x500)
- **Proporção:** 1:1 (quadrado)
- **Tamanho Máximo:** 2MB por imagem
- **Quantidade:** Mínimo 1, Máximo 9

### 1.6 Logística (CRÍTICO)
| Campo | Tipo | Obrigatório | Limites | Status |
|-------|------|-------------|---------|--------|
| `logistic_info` | array[object] | ✅ SIM | Pelo menos 1 canal | ✅ Implementado |
| `logistic_info[].logistic_id` | int | ✅ SIM | ID do canal | ✅ Implementado |
| `logistic_info[].enabled` | bool | ✅ SIM | true/false | ✅ Implementado |
| `logistic_info[].size_id` | string | ❌ Não | Se canal usa tamanhos | ✅ Implementado |
| `logistic_info[].shipping_fee` | float | ❌ Não | Taxa de envio | ⚠️ Não implementado |
| `logistic_info[].is_free` | bool | ❌ Não | Frete grátis | ⚠️ Não implementado |

### 1.7 Condição e Status
| Campo | Tipo | Obrigatório | Limites | Status |
|-------|------|-------------|---------|--------|
| `condition` | string | ✅ SIM | "NEW" ou "USED" | ✅ Implementado |
| `item_status` | string | ✅ SIM | "NORMAL" ou "UNLIST" | ✅ Implementado |

---

## 2. CAMPOS CONDICIONALMENTE OBRIGATÓRIOS

### 2.1 Pre-order
| Campo | Tipo | Obrigatório | Limites | Status |
|-------|------|-------------|---------|--------|
| `pre_order.is_pre_order` | bool | ❌ Não | true/false | ✅ Implementado |
| `pre_order.days_to_ship` | int | Se pre_order=true | 7-30 dias | ✅ Implementado |
| `days_to_ship` | int | Se pre_order=false | 1-3 dias | ✅ Implementado |

### 2.2 Variações (Tier Variations)
| Campo | Tipo | Obrigatório | Limites | Status |
|-------|------|-------------|---------|--------|
| `tier_variation` | array[object] | Se tem variações | Máx 2 tiers | ✅ Implementado |
| `tier_variation[].name` | string | ✅ SIM | Nome do tier (ex: "Cor") | ✅ Implementado |
| `tier_variation[].option_list` | array[object] | ✅ SIM | Máx 50 opções | ✅ Implementado |
| `tier_variation[].option_list[].option` | string | ✅ SIM | Nome da opção | ✅ Implementado |
| `tier_variation[].option_list[].image.image_url` | string | ❌ Não | URL da imagem | ✅ Implementado |

### 2.3 Modelos (Se tem variações)
| Campo | Tipo | Obrigatório | Limites | Status |
|-------|------|-------------|---------|--------|
| `model` | array[object] | Se tem variações | Máx 50 modelos | ✅ Implementado |
| `model[].model_sku` | string | ❌ Não | Máx 50 caracteres | ✅ Implementado |
| `model[].tier_index` | array[int] | ✅ SIM | Índices das opções | ✅ Implementado |
| `model[].original_price` | float | ✅ SIM | Preço do modelo | ✅ Implementado |
| `model[].stock_info_v2` | object | ✅ SIM | Informações de estoque | ✅ Implementado |

### 2.4 Estoque (stock_info_v2) - ESTRUTURA CRÍTICA
```json
{
  "stock_info_v2": {
    "seller_stock": [
      {
        "stock": 100
      }
    ]
  }
}
```

**ATENÇÃO:** O campo `seller_stock` DEVE ser um array de objetos, não um número simples!

| Campo | Tipo | Obrigatório | Descrição | Status |
|-------|------|-------------|-----------|--------|
| `stock_info_v2.seller_stock` | array[object] | ✅ SIM | Array de estoques | ✅ Implementado |
| `stock_info_v2.seller_stock[].stock` | int | ✅ SIM | Quantidade | ✅ Implementado |
| `stock_info_v2.seller_stock[].location_id` | string | ❌ Não | ID do armazém | ⚠️ Não implementado |

### 2.5 Atributos de Categoria
| Campo | Tipo | Obrigatório | Limites | Status |
|-------|------|-------------|---------|--------|
| `attribute_list` | array[object] | Depende da categoria | Atributos obrigatórios | ✅ Implementado |
| `attribute_list[].attribute_id` | int | ✅ SIM | ID do atributo | ✅ Implementado |
| `attribute_list[].attribute_value_list` | array[object] | ✅ SIM | Valores | ✅ Implementado |

### 2.6 Marca (Brand)
| Campo | Tipo | Obrigatório | Limites | Status |
|-------|------|-------------|---------|--------|
| `brand.brand_id` | int | Depende da categoria | ID da marca | ✅ Implementado |

---

## 3. CAMPOS OPCIONAIS

### 3.1 Vídeo
| Campo | Tipo | Obrigatório | Limites | Status |
|-------|------|-------------|---------|--------|
| `video.video_url` | string | ❌ Não | URL do vídeo | ✅ Implementado |

**Requisitos de Vídeo:**
- **Formato:** MP4
- **Tamanho Máximo:** 30MB
- **Duração:** 10-60 segundos
- **Resolução Máxima:** 1280x1280 pixels

### 3.2 Size Chart (Tabela de Medidas)
| Campo | Tipo | Obrigatório | Limites | Status |
|-------|------|-------------|---------|--------|
| `size_chart` | int | ❌ Não | ID do size chart | ✅ Implementado |

### 3.3 Atacado (Wholesale)
| Campo | Tipo | Obrigatório | Limites | Status |
|-------|------|-------------|---------|--------|
| `wholesale` | array[object] | ❌ Não | Tiers de preço | ✅ Implementado |
| `wholesale[].min_count` | int | ✅ SIM | Quantidade mínima | ✅ Implementado |
| `wholesale[].max_count` | int | ✅ SIM | Quantidade máxima | ✅ Implementado |
| `wholesale[].unit_price` | float | ✅ SIM | Preço unitário | ✅ Implementado |

### 3.4 Descrição Estendida (Whitelisted)
| Campo | Tipo | Obrigatório | Limites | Status |
|-------|------|-------------|---------|--------|
| `description_type` | string | ❌ Não | "extended" | ✅ Implementado |
| `extended_description.field_list` | array[object] | ✅ SIM | Campos | ✅ Implementado |
| `extended_description.field_list[].field_type` | string | ✅ SIM | "text" ou "image" | ✅ Implementado |

---

## 4. VALIDAÇÕES IMPLEMENTADAS

### 4.1 Validação de Nome
- [x] Mínimo 20 caracteres
- [x] Máximo 120 caracteres
- [x] Sem caracteres < ou >
- [x] Formatação automática se muito curto

### 4.2 Validação de Descrição
- [x] Mínimo 100 caracteres
- [x] Máximo 3000 caracteres
- [x] Formatação automática se muito curta
- [x] Aviso sobre HTML e links

### 4.3 Validação de Preço
- [x] Mínimo R$ 0.01
- [x] Máximo R$ 999.999.999
- [x] Aviso sobre preços muito baixos

### 4.4 Validação de Estoque
- [x] Mínimo 0
- [x] Máximo 999.999
- [x] Deve ser número inteiro
- [x] Aviso sobre estoque baixo

### 4.5 Validação de Peso
- [x] Mínimo 0.001 kg
- [x] Máximo 300 kg

### 4.6 Validação de Dimensões
- [x] Mínimo 0.1 cm
- [x] Máximo 300 cm

### 4.7 Validação de Imagens
- [x] Mínimo 1 imagem
- [x] Máximo 9 imagens
- [x] URLs válidas (http/https)
- [x] Compressão automática para < 2MB
- [x] Validação de proporção 1:1 (com tolerância de 5%)
- [x] Validação de resolução mínima 500x500
- [x] Função para tornar imagem quadrada (padding branco)
- [x] Processamento completo para requisitos Shopee

### 4.8 Validação de Variações
- [x] Máximo 2 tiers
- [x] Máximo 50 opções por tier
- [x] Máximo 50 modelos totais
- [x] Sem opções duplicadas

### 4.9 Validação de SKU
- [x] Máximo 100 caracteres (item)
- [x] Máximo 50 caracteres (model)
- [x] Aviso sobre caracteres especiais

---

## 5. ITENS PENDENTES DE IMPLEMENTAÇÃO

### 5.1 Alta Prioridade (Podem causar erro na API)

| Item | Descrição | Impacto | Status |
|------|-----------|---------|--------|
| ✅ Validação de proporção de imagem | Verificar se imagem é 1:1 | Pode ser rejeitada | IMPLEMENTADO |
| ✅ Validação de resolução mínima | Verificar se >= 500x500 | Pode ser rejeitada | IMPLEMENTADO |
| ⚠️ location_id no estoque | Para vendedores com múltiplos armazéns | Pode falhar | PENDENTE (raro) |

### 5.2 Média Prioridade (Funcionalidades importantes)

| Item | Descrição | Impacto | Status |
|------|-----------|---------|--------|
| ✅ Interface para atributos obrigatórios | UI para preencher atributos da categoria | UX | IMPLEMENTADO |
| ✅ Seletor de marca | UI para selecionar marca quando obrigatório | UX | IMPLEMENTADO |
| ✅ Configuração de frete | shipping_fee e is_free na logística | Funcionalidade | IMPLEMENTADO |
| ✅ Editor de descrição estendida | Interface para criar descrição com imagens | Funcionalidade | IMPLEMENTADO |

### 5.3 Baixa Prioridade (Nice to have)

| Item | Descrição | Impacto | Status |
|------|-----------|---------|--------|
| ✅ Configuração de atacado via UI | Interface para configurar tiers de preço | UX | IMPLEMENTADO |
| ✅ Seletor de size chart | Interface para selecionar tabela de medidas | UX | IMPLEMENTADO |
| ✅ Preview de anúncio | Visualização antes de publicar | UX | IMPLEMENTADO |
| ✅ Duplicar anúncio | Criar cópia de anúncio existente | Produtividade | IMPLEMENTADO |

### 5.4 Melhorias UX/UI (Implementadas em Fev/2026)

| Item | Descrição | Impacto | Status |
|------|-----------|---------|--------|
| ✅ FieldHint (tooltips) | Tooltip de ajuda em todos os campos | UX | IMPLEMENTADO |
| ✅ Informações fiscais | NCM, GTIN, item_name_in_invoice automáticos | Obrigatório | IMPLEMENTADO |
| ✅ Busca de categoria | Filtro de texto na seleção de categorias | UX | IMPLEMENTADO |
| ✅ Validação inline | Borda vermelha, mensagens, progresso | UX | IMPLEMENTADO |
| ✅ Nome auto-gerado | Nome do anúncio gerado automaticamente | UX | IMPLEMENTADO |
| ✅ Descrição auto-gerada | Descrição com dados do tecido | UX | IMPLEMENTADO |
| ✅ Checklist de publicação | Checklist visual no preview | UX | IMPLEMENTADO |
| ✅ Selecionar todas as cores | Botão para marcar/desmarcar todas | UX | IMPLEMENTADO |
| ✅ ESC fecha modais | Tecla ESC fecha preview | UX | IMPLEMENTADO |
| ✅ Skeleton loading | Loading animado nos cards | UX | IMPLEMENTADO |
| ✅ Barra de progresso por etapa | Progresso visual no wizard | UX | IMPLEMENTADO |

---

## 6. ESTRUTURA COMPLETA DO PAYLOAD

```json
{
  "item_name": "Nome do Produto (20-120 caracteres)",
  "description": "Descrição do produto (100-3000 caracteres)",
  "item_sku": "SKU-001",
  "original_price": 99.90,
  "category_id": 123456,
  "weight": 0.5,
  "dimension": {
    "package_length": 30,
    "package_width": 20,
    "package_height": 5
  },
  "image": {
    "image_url_list": [
      "https://exemplo.com/imagem1.jpg",
      "https://exemplo.com/imagem2.jpg"
    ]
  },
  "tier_variation": [
    {
      "name": "Cor",
      "option_list": [
        {
          "option": "Azul",
          "image": {
            "image_url": "https://exemplo.com/azul.jpg"
          }
        },
        {
          "option": "Vermelho",
          "image": {
            "image_url": "https://exemplo.com/vermelho.jpg"
          }
        }
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
      "model_sku": "SKU-001-AZUL-P",
      "tier_index": [0, 0],
      "original_price": 99.90,
      "stock_info_v2": {
        "seller_stock": [
          { "stock": 50 }
        ]
      }
    },
    {
      "model_sku": "SKU-001-AZUL-M",
      "tier_index": [0, 1],
      "original_price": 99.90,
      "stock_info_v2": {
        "seller_stock": [
          { "stock": 50 }
        ]
      }
    }
  ],
  "logistic_info": [
    {
      "logistic_id": 80014,
      "enabled": true
    }
  ],
  "condition": "NEW",
  "item_status": "NORMAL",
  "pre_order": {
    "is_pre_order": false
  },
  "days_to_ship": 2,
  "attribute_list": [
    {
      "attribute_id": 100001,
      "attribute_value_list": [
        {
          "value_id": 200001
        }
      ]
    }
  ],
  "brand": {
    "brand_id": 300001
  },
  "video": {
    "video_url": "https://exemplo.com/video.mp4"
  },
  "size_chart": 400001,
  "wholesale": [
    {
      "min_count": 10,
      "max_count": 50,
      "unit_price": 89.90
    },
    {
      "min_count": 51,
      "max_count": 100,
      "unit_price": 79.90
    }
  ]
}
```

---

## 7. ERROS COMUNS E SOLUÇÕES

### 7.1 product.error_param
**Causa:** Campo obrigatório faltando ou formato incorreto
**Solução:** Verificar se todos os campos obrigatórios estão presentes e no formato correto

### 7.2 seller_stock format error
**Causa:** `seller_stock` enviado como número em vez de array
**Solução:** Usar estrutura `{ "seller_stock": [{ "stock": 100 }] }`

### 7.3 image validation error
**Causa:** Imagem fora dos requisitos (tamanho, proporção, formato)
**Solução:** Usar imagens 1024x1024, JPG/PNG, < 2MB

### 7.4 logistic_info empty
**Causa:** Nenhum canal de logística configurado
**Solução:** Buscar canais habilitados e incluir pelo menos um

### 7.5 category attribute missing
**Causa:** Atributo obrigatório da categoria não preenchido
**Solução:** Buscar atributos obrigatórios e incluir no payload

---

## 8. CHECKLIST DE IMPLEMENTAÇÃO

### Backend
- [x] Serviço de criação de produtos
- [x] Serviço de logística
- [x] Serviço de categorias
- [x] Serviço de atributos
- [x] Serviço de marcas
- [x] Serviço de limites de item
- [x] Validação de dados
- [x] Formatação automática
- [x] Compressão de imagens
- [x] Sincronização bidirecional
- [x] Validação de proporção de imagem
- [x] Validação de resolução de imagem
- [x] Validação de atacado (wholesale)
- [x] Validação de pre-order
- [x] Validação de vídeo
- [x] Validação de atributos obrigatórios
- [x] Validação de logística
- [ ] Suporte a múltiplos armazéns (location_id)

### Frontend
- [x] Página de criação de anúncio
- [x] Seletor de tecido
- [x] Seletor de cores
- [x] Seletor de tamanhos
- [x] Seletor de categoria
- [x] Campos de preço e estoque
- [x] Campos de peso e dimensões
- [x] Upload de imagens
- [x] Auto-save com debounce
- [x] Templates de anúncio
- [x] Interface para atributos obrigatórios (CategoryAttributes)
- [x] Seletor de marca (BrandSelector)
- [x] Editor de descrição estendida (ExtendedDescriptionEditor)
- [x] Configuração de atacado (WholesaleConfig)
- [x] Preview de anúncio (AdPreview)
- [x] Configuração de frete (ShippingConfig)
- [x] Seletor de size chart (SizeChartSelector)
- [x] Duplicação de anúncio
- [x] Informações fiscais (FiscalInfo — NCM, GTIN, item_name_in_invoice)
- [x] FieldHint (tooltips em todos os campos)
- [x] Busca de categoria com filtro
- [x] Validação inline (borda vermelha, erros, progresso)
- [x] Nome e descrição auto-gerados
- [x] Checklist de publicação no preview
- [x] Selecionar todas as cores
- [x] ESC fecha modais
- [x] Skeleton loading

---

## 9. NOVAS VALIDAÇÕES IMPLEMENTADAS

### 9.1 Validação de Imagens (image-compressor.service.ts)
```typescript
// Requisitos de imagem da Shopee
export const SHOPEE_IMAGE_REQUIREMENTS = {
  MIN_WIDTH: 500,
  MIN_HEIGHT: 500,
  RECOMMENDED_WIDTH: 1024,
  RECOMMENDED_HEIGHT: 1024,
  MAX_SIZE_BYTES: 2 * 1024 * 1024, // 2MB
  ASPECT_RATIO: 1, // 1:1 (quadrado)
  ASPECT_RATIO_TOLERANCE: 0.05, // 5% de tolerância
  ALLOWED_FORMATS: ['jpeg', 'jpg', 'png'],
};

// Funções disponíveis:
- validateImageForShopee(buffer) - Valida imagem completa
- validateImageUrlForShopee(url) - Valida imagem a partir de URL
- makeImageSquare(buffer) - Converte para 1:1 com padding branco
- processImageForShopee(buffer, options) - Processamento completo
```

### 9.2 Validações Adicionais (shopee-validation.ts)
```typescript
// Novas funções de validação:
- validateWholesale() - Valida configuração de atacado
- validatePreOrder() - Valida pre-order e days_to_ship
- validateVideoUrl() - Valida URL de vídeo
- validateAttributes() - Valida atributos obrigatórios
- validateLogistics() - Valida canais de logística
- validateProductComplete() - Validação completa estendida
```

---

## 10. CONCLUSÃO

O módulo está **100% completo** para funcionar corretamente com a API da Shopee. 

### ✅ Implementado:
1. Validação de proporção de imagem (1:1)
2. Validação de resolução mínima (500x500)
3. Conversão automática para quadrado
4. Validação de atacado
5. Validação de pre-order
6. Validação de vídeo
7. Validação de atributos obrigatórios
8. Validação de logística
9. Interface para atributos obrigatórios (CategoryAttributes)
10. Seletor de marca (BrandSelector)
11. Editor de descrição estendida (ExtendedDescriptionEditor)
12. Preview de anúncio (AdPreview + Simulação Shopee)
13. Informações fiscais (TaxInfo — NCM, GTIN, item_name_in_invoice)
14. UX completa: tooltips, validação inline, busca de categorias, skeleton loading, nome/descrição auto-gerados, checklist de publicação, barra de progresso

### ⚠️ Pendente (Melhorias futuras — não impedem funcionamento):
1. Suporte a múltiplos armazéns (location_id) — cenário raro
2. Paginação na listagem de anúncios (para grandes volumes)
