import { Timestamp } from 'firebase-admin/firestore';

/**
 * Tamanho - entidade para variações de tamanho de produtos
 */
export interface Tamanho {
  id: string;
  nome: string; // Ex: "P", "M", "G", "GG", "1,50m", "2m"
  descricao?: string;
  ordem: number; // Ordem de exibição
  ativo: boolean;
  sku?: string; // TAM001, TAM002, etc.
  createdAt: Timestamp;
  updatedAt: Timestamp;
  deletedAt?: Timestamp;
}

/**
 * Dados para criar um novo tamanho
 */
export interface CreateTamanhoData {
  nome: string;
  descricao?: string;
  ordem?: number;
}

/**
 * Dados para atualizar um tamanho
 */
export interface UpdateTamanhoData {
  nome?: string;
  descricao?: string;
  ordem?: number;
  ativo?: boolean;
}

/**
 * Controle de SKUs de tamanhos
 */
export interface SkuControlTamanho {
  lastSkuNumber: number;
  invalidatedSkus: string[];
}
