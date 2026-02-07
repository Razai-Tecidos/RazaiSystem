# Módulo de Criação de Anúncios Shopee

Documentação completa do módulo de criação de anúncios para a Shopee no RazaiSystem.

## Visão Geral

O módulo permite criar anúncios de tecidos na Shopee utilizando dados já cadastrados no sistema (tecidos, cores, vínculos cor-tecido) e complementando com informações específicas para a plataforma.

## Funcionalidades Implementadas

### 1. Criação de Anúncios (CRUD Completo)

- **Criar Rascunho**: Salva anúncio localmente antes de publicar
- **Editar Rascunho**: Modifica dados antes da publicação
- **Publicar**: Envia para a Shopee via API `v2.product.add_item`
- **Excluir Rascunho**: Remove rascunhos não publicados
- **Auto-save**: Salva automaticamente após 5 segundos de inatividade

### 2. Variações (Tier Variations)

- **Tier 1 - Cor**: Sempre presente, baseado nos vínculos cor-tecido
- **Tier 2 - Tamanho**: Opcional, configurável pelo usuário
- **Limite**: Máximo 2 tiers, 50 opções cada, 50 combinações totais
- **Imagens de Variação**: Cada cor pode ter sua própria imagem

### 3. Categorias Shopee

- **Cache Inteligente**: Categorias são cacheadas por 24 horas
- **Navegação Hierárquica**: Seletor em árvore (categoria > subcategoria)
- **Atributos Obrigatórios**: Busca atributos obrigatórios por categoria
- **Marcas**: Busca marcas disponíveis por categoria

### 4. Logística

- **Busca Automática**: Canais de logística habilitados são buscados automaticamente
- **Validação**: Verifica compatibilidade de peso/dimensões com canais disponíveis
- **Cache**: Canais são cacheados por 7 dias

### 5. Imagens

- **Compressão Inteligente**: 
  - Target: 1.99MB
  - Mantém formato original (PNG/JPEG)
  - Prioriza qualidade sobre redimensionamento
- **Upload**: Suporta URLs públicas ou upload direto para Shopee Media Space
- **Limite**: 1-9 imagens principais, 1 imagem por variação de cor

### 6. Vídeo (Novo)

- **Suporte a Vídeo**: Campo para URL de vídeo do produto
- **Requisitos**: MP4, máx 30MB, 10-60s, resolução máx 1280x1280

### 7. Validação

- **Nome**: 20-120 caracteres
- **Descrição**: 100-3000 caracteres
- **Preço**: R$ 0.01 - R$ 999.999.999
- **Estoque**: 0 - 999.999
- **Peso**: 0.001 - 300 kg
- **Dimensões**: 0.1 - 300 cm
- **Formatação Automática**: Nome e descrição são formatados para atender requisitos mínimos

### 8. Configurações Adicionais

- **Condição**: NEW (novo) ou USED (usado)
- **Pre-order**: Suporte a produtos sob encomenda
- **Days to Ship**: 
  - Normal: 1-2 dias
  - Pre-order: 7-30 dias
- **Size Chart**: Suporte a tabela de medidas (quando disponível na categoria)

### 9. Descrição Estendida (Extended Description)

- **Disponibilidade**: Apenas para vendedores whitelisted pela Shopee
- **Funcionalidade**: Permite incluir imagens intercaladas com texto na descrição
- **Estrutura**: Lista de campos do tipo 'text' ou 'image'

### 10. Atacado (Wholesale)

- **Configuração de Tiers**: Define faixas de quantidade com preços diferenciados
- **Campos**: min_count, max_count, unit_price
- **Exemplo**: 10-50 unidades = R$ 8,00 | 51-100 unidades = R$ 7,00

### 11. Templates de Anúncio

- **Criar Template**: Salva configurações para reutilização
- **Aplicar Template**: Preenche formulário com valores do template
- **Campos Salvos**: Categoria, preço, estoque, peso, dimensões, descrição

### 12. Sincronização Bidirecional

- **Automática**: Executa a cada 6 horas via Cloud Function
- **Manual**: Botão para sincronizar produto específico ou todos
- **Detecção de Mudanças**: Compara dados locais com Shopee
- **Batch Processing**: Busca até 50 produtos por requisição

### 13. Preferências do Usuário

- **Valores Padrão**: Preço, estoque, peso, dimensões, NCM fiscal, categoria
- **Últimos Valores Usados**: Preenche com valores da última publicação
- **Template de Descrição**: Texto padrão para descrições
- **NCM Padrão**: Salvo automaticamente ao publicar, reutilizado em próximos anúncios
- **Categoria Padrão**: Nome da categoria salvo para referência

### 14. Informações Fiscais (tax_info)

- **NCM**: Campo editável, salvo como padrão para próximos anúncios (ex: 58013600 para tecidos)
- **GTIN**: Fixo em "00" (tecido sem código de barras)
- **item_name_in_invoice**: Gerado automaticamente: "Tecido [nome] [cor] [tamanho]"
- **Localização na API**: Dentro de cada `model` na `model_list` do `add_item`
- **Envio Automático**: Incluído no payload se NCM estiver preenchido

### 15. Melhorias UX/UI

- **FieldHint**: Tooltip de ajuda (ícone `?`) em todos os campos do formulário
- **FiscalInfo**: Seção visual de informações fiscais com campo NCM, GTIN fixo e preview do nome NF
- **Busca de Categoria**: Campo de busca para filtrar categorias
- **Validação Inline**: Borda vermelha em campos inválidos, lista de erros pendentes
- **Barra de Progresso**: Indicador de completude por etapa do wizard
- **Nome Auto-gerado**: "Tecido [nome] - [cores]" gerado automaticamente
- **Descrição Auto-gerada**: Baseada nos dados do tecido (largura, cores, tamanhos)
- **Checklist de Publicação**: 8 itens verificados visualmente no preview
- **Selecionar Todas as Cores**: Botão para marcar/desmarcar todas as cores
- **ESC Fecha Modais**: Tecla Escape fecha o modal de simulação Shopee
- **Skeleton Loading**: Animação de carregamento nos cards de tecido e categorias

## Endpoints da API

### Produtos/Rascunhos
```
GET    /api/shopee/products              - Lista produtos/rascunhos
GET    /api/shopee/products/:id          - Busca produto por ID
POST   /api/shopee/products              - Cria rascunho
PUT    /api/shopee/products/:id          - Atualiza rascunho
DELETE /api/shopee/products/:id          - Exclui rascunho
POST   /api/shopee/products/:id/publish  - Publica na Shopee
POST   /api/shopee/products/:id/sync     - Sincroniza produto
POST   /api/shopee/products/sync-all     - Sincroniza todos
```

### Categorias
```
GET    /api/shopee/categories                    - Lista categorias
GET    /api/shopee/categories/subcategories      - Lista subcategorias
GET    /api/shopee/categories/:id                - Busca categoria
GET    /api/shopee/categories/:id/path           - Caminho (breadcrumb)
GET    /api/shopee/categories/:id/attributes     - Atributos da categoria
GET    /api/shopee/categories/:id/brands         - Marcas da categoria
POST   /api/shopee/categories/refresh            - Atualiza cache
```

### Logística
```
GET    /api/shopee/logistics                - Lista canais
GET    /api/shopee/logistics/enabled        - Lista canais habilitados
POST   /api/shopee/logistics/validate       - Valida compatibilidade
POST   /api/shopee/logistics/refresh        - Atualiza cache
```

### Limites de Item
```
GET    /api/shopee/item-limit                    - Limites por categoria
GET    /api/shopee/item-limit/dts                - Limites de dias para envio
GET    /api/shopee/item-limit/size-chart-support - Suporte a size chart
GET    /api/shopee/item-limit/size-charts        - Lista size charts
```

### Templates
```
GET    /api/shopee/templates              - Lista templates
GET    /api/shopee/templates/:id          - Busca template
POST   /api/shopee/templates              - Cria template
PUT    /api/shopee/templates/:id          - Atualiza template
DELETE /api/shopee/templates/:id          - Exclui template
```

### Preferências
```
GET    /api/shopee/preferences            - Busca preferências
GET    /api/shopee/preferences/defaults   - Busca valores padrão combinados (pref + sistema)
PUT    /api/shopee/preferences            - Atualiza preferências
```

### Webhook Shopee
```
POST   /api/shopee/webhook               - Recebe notificações push da Shopee
```

Eventos suportados: `order_status_push` (3), `reserved_stock_change_push` (8), `video_upload_push` (11), `violation_item_push` (16), `item_price_update_push` (22), `item_scheduled_publish_failed_push` (27).

### Tamanhos
```
GET    /api/tamanhos                      - Lista tamanhos
GET    /api/tamanhos/:id                  - Busca tamanho
POST   /api/tamanhos                      - Cria tamanho
PUT    /api/tamanhos/:id                  - Atualiza tamanho
DELETE /api/tamanhos/:id                  - Exclui tamanho
POST   /api/tamanhos/reorder              - Reordena tamanhos
```

## Estrutura de Dados

### ShopeeProduct (Firestore: `shopee_products`)
```typescript
{
  id: string;
  user_id: string;
  shop_id: number;
  item_id?: number;              // ID na Shopee (após publicação)
  tecido_id: string;
  tecido_nome: string;
  tecido_sku: string;
  imagens_principais: string[];
  video_url?: string;
  tier_variations: TierVariation[];
  modelos: ProductModel[];       // Cada modelo pode ter tax_info
  preco_base: number;
  estoque_padrao: number;
  categoria_id: number;
  categoria_nome?: string;
  atributos?: ProductAttributeValue[];
  brand_id?: number;
  brand_nome?: string;
  peso: number;
  dimensoes: { comprimento, largura, altura };
  descricao: string;
  descricao_customizada?: string;
  usar_imagens_publicas: boolean;
  condition: 'NEW' | 'USED';
  is_pre_order: boolean;
  days_to_ship: number;
  size_chart_id?: number;
  description_type?: 'normal' | 'extended';
  extended_description?: ExtendedDescription;
  wholesale?: WholesaleTier[];
  ncm_padrao?: string;          // NCM fiscal padrão (salvo como preferência)
  status: 'draft' | 'publishing' | 'created' | 'error' | 'syncing';
  created_at: Timestamp;
  updated_at: Timestamp;
  published_at?: Timestamp;
  last_synced_at?: Timestamp;
  sync_status?: 'synced' | 'out_of_sync' | 'error';
}
```

### TaxInfo (dentro de cada ProductModel)
```typescript
{
  ncm: string;                   // Código NCM (ex: "58013600")
  gtin: string;                  // Código de barras ("00" se não tiver)
  item_name_in_invoice?: string; // Auto-gerado: "Tecido [nome] [cor] [tamanho]"
}
```

## Fluxo de Publicação

1. **Validação**: Verifica todos os campos obrigatórios
2. **Formatação**: Ajusta nome e descrição para requisitos mínimos
3. **Logística**: Busca canais compatíveis com peso/dimensões
4. **Imagens**: Comprime se necessário (target 1.99MB)
5. **Upload**: Envia imagens para Shopee Media Space (se configurado)
6. **Publicação**: Chama `v2.product.add_item`
7. **Atualização**: Salva `item_id` retornado e atualiza status

## Integração com Módulo de Estoque

Produtos criados por este módulo aparecem automaticamente no módulo de controle de estoque existente, pois:

1. O `item_sku` do produto corresponde ao SKU do tecido
2. As variações (`tier_variation[0]`) correspondem às cores
3. O `model_sku` segue o padrão `{tecido_sku}-{cor_sku}[-{tamanho_sku}]`

## Requisitos da API Shopee

### Campos Obrigatórios
- `item_name` (20-120 caracteres)
- `description` (100-3000 caracteres)
- `category_id`
- `original_price`
- `weight`
- `dimension` (length, width, height)
- `image` (1-9 imagens)
- `logistic_info` (pelo menos 1 canal)
- `condition` (NEW ou USED)
- `item_status` (NORMAL)

### Campos Opcionais
- `item_sku`
- `tier_variation` (variações)
- `model` (modelos/combinações)
- `video`
- `brand`
- `attribute_list`
- `pre_order`
- `days_to_ship`
- `size_chart`
- `description_type` (normal ou extended)
- `extended_description` (para vendedores whitelisted)
- `wholesale` (configuração de atacado)

## Considerações

1. **Logística**: É obrigatório ter pelo menos um canal de logística habilitado na loja
2. **Categorias**: Algumas categorias exigem atributos obrigatórios (marca, material, etc.)
3. **Imagens**: Devem ser menores que 2MB e em formato JPG/PNG (compressão automática para 1.99MB)
4. **Variações**: Máximo 50 combinações (cores × tamanhos)
5. **Pre-order**: Quando ativado, days_to_ship deve ser entre 7-30 dias
6. **Informações Fiscais**: NCM é salvo como preferência; GTIN fixo em "00"; item_name_in_invoice auto-gerado
7. **Webhooks**: 6 eventos configurados para notificações em tempo real da Shopee
8. **UX**: Todos os campos possuem tooltips explicativos; validação inline; nome e descrição auto-gerados
