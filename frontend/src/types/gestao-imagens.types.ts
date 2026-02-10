import { Timestamp } from 'firebase/firestore';

export type MosaicTemplateId = 'grid-2x2' | 'hero-vertical' | 'triptych';

export interface GestaoImagemMosaico {
  id: string;
  tecidoId: string;
  tecidoNomeSnapshot: string;
  templateId: MosaicTemplateId;
  sourcePolicy: 'gerada';
  selectedVinculoIds: string[];
  selectedImageUrls: string[];
  outputSquareUrl: string;
  outputPortraitUrl: string;
  createdBy: string;
  createdAt: Timestamp;
}

export interface CreateGestaoImagemMosaicoData {
  tecidoId: string;
  tecidoNomeSnapshot: string;
  templateId: MosaicTemplateId;
  sourcePolicy: 'gerada';
  selectedVinculoIds: string[];
  selectedImageUrls: string[];
  outputSquareUrl: string;
  outputPortraitUrl: string;
  createdBy: string;
}
