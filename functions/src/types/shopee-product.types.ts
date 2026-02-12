import { Timestamp } from 'firebase-admin/firestore';

/**
 * Status do produto/rascunho
 */
export type ShopeeProductStatus = 'draft' | 'publishing' | 'published' | 'created' | 'error' | 'syncing';

/**
 * Status de sincronização
 */
export type SyncStatus = 'synced' | 'out_of_sync' | 'error';

/**
 * Opção de variação (cor ou tamanho)
 */
export interface TierOption {
  option_name: string;
  imagem_url?: string;
  imagem_gerada?: boolean;
}

/**
 * Tier de variação (Cor ou Tamanho)
 */
export interface TierVariation {
  tier_name: string; // "Cor" ou "Tamanho"
  tier_index: number; // 0 = primeiro, 1 = segundo
  options: TierOption[];
}

/**
 * Informações fiscais por modelo (variação)
 */
export interface TaxInfo {
  ncm: string;                   // Código NCM (ex: "58013600" para tecidos)
  cest?: string;                 // Código CEST (BR). Use "00" quando não aplicável
  gtin: string;                  // Código de barras EAN ("00" se não tiver)
  item_name_in_invoice?: string; // Auto-gerado: "Tecido [nome] [cor] [tamanho]"
}

/**
 * Modelo (combinação de variações)
 */
export interface ProductModel {
  model_sku: string; // Ex: "T007-MA001-P"
  tier_index: number[]; // [cor_index, tamanho_index]
  cor_id?: string;
  cor_nome?: string;
  tamanho_id?: string;
  tamanho_nome?: string;
  vinculo_id?: string;
  model_id?: number; // ID do modelo na Shopee (null se rascunho)
  preco?: number; // Preço específico desta combinação
  estoque: number;
  imagem_url?: string;
  tax_info?: TaxInfo;
}

/**
 * Parâmetros de precificação Shopee no anúncio
 */
export interface PrecificacaoShopee {
  custo_metro: number;
  margem_liquida_percentual: number;
  modo_margem_lucro?: 'percentual' | 'valor_fixo';
  margem_lucro_fixa?: number;
  margem_por_tamanho?: Record<string, {
    modo: 'percentual' | 'valor_fixo';
    valor: number;
  }>;
  comissao_percentual: number;
  taxa_fixa_item: number;
  valor_minimo_baixo_valor: number;
  adicional_baixo_valor: number;
  teto_comissao: number;
  aplicar_teto: boolean;
  aplicar_baixo_valor: boolean;
}

/**
 * Configuracao de logistica por item enviada no add_item
 */
export interface ProductLogisticInfo {
  logistic_id: number;
  enabled: boolean;
  shipping_fee?: number;
  size_id?: string;
  is_free?: boolean;
}

/**
 * Snapshot dos dados na Shopee (para sincronização)
 */
export interface ShopeeDataSnapshot {
  item_status?: string;
  item_name?: string;
  modelos?: Array<{
    model_id: number;
    preco: number;
    estoque: number;
  }>;
}

/**
 * Condição do produto
 */
export type ProductCondition = 'NEW' | 'USED';
export type ShopeeImageRatio = '1:1' | '3:4';

/**
 * Produto Shopee (rascunho ou publicado)
 */
export interface ShopeeProduct {
  id: string;
  user_id: string;
  shop_id: number;
  item_id?: number; // ID retornado pela Shopee (null se rascunho)
  shopee_item_id?: number; // Alias para item_id
  tecido_id: string;
  tecido_nome: string;
  tecido_sku: string;
  
  // Imagens principais do produto (galeria)
  imagens_principais: string[];
  imagens_principais_1_1?: string[];
  imagens_principais_3_4?: string[];
  imagem_ratio_principal?: ShopeeImageRatio;
  
  // Vídeo do produto (opcional)
  video_url?: string;
  
  // Variações (tiers)
  tier_variations: TierVariation[];
  
  // Modelos (combinações)
  modelos: ProductModel[];
  
  // Configurações de preço e estoque
  preco_base: number;
  precificacao?: PrecificacaoShopee;
  precos_por_tamanho?: Record<string, number> | null; // Preço por comprimento (quando há segunda variação)
  estoque_padrao: number;
  
  // Categoria
  categoria_id: number;
  categoria_nome?: string;
  
  // Atributos da categoria (obrigatórios e opcionais)
  atributos?: ProductAttributeValue[];
  
  // Marca (brand)
  brand_id?: number;
  brand_nome?: string;

  // Logistica customizada selecionada no formulario
  logistic_info?: ProductLogisticInfo[];
  
  // Dimensões e peso
  peso: number; // kg
  dimensoes: {
    comprimento: number; // cm
    largura: number; // cm
    altura: number; // cm
  };
  
  // Descrição
  descricao: string;
  titulo_anuncio?: string;
  descricao_customizada?: string;
  
  // Configurações
  usar_imagens_publicas: boolean;
  
  // Condição e envio
  condition: ProductCondition; // NEW ou USED
  is_pre_order: boolean;
  days_to_ship: number; // 1 para normal, 7-30 para pre-order
  
  // Size Chart (tabela de medidas)
  size_chart_id?: number;
  
  // Descrição estendida (para vendedores whitelisted)
  description_type?: 'normal' | 'extended';
  extended_description?: ExtendedDescription;
  
  // Atacado (wholesale)
  wholesale?: WholesaleTier[];
  
  // Status
  status: ShopeeProductStatus;
  error_message?: string;
  
  // Timestamps
  created_at: Timestamp;
  updated_at: Timestamp;
  published_at?: Timestamp;
  created_by: string;
  
  // Sincronização
  last_synced_at?: Timestamp;
  sync_status?: SyncStatus;
  shopee_data_snapshot?: ShopeeDataSnapshot;
  
  // Informações fiscais
  ncm_padrao?: string;
  cest_padrao?: string;
  
  // Template usado
  template_id?: string;
  template_nome?: string;
}

/**
 * Dados para criar um produto/rascunho
 */
export interface CreateShopeeProductData {
  shop_id: number;
  tecido_id: string;
  cores: Array<{
    cor_id: string;
    estoque: number;
  }>;
  tamanhos?: string[]; // Comprimentos selecionados ("1", "2", "3")
  precos_por_tamanho?: Record<string, number>; // Preço por comprimento (id -> preço)
  preco_base: number; // Preço único quando não há comprimentos selecionados
  precificacao?: PrecificacaoShopee;
  estoque_padrao: number;
  categoria_id: number;
  peso: number;
  dimensoes: {
    comprimento: number;
    largura: number;
    altura: number;
  };
  descricao_customizada?: string;
  titulo_anuncio?: string;
  usar_imagens_publicas?: boolean;
  imagens_principais?: string[];
  imagens_principais_1_1?: string[];
  imagens_principais_3_4?: string[];
  imagem_ratio_principal?: ShopeeImageRatio;
  template_id?: string;
  
  // Campos adicionais
  video_url?: string;
  atributos?: ProductAttributeValue[];
  brand_id?: number;
  brand_nome?: string;
  logistic_info?: ProductLogisticInfo[];
  condition?: ProductCondition;
  is_pre_order?: boolean;
  days_to_ship?: number;
  size_chart_id?: number;
  
  // Descrição estendida (para vendedores whitelisted)
  description_type?: 'normal' | 'extended';
  extended_description?: ExtendedDescription;
  
  // Atacado
  wholesale?: WholesaleTier[];
  
  // Informações fiscais padrão (aplicado em cada model)
  ncm_padrao?: string;
  cest_padrao?: string;
}

/**
 * Dados para atualizar um produto/rascunho
 */
export interface UpdateShopeeProductData extends Partial<CreateShopeeProductData> {
  id: string;
}

/**
 * Resposta da API de criação de produto na Shopee
 */
export interface ShopeeAddItemResponse {
  error?: string;
  message?: string;
  response?: {
    item_id: number;
  };
}

/**
 * Resposta da API delete_item na Shopee
 */
export interface ShopeeDeleteItemResponse {
  error?: string;
  message?: string;
  request_id?: string;
  response?: Record<string, never>;
}

/**
 * Resposta da API init_tier_variation na Shopee
 */
export interface ShopeeInitTierResponse {
  error?: string;
  message?: string;
  warning?: string;
  request_id?: string;
  response?: {
    tier_variation?: Array<{
      name: string;
      option_list: Array<{
        option: string;
        image?: { image_url: string };
      }>;
    }>;
    model?: Array<{
      model_id: number;
      tier_index: number[];
      model_sku: string;
      price_info: Array<{ original_price: number }>;
      seller_stock: Array<{ location_id?: string; stock: number }>;
    }>;
  };
}

/**
 * Resposta da API de upload de imagem na Shopee
 */
export interface ShopeeUploadImageResponse {
  error?: string;
  message?: string;
  response?: {
    image_info: {
      image_id: string;
      image_url: string;
    };
  };
}

/**
 * Categoria Shopee (cache)
 */
export interface ShopeeCategory {
  id: number;
  parent_category_id?: number | null;
  original_category_name: string;
  display_name: string;
  has_children: boolean;
  level: number;
  updated_at: Timestamp;
}

/**
 * Cache de categorias
 */
export interface ShopeeCategoriesCache {
  categories: ShopeeCategory[];
  updated_at: Timestamp;
}

/**
 * Atributo de categoria Shopee
 */
export interface ShopeeCategoryAttribute {
  attribute_id: number;
  original_attribute_name: string;
  display_attribute_name: string;
  is_mandatory: boolean;
  input_validation_type: string; // 'STRING_TYPE', 'INT_TYPE', 'DATE_TYPE', etc.
  format_type: string; // 'NORMAL', 'QUANTITATIVE'
  date_format_type?: string;
  input_type: string; // 'DROP_DOWN', 'MULTIPLE_SELECT', 'TEXT_FILED', 'COMBO_BOX'
  attribute_unit?: string[];
  attribute_value_list?: Array<{
    value_id: number;
    original_value_name: string;
    display_value_name: string;
    value_unit?: string;
    parent_attribute_list?: Array<{
      parent_attribute_id: number;
      parent_value_id: number;
    }>;
  }>;
}

/**
 * Valor de atributo para criação de produto
 */
export interface ProductAttributeValue {
  attribute_id: number;
  attribute_value_list: Array<{
    value_id?: number;
    original_value_name?: string;
    value_unit?: string;
  }>;
}

/**
 * Brand (marca) do produto
 */
export interface ShopeeBrand {
  brand_id: number;
  original_brand_name: string;
  display_brand_name: string;
}

/**
 * Campo de descrição estendida (para vendedores whitelisted)
 */
export interface ExtendedDescriptionField {
  field_type: 'text' | 'image';
  text?: string;
  image_info?: {
    image_id: string;
    image_url: string;
  };
}

/**
 * Descrição estendida do produto
 */
export interface ExtendedDescription {
  field_list: ExtendedDescriptionField[];
}

/**
 * Informações de atacado (wholesale)
 */
export interface WholesaleTier {
  min_count: number;
  max_count: number;
  unit_price: number;
}
