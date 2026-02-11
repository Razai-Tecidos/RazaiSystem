import {
  Timestamp,
  addDoc,
  collection,
  doc,
  getDocs,
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
  await keepOnlyLatestMosaicoForTecido(data.tecidoId, docRef.id);

  return docRef.id;
}

async function keepOnlyLatestMosaicoForTecido(tecidoId: string, keepMosaicoId: string): Promise<void> {
  const q = query(
    collection(db, COLLECTION_NAME),
    where('tecidoId', '==', tecidoId)
  );

  const snapshot = await getDocs(q);
  const batch = writeBatch(db);
  let hasDelete = false;

  const docsSorted = snapshot.docs.sort((a, b) => {
    if (a.id === keepMosaicoId) return -1;
    if (b.id === keepMosaicoId) return 1;
    const aCreatedAt = a.data().createdAt?.toMillis?.() ?? 0;
    const bCreatedAt = b.data().createdAt?.toMillis?.() ?? 0;
    return bCreatedAt - aCreatedAt;
  });

  docsSorted.forEach((mosaicoDoc, index) => {
    if (index < 2) return;
    batch.delete(mosaicoDoc.ref);
    hasDelete = true;
  });

  if (hasDelete) {
    await batch.commit();
  }
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
  return listMosaicosByTecidoWithLimit(tecidoId, 1);
}

export async function listRecentMosaicosByTecido(
  tecidoId: string,
  limit: number = 2
): Promise<GestaoImagemMosaico[]> {
  const items = await listMosaicosByTecidoWithLimit(tecidoId, Math.max(1, limit));
  return items;
}

async function listMosaicosByTecidoWithLimit(
  tecidoId: string,
  limit: number
): Promise<GestaoImagemMosaico[]> {
  let items: GestaoImagemMosaico[] = [];

  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('tecidoId', '==', tecidoId)
    );

    const snapshot = await getDocs(q);
    items = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as GestaoImagemMosaico[];
  } catch (primaryError) {
    console.warn('[gestao-imagens] Falha na query filtrada. Aplicando fallback por varredura completa.', primaryError);
    const snapshot = await getDocs(collection(db, COLLECTION_NAME));
    const allItems = snapshot.docs
      .map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as GestaoImagemMosaico[];
    items = allItems.filter((item) => item.tecidoId === tecidoId);
  }

  const sorted = items.sort((a, b) => {
    const aDefault = a.isDefaultForTecido ? 1 : 0;
    const bDefault = b.isDefaultForTecido ? 1 : 0;
    if (bDefault !== aDefault) return bDefault - aDefault;

    const aCreatedAt = a.createdAt?.toMillis?.() ?? 0;
    const bCreatedAt = b.createdAt?.toMillis?.() ?? 0;
    return bCreatedAt - aCreatedAt;
  });

  return sorted.slice(0, limit);
}

export async function getLatestMosaicoByTecido(tecidoId: string): Promise<GestaoImagemMosaico | null> {
  const items = await listMosaicosByTecido(tecidoId);
  if (items.length === 0) {
    return null;
  }

  return items[0];
}
