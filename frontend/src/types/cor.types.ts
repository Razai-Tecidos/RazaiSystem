import { Timestamp } from 'firebase/firestore';
import { ReinhardConfig } from '@/hooks/useReinhardTingimento';

/**
 * Cor - entidade independente (sem vínculo com tecido)
 * Representa uma cor capturada ou cadastrada
 */
export interface Cor {
  id: string; // Document ID
  nome: string;
  codigoHex?: string; // Código hexadecimal da cor (ex: #FF5733)
  sku?: string; // VE001, AZ002, etc (opcional até renomear de "Cor capturada")
  lab?: LabColor; // Valores LAB compensados (usado no processo Reinhard)
  labOriginal?: LabColor; // Valores LAB originais capturados pelo colorímetro
  rgb?: { r: number; g: number; b: number }; // Valores RGB convertidos
  createdAt: Timestamp;
  updatedAt: Timestamp;
  deletedAt?: Timestamp; // Para soft delete
}

/**
 * CorTecido - vínculo entre cor e tecido
 * Armazena a imagem tingida específica para cada combinação cor+tecido
 */
export interface CorTecido {
  id: string; // Document ID
  sku?: string; // SKU do vínculo: "TecidoSKU-CorSKU" (ex: "T007-MA001")
  corId: string; // Referência à cor
  corNome: string; // Denormalizado para exibição
  corHex?: string; // Denormalizado para exibição
  corSku?: string; // Denormalizado para exibição
  tecidoId: string; // Referência ao tecido
  tecidoNome: string; // Denormalizado para exibição
  tecidoSku?: string; // Denormalizado para exibição
  imagemTingida?: string; // URL da imagem do tecido tingido com esta cor
  ajustesReinhard?: ReinhardConfig; // Ajustes do algoritmo Reinhard usados
  createdAt: Timestamp;
  updatedAt: Timestamp;
  deletedAt?: Timestamp; // Para soft delete
}

export interface SkuControlCor {
  // Mapa de prefixo -> último número usado
  // Ex: { "VE": 3, "AZ": 5, "VM": 1 }
  familias: Record<string, number>;
  // Prefixos reservados para evitar conflito
  // Ex: { "VE": "Verde", "VM": "Vermelho" }
  prefixosReservados: Record<string, string>;
}

/**
 * Dados para criar uma nova cor (sem vínculo com tecido)
 */
export interface CreateCorData {
  nome: string;
  codigoHex?: string;
  lab?: LabColor; // Valores LAB compensados (usado no processo Reinhard)
  labOriginal?: LabColor; // Valores LAB originais capturados pelo colorímetro
  rgb?: { r: number; g: number; b: number }; // Valores RGB convertidos
}

/**
 * Dados para atualizar uma cor
 */
export interface UpdateCorData extends Partial<CreateCorData> {
  id: string;
  sku?: string; // SKU pode ser atualizado manualmente
}

/**
 * Dados para criar um vínculo cor-tecido
 */
export interface CreateCorTecidoData {
  corId: string;
  corNome: string;
  corHex?: string;
  corSku?: string;
  tecidoId: string;
  tecidoNome: string;
  tecidoSku?: string;
  sku?: string; // SKU do vínculo: "TecidoSKU-CorSKU"
  imagemTingida?: string;
  ajustesReinhard?: ReinhardConfig;
}

/**
 * Dados para atualizar um vínculo cor-tecido
 */
export interface UpdateCorTecidoData {
  id: string;
  sku?: string; // SKU do vínculo: "TecidoSKU-CorSKU"
  imagemTingida?: string;
  ajustesReinhard?: ReinhardConfig;
  // Permite mudar a cor do vínculo (usado para mesclar cores)
  corId?: string;
  // Dados denormalizados podem ser atualizados se a cor/tecido mudar
  corNome?: string;
  corHex?: string;
  corSku?: string;
  tecidoNome?: string;
  tecidoSku?: string;
}

export interface LabColor {
  L: number; // 0-100
  a: number; // -128 a 127
  b: number; // -128 a 127
}

// ============================================
// TIPOS LEGADOS (para compatibilidade durante migração)
// ============================================

/**
 * @deprecated Use Cor + CorTecido separadamente
 * Tipo legado que inclui campos de tecido na cor
 */
export interface CorLegacy extends Cor {
  tecidoId?: string;
  tecidoNome?: string;
  tecidoSku?: string;
  imagemTingida?: string;
  ajustesReinhard?: ReinhardConfig;
}

/**
 * @deprecated Use CreateCorData + CreateCorTecidoData separadamente
 */
export interface CreateCorDataLegacy extends CreateCorData {
  tecidoId?: string;
  tecidoNome?: string;
  tecidoSku?: string;
  imagemTingida?: string;
  ajustesReinhard?: ReinhardConfig;
}
