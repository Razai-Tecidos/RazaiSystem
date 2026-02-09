export type TipoTecido = 'liso' | 'estampado';

export interface Tecido {
  id: string;
  nome: string;
  tipo: TipoTecido;
  largura: number;
  composicao: string; // Campo de texto livre (ex: "Algodão 60%, Poliester 40%")
  imagemPadrao?: string; // URL do Firebase Storage (opcional para estampados)
  descricao?: string;
  sku: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

export interface CreateTecidoRequest {
  nome: string;
  tipo?: TipoTecido;
  largura: number;
  composicao: string;
  imagemPadrao?: string; // URL após upload (opcional para estampados)
  descricao?: string;
}

export interface UpdateTecidoRequest extends Partial<CreateTecidoRequest> {}
