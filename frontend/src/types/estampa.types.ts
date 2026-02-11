import { Timestamp } from 'firebase/firestore';

export interface Estampa {
  id: string; // Document ID
  nome: string; // Nome da estampa (primeira palavra = familia)
  tecidoBaseId: string; // ID do tecido base usado
  tecidoBaseNome?: string; // Nome do tecido (para exibicao)
  imagem?: string; // URL da imagem no Firebase Storage (opcional)
  imagemThumb?: string; // URL da miniatura otimizada para listas/PDF
  imagemGerada?: string; // URL da imagem com overlay de marca/nome
  imagemGeradaFingerprint?: string; // controle de versao da imagem gerada
  imagemGeradaAt?: Timestamp; // data da ultima geracao
  descricao?: string;
  sku?: string; // SKU baseado na familia (JA001, FL002, etc)
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
  sku?: string;
  imagemGerada?: string;
  imagemGeradaFingerprint?: string;
  imagemGeradaAt?: Timestamp;
}
