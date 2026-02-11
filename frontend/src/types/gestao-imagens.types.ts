import { Timestamp } from 'firebase/firestore';

export type MosaicTemplateId = 'grid-2x2' | 'hero-vertical' | 'triptych' | 'premium-info';

export interface GestaoImagemMosaico {
  id: string;
  tecidoId: string;
  tecidoNomeSnapshot: string;
  templateId: MosaicTemplateId;
  sourcePolicy: 'gerada' | 'original';
  selectedVinculoIds: string[];
  selectedImageUrls: string[];
  outputSquareUrl: string;
  outputPortraitUrl: string;
  isDefaultForTecido?: boolean;
  createdBy: string;
  createdAt: Timestamp;
}

export interface CreateGestaoImagemMosaicoData {
  tecidoId: string;
  tecidoNomeSnapshot: string;
  templateId: MosaicTemplateId;
  sourcePolicy: 'gerada' | 'original';
  selectedVinculoIds: string[];
  selectedImageUrls: string[];
  outputSquareUrl: string;
  outputPortraitUrl: string;
  isDefaultForTecido?: boolean;
  createdBy: string;
}
