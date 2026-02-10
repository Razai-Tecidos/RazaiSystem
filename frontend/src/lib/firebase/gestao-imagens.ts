import {
  Timestamp,
  addDoc,
  collection,
  getDocs,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { auth, db, storage } from '@/config/firebase';
import {
  CreateGestaoImagemMosaicoData,
  GestaoImagemMosaico,
} from '@/types/gestao-imagens.types';

const COLLECTION_NAME = 'gestao_imagens_mosaicos';

export async function uploadMosaicoImage(
  tecidoId: string,
  mosaicoId: string,
  blob: Blob,
  filename: string
): Promise<string> {
  if (!auth.currentUser) {
    throw new Error('Usuario nao autenticado');
  }

  const primaryRef = ref(storage, `mosaicos/${tecidoId}/${mosaicoId}/${filename}`);

  try {
    await uploadBytes(primaryRef, blob);
    return getDownloadURL(primaryRef);
  } catch (error) {
    const code = (error as { code?: string } | null)?.code;
    if (code !== 'storage/unauthorized') {
      throw error;
    }

    // Fallback para compatibilidade com ambientes onde as regras de /mosaicos
    // ainda nao foram publicadas.
    const fallbackRef = ref(storage, `cor-tecido/${tecidoId}/mosaicos/${mosaicoId}/${filename}`);
    await uploadBytes(fallbackRef, blob);
    return getDownloadURL(fallbackRef);
  }
}

export async function createGestaoImagemMosaico(
  data: CreateGestaoImagemMosaicoData
): Promise<string> {
  const docRef = await addDoc(collection(db, COLLECTION_NAME), {
    ...data,
    createdAt: Timestamp.now(),
  });
  return docRef.id;
}

export async function listMosaicosByTecido(tecidoId: string): Promise<GestaoImagemMosaico[]> {
  const q = query(
    collection(db, COLLECTION_NAME),
    where('tecidoId', '==', tecidoId),
    orderBy('createdAt', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as GestaoImagemMosaico[];
}
