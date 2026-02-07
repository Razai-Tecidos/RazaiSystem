import { Timestamp } from 'firebase/firestore';

export interface Estampa {
  id: string; // Document ID
  nome: string; // Nome da estampa (primeira palavra = família)
  tecidoBaseId: string; // ID do tecido base usado
  tecidoBaseNome?: string; // Nome do tecido (para exibição)
  imagem?: string; // URL da imagem no Firebase Storage (opcional)
  descricao?: string;
  sku?: string; // SKU baseado na família (JA001, FL002, etc)
  createdAt: Timestamp;
  updatedAt: Timestamp;
  deletedAt?: Timestamp;
}

export interface SkuControlEstampa {
  familias: Record<string, number>; // Ex: { "JA": 3, "FL": 2 }
  prefixosReservados: Record<string, string>; // Ex: { "JA": "Jardim", "FL": "Floral" }
}

export interface CreateEstampaData {
  nome: string;
  tecidoBaseId: string;
  imagem?: File | string; // Opcional
  descricao?: string;
}

export interface UpdateEstampaData extends Partial<CreateEstampaData> {
  id: string;
  sku?: string; // Permite atualização manual do SKU
}
