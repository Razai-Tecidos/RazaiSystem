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

  const storageRef = ref(storage, `mosaicos/${tecidoId}/${mosaicoId}/${filename}`);
  await uploadBytes(storageRef, blob);
  return getDownloadURL(storageRef);
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
