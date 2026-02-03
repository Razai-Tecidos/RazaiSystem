export interface ComposicaoItem {
  id: string;
  nome: string;
  porcentagem: number;
}

export interface Tecido {
  id: string;
  nome: string;
  largura: number;
  composicao: ComposicaoItem[];
  imagemPadrao: string;
  descricao?: string;
  sku: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export interface CreateTecidoRequest {
  nome: string;
  largura: number;
  composicao: ComposicaoItem[];
  imagemPadrao: string; // URL após upload
  descricao?: string;
}

export interface UpdateTecidoRequest extends Partial<CreateTecidoRequest> {}
