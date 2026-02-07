import { Timestamp } from 'firebase-admin/firestore';

/**
 * Preferências do usuário para criação de anúncios Shopee
 */
export interface ShopeeUserPreferences {
  id: string; // UID do usuário
  preco_base_padrao?: number;
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
 * Dados para atualizar preferências
 */
export interface UpdateShopeePreferencesData {
  preco_base_padrao?: number;
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
  categoria_nome_padrao?: string;
}

/**
 * Valores padrão do sistema
 */
export const SYSTEM_DEFAULTS = {
  peso: 0.1, // kg
  comprimento: 100, // cm
  altura: 1, // cm
  usar_imagens_publicas: true,
};
