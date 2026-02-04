# Módulo de Gestão de Preços - Shopee

Sistema de gestão autônoma de preços e margens para produtos na Shopee.

## Visão Geral

O módulo de Preços permite:
- Cadastrar custos por SKU
- Calcular margens reais considerando taxas da Shopee
- Visualizar dashboard de performance financeira
- Configurar regras de automação de preços

## Taxas Shopee Brasil (Atualizado 02/2026)

| Taxa | Valor | Observação |
|------|-------|------------|
| Comissão (com Frete Grátis) | 20% (14% + 6%) | Padrão |
| Comissão (sem Frete Grátis) | 14% | Raro |
| Taxa por item vendido | R$ 4,00 | Fixo |
| Limite de comissão | R$ 100,00 | Por item |

## Estrutura de Dados

### Collection: `shopee_sku_costs`

Armazena custos e configurações de margem por SKU.

```typescript
interface SkuCost {
  id: string;              // shop_id + item_sku
  item_sku: string;        // SKU do produto
  shop_id: number;         // ID da loja Shopee
  custo_unitario: number;  // Custo do produto (R$)
  margem_minima: number;   // % mínima aceitável
  margem_target: number;   // % ideal desejada
  usa_frete_gratis: boolean; // Participa do programa (padrão: true)
  preco_minimo?: number;   // Piso de preço (R$)
  preco_maximo?: number;   // Teto de preço (R$)
  automacao_ativa: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### Collection: `shopee_pricing_rules`

Regras de automação configuráveis.

```typescript
interface PricingRule {
  id: string;
  shop_id: number;
  nome: string;
  ativa: boolean;
  condicoes: {
    demanda?: 'alta' | 'baixa' | 'qualquer';
    conversao?: 'alta' | 'baixa' | 'qualquer';
    margem_abaixo_minima?: boolean;
  };
  acao: {
    tipo: 'aumentar' | 'diminuir' | 'manter';
    percentual?: number;
    limite?: 'margem_minima' | 'margem_target' | 'preco_minimo' | 'preco_maximo';
  };
  prioridade: number;
}
```

## API Endpoints

### Payment API (Dados Financeiros)

#### GET /api/shopee/payment/income-overview
Visão geral de receita em um período.

**Query params:**
- `shop_id` (obrigatório)
- `release_time_from` (timestamp Unix)
- `release_time_to` (timestamp Unix)

#### POST /api/shopee/payment/collect-financial-data
Coleta dados financeiros agregados por SKU.

**Body:**
```json
{
  "shop_id": 123456,
  "days_back": 30
}
```

**Resposta:**
```json
{
  "success": true,
  "data": {
    "overview": {
      "total_released_amount": 15000.00,
      "total_released_order_count": 150
    },
    "sku_summary": [
      {
        "item_sku": "SKU001",
        "total_quantity": 50,
        "total_revenue_gross": 5000.00,
        "total_revenue_net": 3800.00,
        "avg_price_net": 76.00,
        "avg_fee_rate": 24.0
      }
    ]
  }
}
```

### Orders API (Histórico de Vendas)

#### POST /api/shopee/orders/collect-sales-data
Coleta dados de vendas agregados por SKU.

**Body:**
```json
{
  "shop_id": 123456,
  "days_back": 30
}
```

### Product API (Atualização de Preços)

#### POST /api/shopee/product/update-price
Atualiza preço de um item.

**Body:**
```json
{
  "shop_id": 123456,
  "item_id": 789,
  "price_list": [
    { "model_id": 111, "original_price": 99.90 }
  ]
}
```

#### POST /api/shopee/product/update-price-batch
Atualiza preços de múltiplos itens.

**Body:**
```json
{
  "shop_id": 123456,
  "updates": [
    {
      "item_id": 789,
      "price_list": [
        { "model_id": 111, "original_price": 99.90 }
      ]
    }
  ]
}
```

## Fórmulas de Cálculo

### Taxas Shopee
```
Comissão = min(Preço × 20%, R$ 100)
Taxa Item = R$ 4
Total Taxas = Comissão + Taxa Item
```

### Receita Líquida
```
Receita Líquida = Preço - Total Taxas
```

### Margem Real
```
Lucro = Receita Líquida - Custo
Margem (%) = (Lucro / Preço) × 100
```

### Preço Sugerido (para margem desejada)
```
Preço = (Custo + R$ 4) / (1 - 0.20 - Margem/100)
```

## Componentes Frontend

### ShopeePrecos
Página principal do módulo com abas:
- **Custos**: Lista e cadastro de custos por SKU
- **Dashboard**: Visualização de margens e lucros
- **Regras**: Configuração de automação

### SkuCostForm
Formulário para cadastrar/editar custos de um SKU.

### SkuCostList
Lista de SKUs com custos cadastrados e status de margem.

### SkuCostImport
Importação em massa via CSV/TXT.

### MarginDashboard
Dashboard com métricas de performance:
- Lucro total
- Receita líquida
- Margem média
- Status por SKU

### PricingRulesConfig
Configuração de regras de automação.

## Hooks

### useSkuCosts
Gerencia custos de SKUs (CRUD).

```typescript
const {
  costs,
  loading,
  error,
  loadCosts,
  saveCost,
  updateCost,
  removeCost,
  importCosts,
  calcularPreco,
} = useSkuCosts();
```

### useShopeeAnalytics
Carrega dados financeiros e de vendas.

```typescript
const {
  financialData,
  salesData,
  loading,
  loadAllData,
} = useShopeeAnalytics();
```

## Fluxo de Uso

1. **Cadastrar Custos**: Inserir custo unitário de cada SKU
2. **Definir Margens**: Configurar margem mínima e target
3. **Visualizar Dashboard**: Analisar performance atual
4. **Configurar Regras**: (Opcional) Criar regras de automação
5. **Monitorar**: Acompanhar margens e ajustar preços

## Status de Margem

| Status | Condição | Cor |
|--------|----------|-----|
| Ótimo | margem ≥ target | Verde |
| OK | margem ≥ mínima | Azul |
| Atenção | 0 < margem < mínima | Amarelo |
| Crítico | margem ≤ 0 | Vermelho |

## Índices Firestore Necessários

```json
{
  "collectionGroup": "shopee_sku_costs",
  "fields": [
    { "fieldPath": "shop_id", "order": "ASCENDING" },
    { "fieldPath": "item_sku", "order": "ASCENDING" }
  ]
}
```

## Próximos Passos

- [ ] Implementar execução automática de regras
- [ ] Adicionar gráficos de tendência
- [ ] Integrar com campanhas/promoções
- [ ] Alertas de margem crítica
