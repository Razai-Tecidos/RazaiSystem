export type TipoTecido = 'liso' | 'estampado';
export type GramaturaUnidade = 'g_m2' | 'g_m_linear';

export interface Tecido {
  id: string;
  nome: string;
  tipo: TipoTecido;
  largura: number;
  composicao: string; // Campo de texto livre (ex: "Algodao 60%, Poliester 40%")
  rendimentoPorKg?: number; // m/kg
  gramaturaValor?: number;
  gramaturaUnidade?: GramaturaUnidade;
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
  rendimentoPorKg?: number;
  gramaturaValor?: number;
  gramaturaUnidade?: GramaturaUnidade;
  imagemPadrao?: string; // URL apos upload (opcional para estampados)
  descricao?: string;
}

export interface UpdateTecidoRequest extends Partial<CreateTecidoRequest> {}

