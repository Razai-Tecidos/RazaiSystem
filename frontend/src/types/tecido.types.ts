import { Timestamp } from 'firebase/firestore';

export type TipoTecido = 'liso' | 'estampado';

export interface ComposicaoItem {
  id: string; // ID único do item
  nome: string; // Ex: "Algodão", "Poliester"
  porcentagem: number; // Ex: 60, 40
}

export interface Tecido {
  id: string; // Document ID
  nome: string;
  tipo: TipoTecido; // 'liso' ou 'estampado'
  largura: number; // em metros
  composicao: string; // Campo de texto livre
  imagemPadrao?: string; // URL do Firebase Storage (opcional para estampados)
  descricao?: string;
  sku: string; // T001, T002, etc
  createdAt: Timestamp;
  updatedAt: Timestamp;
  deletedAt?: Timestamp; // Para SKUs invalidados
}

export interface SkuControl {
  lastSkuNumber: number; // Último número usado (ex: 3 para T003)
  invalidatedSkus: string[]; // Array de SKUs excluídos ["T002"]
}

export interface CreateTecidoData {
  nome: string;
  tipo: TipoTecido; // 'liso' ou 'estampado'
  largura: number;
  composicao: string; // Campo de texto livre
  imagemPadrao?: File | string; // File para upload, string para URL existente (opcional para estampados)
  descricao?: string;
}

export interface UpdateTecidoData extends Partial<CreateTecidoData> {
  id: string;
}
