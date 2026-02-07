import { Timestamp } from 'firebase-admin/firestore';

/**
 * Template de anúncio Shopee
 */
export interface ShopeeProductTemplate {
  id: string;
  nome: string;
  descricao?: string;
  
  // Configurações do template
  categoria_id?: number;
  categoria_nome?: string;
  preco_base?: number;
  estoque_padrao?: number;
  peso?: number;
  dimensoes?: {
    comprimento: number;
    largura?: number; // null = usar largura do tecido
    altura: number;
  };
  descricao_template?: string;
  usar_imagens_publicas?: boolean;
  
  // Configurações de variações
  incluir_tamanhos?: boolean;
  tamanhos_padrao?: string[]; // IDs dos tamanhos padrão
  
  // Metadados
  created_at: Timestamp;
  updated_at: Timestamp;
  created_by: string;
  uso_count: number;
}

/**
 * Dados para criar um template
 */
export interface CreateShopeeTemplateData {
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
}

/**
 * Dados para atualizar um template
 */
export interface UpdateShopeeTemplateData extends Partial<CreateShopeeTemplateData> {
  id: string;
}
