import { Timestamp } from 'firebase/firestore';

/**
 * Status do produto/rascunho
 */
export type ShopeeProductStatus = 'draft' | 'publishing' | 'created' | 'error' | 'syncing';

/**
 * Condição do produto
 */
export type ProductCondition = 'NEW' | 'USED';

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
 * Status de sincronização
 */
export type SyncStatus = 'synced' | 'out_of_sync' | 'error';

/**
 * Opção de variação (cor ou tamanho)
 */
export interface TierOption {
  option_name: string;
  imagem_url?: string;
}

/**
 * Tier de variação (Cor ou Tamanho)
 */
export interface TierVariation {
  tier_name: string;
  tier_index: number;
  options: TierOption[];
}

/**
 * Informações fiscais por modelo (variação)
 */
export interface TaxInfo {
  ncm: string;
  gtin: string;
  item_name_in_invoice?: string;
}

/**
 * Modelo (combinação de variações)
 */
export interface ProductModel {
  model_sku: string;
  tier_index: number[];
  cor_id?: string;
  cor_nome?: string;
  tamanho_id?: string;
  tamanho_nome?: string;
  vinculo_id?: string;
  model_id?: number;
  preco?: number;
  estoque: number;
  imagem_url?: string;
  tax_info?: TaxInfo;
}

/**
 * Produto Shopee (rascunho ou publicado)
 */
export interface ShopeeProduct {
  id: string;
  shop_id: number;
  item_id?: number;
  tecido_id: string;
  tecido_nome: string;
  tecido_sku: string;
  imagens_principais: string[];
  video_url?: string;
  tier_variations: TierVariation[];
  modelos: ProductModel[];
  preco_base: number;
  estoque_padrao: number;
  categoria_id: number;
  categoria_nome?: string;
  atributos?: ProductAttributeValue[];
  brand_id?: number;
  brand_nome?: string;
  peso: number;
  dimensoes: {
    comprimento: number;
    largura: number;
    altura: number;
  };
  descricao: string;
  descricao_customizada?: string;
  usar_imagens_publicas: boolean;
  condition: ProductCondition;
  is_pre_order: boolean;
  days_to_ship: number;
  size_chart_id?: number;
  description_type?: 'normal' | 'extended';
  extended_description?: ExtendedDescription;
  wholesale?: WholesaleTier[];
  ncm_padrao?: string;
  status: ShopeeProductStatus;
  error_message?: string;
  created_at: Timestamp;
  updated_at: Timestamp;
  published_at?: Timestamp;
  created_by: string;
  last_synced_at?: Timestamp;
  sync_status?: SyncStatus;
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
  tamanhos?: string[];
  precos_por_tamanho?: Record<string, number>;
  preco_base: number;
  estoque_padrao: number;
  categoria_id: number;
  peso: number;
  dimensoes: {
    comprimento: number;
    largura: number;
    altura: number;
  };
  descricao_customizada?: string;
  usar_imagens_publicas?: boolean;
  imagens_principais?: string[];
  template_id?: string;
  video_url?: string;
  atributos?: ProductAttributeValue[];
  brand_id?: number;
  condition?: ProductCondition;
  is_pre_order?: boolean;
  days_to_ship?: number;
  size_chart_id?: number;
  description_type?: 'normal' | 'extended';
  extended_description?: ExtendedDescription;
  wholesale?: WholesaleTier[];
  ncm_padrao?: string;
}

/**
 * Categoria Shopee
 */
export interface ShopeeCategory {
  id: number;
  parent_category_id?: number;
  original_category_name: string;
  display_name: string;
  has_children: boolean;
  level: number;
}

/**
 * Preferências do usuário
 */
export interface ShopeeUserPreferences {
  id: string;
  preco_base_padrao?: number;
  estoque_padrao_padrao?: number;
  categoria_id_padrao?: number;
  categoria_nome_padrao?: string;
  peso_padrao?: number;
  dimensoes_padrao?: {
    comprimento: number;
    largura?: number;
    altura: number;
  };
  usar_imagens_publicas_padrao?: boolean;
  descricao_template?: string;
  ncm_padrao?: string;
  ultimos_valores?: {
    preco_base?: number;
    estoque_padrao?: number;
    categoria_id?: number;
    peso?: number;
    dimensoes?: {
      comprimento: number;
      largura: number;
      altura: number;
    };
  };
}

/**
 * Template de anúncio
 */
export interface ShopeeProductTemplate {
  id: string;
  nome: string;
  descricao?: string;
  categoria_id?: number;
  categoria_nome?: string;
  preco_base?: number;
  estoque_padrao?: number;
  peso?: number;
  dimensoes?: {
    comprimento: number;
    largura?: number;
    altura: number;
  };
  descricao_template?: string;
  usar_imagens_publicas?: boolean;
  incluir_tamanhos?: boolean;
  tamanhos_padrao?: string[];
  uso_count: number;
}

/**
 * Valores padrão para formulário
 */
export interface DefaultFormValues {
  preco_base?: number;
  estoque_padrao?: number;
  categoria_id?: number;
  categoria_nome?: string;
  peso: number;
  dimensoes: {
    comprimento: number;
    largura: number;
    altura: number;
  };
  usar_imagens_publicas: boolean;
  descricao_template?: string;
  ncm_padrao?: string;
}

/**
 * Atributo de categoria Shopee
 */
export interface ShopeeCategoryAttribute {
  attribute_id: number;
  original_attribute_name: string;
  display_attribute_name: string;
  is_mandatory: boolean;
  input_validation_type: string;
  format_type: string;
  date_format_type?: string;
  input_type: string;
  attribute_unit?: string[];
  attribute_value_list?: Array<{
    value_id: number;
    original_value_name: string;
    display_value_name: string;
    value_unit?: string;
  }>;
}

/**
 * Marca Shopee
 */
export interface ShopeeBrand {
  brand_id: number;
  original_brand_name: string;
  display_brand_name: string;
}

/**
 * Canal de logística Shopee
 */
export interface LogisticsChannel {
  logistics_channel_id: number;
  logistics_channel_name: string;
  cod_enabled: boolean;
  enabled: boolean;
  fee_type: string;
  size_list?: Array<{
    size_id: string;
    name: string;
    default_price: number;
  }>;
  weight_limit?: {
    item_max_weight: number;
    item_min_weight: number;
  };
  item_max_dimension?: {
    height: number;
    width: number;
    length: number;
    unit: string;
  };
  logistics_description?: string;
}

/**
 * Campo de descrição estendida
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
 * Tier de atacado
 */
export interface WholesaleTier {
  min_count: number;
  max_count: number;
  unit_price: number;
}

/**
 * Limites de item da Shopee
 */
export interface ItemLimit {
  price_limit: { min_limit: number; max_limit: number };
  stock_limit: { min_limit: number; max_limit: number };
  item_name_length_limit: { min_limit: number; max_limit: number };
  item_description_length_limit: { min_limit: number; max_limit: number };
  item_image_count_limit: { min_limit: number; max_limit: number };
  size_chart_supported: boolean;
  dts_limit?: {
    non_pre_order_dts_limit: number;
    pre_order_dts_limit: { min_limit: number; max_limit: number };
  };
}
