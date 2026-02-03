import { Timestamp } from 'firebase/firestore';
import { LabColor } from './cor.types';

// Lista de captura de cores com associação a tecidos
export interface CapturaItem {
  id: string;
  lab: LabColor;
  hex: string;
  nome: string;
  tecidoId: string;
  tecidoNome: string;
  tecidoImagemPadrao: string;
  tecidoSku: string;
  deltaE?: number; // Distância para cor mais próxima
  corConflitoId?: string; // ID da cor conflitante
  corConflitoNome?: string; // Nome da cor conflitante
  corConflitoHex?: string; // Hex da cor conflitante
  status: 'normal' | 'conflito' | 'editando';
  createdAt: Timestamp;
  ajustes?: AjustesCor;
}

// Estado de conflito para exibição
export interface CorConflito {
  corId: string;
  corNome: string;
  corHex: string;
  deltaE: number;
}

// Dados para cálculo de deltaE
export interface DeltaEData {
  lab1: LabColor;
  lab2: LabColor;
}

// Ajustes de cor para algoritmo Reinhart
export interface AjustesCor {
  hue: number;        // -180 a 180
  saturation: number; // -100 a 100  
  brightness: number; // -100 a 100
  contrast: number;   // -100 a 100
}

// Dados para criar nova captura
export interface CreateCapturaData {
  lab: LabColor;
  hex: string;
  nome: string;
  tecidoId: string;
  tecidoNome: string;
  tecidoImagemPadrao: string;
  tecidoSku: string;
  ajustes?: AjustesCor;
  corConflitoId?: string;
  corConflitoNome?: string;
  corConflitoHex?: string;
  deltaE?: number;
}

// Dados para atualizar captura
export interface UpdateCapturaData extends Partial<CreateCapturaData> {
  id: string;
  status?: 'normal' | 'conflito' | 'editando';
}

// Estado de lista de captura no frontend
export interface CapturaListaState {
  items: CapturaItem[];
  conflitos: Map<string, CorConflito>;
}

// Resposta de validação de conflitos
export interface ValidacaoConflitoResponse {
  conflito: boolean;
  detalhes?: CorConflito;
}