export interface Cor {
  id: string;
  nome: string;
  codigoHex?: string;
  sku: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export interface CreateCorRequest {
  nome: string;
  codigoHex?: string;
}

export interface UpdateCorRequest extends Partial<CreateCorRequest> {}
