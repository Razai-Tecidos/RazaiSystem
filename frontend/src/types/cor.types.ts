import { Timestamp } from 'firebase/firestore';
import { ReinhardConfig } from '@/hooks/useReinhardTingimento';

/**
 * Cor - entidade independente (sem vinculo com tecido)
 */
export interface Cor {
  id: string;
  nome: string;
  codigoHex?: string;
  sku?: string;
  lab?: LabColor;
  labOriginal?: LabColor;
  rgb?: { r: number; g: number; b: number };
  createdAt: Timestamp;
  updatedAt: Timestamp;
  deletedAt?: Timestamp;
}

/**
 * CorTecido - vinculo entre cor e tecido
 */
export interface CorTecido {
  id: string;
  sku?: string;
  corId: string;
  corNome: string;
  corHex?: string;
  corSku?: string;
  tecidoId: string;
  tecidoNome: string;
  tecidoSku?: string;
  imagemTingida?: string;
  imagemTingidaThumb?: string;
  imagemGerada?: string;
  imagemGeradaThumb?: string;
  imagemGeradaFingerprint?: string;
  imagemGeradaAt?: Timestamp;
  imagemModelo?: string;
  imagemModeloThumb?: string;
  imagemModeloAt?: Timestamp;
  imagemPremiumSquare?: string;
  imagemPremiumSquareThumb?: string;
  imagemPremiumPortrait?: string;
  imagemPremiumPortraitThumb?: string;
  imagemPremiumAt?: Timestamp;
  ajustesReinhard?: ReinhardConfig;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  deletedAt?: Timestamp;
}

export interface SkuControlCor {
  familias: Record<string, number>;
  prefixosReservados: Record<string, string>;
}

export interface CreateCorData {
  nome: string;
  codigoHex?: string;
  lab?: LabColor;
  labOriginal?: LabColor;
  rgb?: { r: number; g: number; b: number };
}

export interface UpdateCorData extends Partial<CreateCorData> {
  id: string;
  sku?: string;
}

export interface CreateCorTecidoData {
  corId: string;
  corNome: string;
  corHex?: string;
  corSku?: string;
  tecidoId: string;
  tecidoNome: string;
  tecidoSku?: string;
  sku?: string;
  imagemTingida?: string;
  imagemTingidaThumb?: string;
  imagemGerada?: string;
  imagemGeradaThumb?: string;
  imagemGeradaFingerprint?: string;
  imagemGeradaAt?: Timestamp;
  imagemModelo?: string;
  imagemModeloThumb?: string;
  imagemModeloAt?: Timestamp;
  imagemPremiumSquare?: string;
  imagemPremiumSquareThumb?: string;
  imagemPremiumPortrait?: string;
  imagemPremiumPortraitThumb?: string;
  imagemPremiumAt?: Timestamp;
  ajustesReinhard?: ReinhardConfig;
}

export interface UpdateCorTecidoData {
  id: string;
  sku?: string;
  imagemTingida?: string;
  imagemTingidaThumb?: string;
  imagemGerada?: string;
  imagemGeradaThumb?: string;
  imagemGeradaFingerprint?: string;
  imagemGeradaAt?: Timestamp;
  imagemModelo?: string;
  imagemModeloThumb?: string;
  imagemModeloAt?: Timestamp;
  imagemPremiumSquare?: string;
  imagemPremiumSquareThumb?: string;
  imagemPremiumPortrait?: string;
  imagemPremiumPortraitThumb?: string;
  imagemPremiumAt?: Timestamp;
  ajustesReinhard?: ReinhardConfig;
  corId?: string;
  corNome?: string;
  corHex?: string;
  corSku?: string;
  tecidoNome?: string;
  tecidoSku?: string;
}

export interface LabColor {
  L: number;
  a: number;
  b: number;
}

// Legacy types for migration compatibility
export interface CorLegacy extends Cor {
  tecidoId?: string;
  tecidoNome?: string;
  tecidoSku?: string;
  imagemTingida?: string;
  ajustesReinhard?: ReinhardConfig;
}

export interface CreateCorDataLegacy extends CreateCorData {
  tecidoId?: string;
  tecidoNome?: string;
  tecidoSku?: string;
  imagemTingida?: string;
  ajustesReinhard?: ReinhardConfig;
}
