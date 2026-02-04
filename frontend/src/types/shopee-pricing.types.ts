import { Timestamp } from 'firebase/firestore';

/**
 * Configuração de custo e margem por SKU
 */
export interface SkuCost {
  id: string; // Document ID (mesmo que item_sku)
  item_sku: string; // SKU do produto na Shopee
  shop_id: number; // ID da loja Shopee
  
  // Custos
  custo_unitario: number; // Custo do produto (R$)
  
  // Margens configuradas
  margem_minima: number; // % mínima aceitável (ex: 15)
  margem_target: number; // % ideal desejada (ex: 30)
  
  // Configuração Shopee
  usa_frete_gratis: boolean; // Se participa do programa Frete Grátis (afeta taxa)
  
  // Limites de preço
  preco_minimo?: number; // Piso absoluto (R$)
  preco_maximo?: number; // Teto absoluto (R$)
  
  // Automação
  automacao_ativa: boolean; // Se o sistema pode ajustar preço automaticamente
  
  // Metadados
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string; // UID do usuário
  updatedBy: string; // UID do usuário
}

export interface CreateSkuCostData {
  item_sku: string;
  shop_id: number;
  custo_unitario: number;
  margem_minima: number;
  margem_target: number;
  usa_frete_gratis?: boolean;
  preco_minimo?: number;
  preco_maximo?: number;
  automacao_ativa?: boolean;
}

export interface UpdateSkuCostData {
  custo_unitario?: number;
  margem_minima?: number;
  margem_target?: number;
  usa_frete_gratis?: boolean;
  preco_minimo?: number;
  preco_maximo?: number;
  automacao_ativa?: boolean;
}

/**
 * Dados de performance de vendas por SKU
 */
export interface SkuSalesData {
  id: string;
  item_sku: string;
  shop_id: number;
  
  // Período de análise
  periodo_inicio: Timestamp;
  periodo_fim: Timestamp;
  
  // Métricas de vendas
  quantidade_vendida: number;
  receita_bruta: number; // Total de vendas (R$)
  receita_liquida: number; // Após taxas Shopee (R$)
  
  // Métricas calculadas
  preco_medio_praticado: number;
  margem_real: number; // % calculada
  
  // Performance
  visualizacoes?: number;
  cliques?: number;
  taxa_conversao?: number; // %
  
  // Metadados
  coletadoEm: Timestamp;
}

/**
 * Log de alterações automáticas de preço
 */
export interface PriceChangeLog {
  id: string;
  item_sku: string;
  shop_id: number;
  item_id: string;
  model_id?: number;
  
  // Alteração
  preco_anterior: number;
  preco_novo: number;
  variacao_percentual: number;
  
  // Motivo
  motivo: 'demanda_alta' | 'demanda_baixa' | 'margem_minima' | 'manual' | 'promocao';
  descricao: string;
  
  // Métricas no momento
  demanda_7d?: number;
  conversao?: number;
  margem_atual?: number;
  
  // Metadados
  executadoEm: Timestamp;
  executadoPor: 'sistema' | string; // 'sistema' ou UID do usuário
  sucesso: boolean;
  erro?: string;
}

/**
 * Regras de automação configuráveis
 */
export interface PricingRule {
  id: string;
  shop_id: number;
  nome: string;
  ativa: boolean;
  
  // Condições (todas devem ser verdadeiras)
  condicoes: {
    demanda?: 'alta' | 'baixa' | 'qualquer';
    conversao?: 'alta' | 'baixa' | 'qualquer';
    margem_abaixo_minima?: boolean;
  };
  
  // Ação
  acao: {
    tipo: 'aumentar' | 'diminuir' | 'manter';
    percentual?: number; // Ex: 5 para +5% ou -5%
    limite?: 'margem_minima' | 'margem_target' | 'preco_minimo' | 'preco_maximo';
  };
  
  // Prioridade (menor = executa primeiro)
  prioridade: number;
  
  // Metadados
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Resumo de margem para dashboard
 */
export interface MarginSummary {
  item_sku: string;
  item_name?: string;
  shop_id: number;
  
  // Preço atual
  preco_atual: number;
  
  // Custos
  custo_unitario: number;
  custo_frete_medio: number;
  
  // Margens
  margem_configurada_min: number;
  margem_configurada_target: number;
  margem_real: number; // Calculada com receita líquida
  
  // Status
  status: 'otimo' | 'ok' | 'atencao' | 'critico';
  // otimo: margem >= target
  // ok: margem >= minima
  // atencao: margem < minima mas > 0
  // critico: margem <= 0
  
  // Métricas
  vendas_7d: number;
  tendencia: 'subindo' | 'estavel' | 'descendo';
}
