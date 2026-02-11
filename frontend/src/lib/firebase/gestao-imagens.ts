import {
  Timestamp,
  addDoc,
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  writeBatch,
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
    isDefaultForTecido: data.isDefaultForTecido ?? false,
    createdAt: Timestamp.now(),
  });

  if (data.isDefaultForTecido) {
    await setDefaultMosaicoForTecido(data.tecidoId, docRef.id);
  }

  return docRef.id;
}

export async function setDefaultMosaicoForTecido(
  tecidoId: string,
  mosaicoId: string
): Promise<void> {
  const q = query(
    collection(db, COLLECTION_NAME),
    where('tecidoId', '==', tecidoId)
  );

  const snapshot = await getDocs(q);
  const batch = writeBatch(db);
  let hasTarget = false;

  snapshot.docs.forEach((mosaicoDoc) => {
    const shouldBeDefault = mosaicoDoc.id === mosaicoId;
    if (shouldBeDefault) {
      hasTarget = true;
    }

    batch.update(mosaicoDoc.ref, {
      isDefaultForTecido: shouldBeDefault,
    });
  });

  if (!hasTarget) {
    batch.update(doc(db, COLLECTION_NAME, mosaicoId), {
      isDefaultForTecido: true,
    });
  }

  await batch.commit();
}

export async function listMosaicosByTecido(tecidoId: string): Promise<GestaoImagemMosaico[]> {
  const q = query(
    collection(db, COLLECTION_NAME),
    where('tecidoId', '==', tecidoId),
    orderBy('createdAt', 'desc')
  );

  const snapshot = await getDocs(q);
  const items = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as GestaoImagemMosaico[];

  return items.sort((a, b) => {
    const aDefault = a.isDefaultForTecido ? 1 : 0;
    const bDefault = b.isDefaultForTecido ? 1 : 0;
    return bDefault - aDefault;
  });
}

export async function getLatestMosaicoByTecido(tecidoId: string): Promise<GestaoImagemMosaico | null> {
  const q = query(
    collection(db, COLLECTION_NAME),
    where('tecidoId', '==', tecidoId),
    orderBy('createdAt', 'desc'),
    limit(1)
  );

  const snapshot = await getDocs(q);
  if (snapshot.empty) {
    return null;
  }

  const latestDoc = snapshot.docs[0];
  return {
    id: latestDoc.id,
    ...latestDoc.data(),
  } as GestaoImagemMosaico;
}
