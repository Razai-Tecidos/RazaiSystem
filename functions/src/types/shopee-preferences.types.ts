import { Timestamp } from 'firebase-admin/firestore';

/**
 * Preferencias do usuario para criacao de anuncios Shopee
 */
export interface ShopeeUserPreferences {
  id: string; // UID do usuario
  preco_base_padrao?: number;
  comissao_percentual_padrao?: number;
  taxa_fixa_item_padrao?: number;
  margem_liquida_percentual_padrao?: number;
  modo_margem_lucro_padrao?: 'percentual' | 'valor_fixo';
  margem_lucro_fixa_padrao?: number;
  valor_minimo_baixo_valor_padrao?: number;
  adicional_baixo_valor_padrao?: number;
  teto_comissao_padrao?: number;
  aplicar_teto_padrao?: boolean;
  aplicar_baixo_valor_padrao?: boolean;
  estoque_padrao_padrao?: number;
  categoria_id_padrao?: number;
  peso_padrao?: number;
  dimensoes_padrao?: {
    comprimento: number;
    largura?: number; // null = usar largura do tecido
    altura: number;
  };
  usar_imagens_publicas_padrao?: boolean;
  descricao_template?: string;
  ncm_padrao?: string;
  cest_padrao?: string;
  categoria_nome_padrao?: string;
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
  updated_at: Timestamp;
}

/**
 * Dados para atualizar preferencias
 */
export interface UpdateShopeePreferencesData {
  preco_base_padrao?: number;
  comissao_percentual_padrao?: number;
  taxa_fixa_item_padrao?: number;
  margem_liquida_percentual_padrao?: number;
  modo_margem_lucro_padrao?: 'percentual' | 'valor_fixo';
  margem_lucro_fixa_padrao?: number;
  valor_minimo_baixo_valor_padrao?: number;
  adicional_baixo_valor_padrao?: number;
  teto_comissao_padrao?: number;
  aplicar_teto_padrao?: boolean;
  aplicar_baixo_valor_padrao?: boolean;
  estoque_padrao_padrao?: number;
  categoria_id_padrao?: number;
  peso_padrao?: number;
  dimensoes_padrao?: {
    comprimento: number;
    largura?: number;
    altura: number;
  };
  usar_imagens_publicas_padrao?: boolean;
  descricao_template?: string;
  ncm_padrao?: string;
  cest_padrao?: string;
  categoria_nome_padrao?: string;
}

/**
 * Valores padrao do sistema
 */
export const SYSTEM_DEFAULTS = {
  peso: 0.3, // kg
  comprimento: 30, // cm
  largura: 30, // cm
  altura: 10, // cm
  estoque_padrao: 100,
  usar_imagens_publicas: true,
  comissao_percentual_padrao: 20,
  taxa_fixa_item_padrao: 4,
  margem_liquida_percentual_padrao: 20,
  modo_margem_lucro_padrao: 'valor_fixo' as const,
  margem_lucro_fixa_padrao: 4,
  valor_minimo_baixo_valor_padrao: 8,
  adicional_baixo_valor_padrao: 1,
  teto_comissao_padrao: 100,
  aplicar_teto_padrao: true,
  aplicar_baixo_valor_padrao: true,
  ncm_padrao: '55161300',
  cest_padrao: '2806000',
};
