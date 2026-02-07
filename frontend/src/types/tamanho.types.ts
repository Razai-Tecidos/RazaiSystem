import { Timestamp } from 'firebase/firestore';

/**
 * Tamanho - entidade para variações de tamanho de produtos
 */
export interface Tamanho {
  id: string;
  nome: string;
  descricao?: string;
  ordem: number;
  ativo: boolean;
  sku?: string;
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
