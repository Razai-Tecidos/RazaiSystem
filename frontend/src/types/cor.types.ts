import { Timestamp } from 'firebase/firestore';

export interface Cor {
  id: string; // Document ID
  nome: string;
  codigoHex?: string; // Código hexadecimal da cor (ex: #FF5733)
  sku?: string; // VE001, AZ002, etc (opcional até renomear de "Cor capturada")
  lab?: LabColor; // Valores LAB originais da captura (referência para deltaE)
  rgb?: { r: number; g: number; b: number }; // Valores RGB convertidos
  tecidoId?: string; // ID do tecido associado
  tecidoNome?: string; // Nome do tecido associado
  tecidoSku?: string; // SKU do tecido associado
  imagemTingida?: string; // URL da imagem do tecido tingido com esta cor
  createdAt: Timestamp;
  updatedAt: Timestamp;
  deletedAt?: Timestamp; // Para SKUs invalidados
}

export interface SkuControlCor {
  // Mapa de prefixo -> último número usado
  // Ex: { "VE": 3, "AZ": 5, "VM": 1 }
  familias: Record<string, number>;
  // Prefixos reservados para evitar conflito
  // Ex: { "VE": "Verde", "VM": "Vermelho" }
  prefixosReservados: Record<string, string>;
}

export interface CreateCorData {
  nome: string;
  codigoHex?: string;
  lab?: LabColor; // Valores LAB originais da captura
  rgb?: { r: number; g: number; b: number }; // Valores RGB convertidos
  tecidoId?: string; // ID do tecido associado
  tecidoNome?: string; // Nome do tecido associado
  tecidoSku?: string; // SKU do tecido associado
  imagemTingida?: string; // URL da imagem do tecido tingido
}

export interface UpdateCorData extends Partial<CreateCorData> {
  id: string;
}

export interface LabColor {
  L: number; // 0-100
  a: number; // -128 a 127
  b: number; // -128 a 127
}
