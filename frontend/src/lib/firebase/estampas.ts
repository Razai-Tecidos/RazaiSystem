import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { auth, db, storage } from '@/config/firebase';
import { Estampa, SkuControlEstampa, CreateEstampaData } from '@/types/estampa.types';

const ESTAMPAS_COLLECTION = 'estampas';
const SKU_CONTROL_DOC = 'sku_control';
const SKU_CONTROL_ID = 'estampas';

/**
 * Busca todas as estampas cadastradas (não excluídas)
 */
export async function getEstampas(): Promise<Estampa[]> {
  try {
    const q = query(
      collection(db, ESTAMPAS_COLLECTION),
      where('deletedAt', '==', null),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    } as Estampa));
  } catch (error: any) {
    // Se erro de índice, tentar sem orderBy
    if (error.code === 'failed-precondition') {
      const q = query(
        collection(db, ESTAMPAS_COLLECTION),
        where('deletedAt', '==', null)
      );
      const snapshot = await getDocs(q);
      const estampas = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      } as Estampa));
      // Ordenar manualmente
      return estampas.sort((a, b) => {
        const aTime = a.createdAt?.toMillis() || 0;
        const bTime = b.createdAt?.toMillis() || 0;
        return bTime - aTime;
      });
    }
    throw error;
  }
}

/**
 * Busca uma estampa específica por ID
 */
export async function getEstampaById(id: string): Promise<Estampa | null> {
  const docRef = doc(db, ESTAMPAS_COLLECTION, id);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    return null;
  }

  return {
    id: docSnap.id,
    ...docSnap.data(),
  } as Estampa;
}

/**
 * Faz upload de imagem de estampa para Firebase Storage
 */
export async function uploadEstampaImage(
  file: File,
  estampaId: string
): Promise<string> {
  if (!auth.currentUser) {
    throw new Error('Usuário não autenticado. Faça login para continuar.');
  }

  const timestamp = Date.now();
  const fileName = `${timestamp}-${file.name}`;
  const storageRef = ref(storage, `estampas/${estampaId}/${fileName}`);

  try {
    await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(storageRef);
    return downloadURL;
  } catch (error: any) {
    if (error.code === 'storage/unauthorized') {
      throw new Error('Sem permissão para fazer upload. Verifique as regras de segurança do Firebase Storage.');
    }
    throw error;
  }
}

/**
 * Remove imagem do Firebase Storage
 */
export async function deleteEstampaImage(imageUrl: string): Promise<void> {
  try {
    const imageRef = ref(storage, imageUrl);
    await deleteObject(imageRef);
  } catch (error) {
    console.warn('Erro ao deletar imagem:', error);
  }
}

/**
 * Cria uma nova estampa no Firestore
 */
export async function createEstampa(
  data: CreateEstampaData,
  sku: string | null,
  imageUrl?: string,
  tecidoBaseNome?: string
): Promise<Estampa> {
  const estampaData: any = {
    nome: data.nome,
    tecidoBaseId: data.tecidoBaseId,
    tecidoBaseNome: tecidoBaseNome || '',
    imagem: imageUrl || '',
    descricao: data.descricao || '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    deletedAt: null,
  };

  // Só adiciona SKU se não for null
  if (sku) {
    estampaData.sku = sku;
  }

  const docRef = await addDoc(collection(db, ESTAMPAS_COLLECTION), estampaData);
  const createdDoc = await getDoc(docRef);

  return {
    id: createdDoc.id,
    ...createdDoc.data(),
  } as Estampa;
}

/**
 * Atualiza uma estampa existente
 */
export async function updateEstampa(
  id: string,
  data: Partial<CreateEstampaData> & { sku?: string | null },
  imageUrl?: string,
  tecidoBaseNome?: string
): Promise<void> {
  const docRef = doc(db, ESTAMPAS_COLLECTION, id);
  const updateData: any = {
    updatedAt: serverTimestamp(),
  };

  if (data.nome !== undefined) updateData.nome = data.nome;
  if (data.tecidoBaseId !== undefined) updateData.tecidoBaseId = data.tecidoBaseId;
  if (tecidoBaseNome !== undefined) updateData.tecidoBaseNome = tecidoBaseNome;
  if (data.descricao !== undefined) updateData.descricao = data.descricao;
  if (data.sku !== undefined) updateData.sku = data.sku;
  if (imageUrl) updateData.imagem = imageUrl;

  await updateDoc(docRef, updateData);
}

/**
 * Exclui uma estampa (soft delete)
 */
export async function deleteEstampa(id: string): Promise<void> {
  const docRef = doc(db, ESTAMPAS_COLLECTION, id);
  
  await updateDoc(docRef, {
    deletedAt: serverTimestamp(),
  });
}

/**
 * Busca o documento de controle de SKU para estampas
 */
export async function getSkuControlEstampa(): Promise<SkuControlEstampa | null> {
  const docRef = doc(db, SKU_CONTROL_DOC, SKU_CONTROL_ID);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    return null;
  }

  return docSnap.data() as SkuControlEstampa;
}

/**
 * Cria ou atualiza o documento de controle de SKU para estampas
 */
export async function updateSkuControlEstampa(
  familias: Record<string, number>,
  prefixosReservados: Record<string, string>
): Promise<void> {
  const docRef = doc(db, SKU_CONTROL_DOC, SKU_CONTROL_ID);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    await setDoc(docRef, {
      familias,
      prefixosReservados,
    });
  } else {
    await updateDoc(docRef, {
      familias,
      prefixosReservados,
    });
  }
}

// ============================================
// FUNÇÕES DE GERAÇÃO DE SKU POR FAMÍLIA
// ============================================

/**
 * Extrai o nome da família (primeira palavra) do nome da estampa
 * Ex: "Jardim Pink" -> "Jardim"
 */
export function extrairNomeFamiliaEstampa(nome: string): string | null {
  const palavras = nome.trim().split(/\s+/);
  if (palavras.length === 0) {
    return null;
  }
  return palavras[0];
}

/**
 * Gera prefixo de 2 letras a partir do nome da família
 * Ex: "Jardim" -> "JA"
 */
export function gerarPrefixoBaseEstampa(nomeFamilia: string): string {
  return nomeFamilia.substring(0, 2).toUpperCase();
}

/**
 * Gera prefixo alternativo usando 1ª e 3ª letra
 * Ex: "Jardim" -> "JR"
 */
export function gerarPrefixoAlternativoEstampa(nomeFamilia: string): string {
  if (nomeFamilia.length < 3) {
    return nomeFamilia.substring(0, 2).toUpperCase();
  }
  return (nomeFamilia[0] + nomeFamilia[2]).toUpperCase();
}

/**
 * Resolve conflito de prefixo verificando se já existe outro nome de família
 * usando o mesmo prefixo
 */
export function resolverPrefixoEstampa(
  nomeFamilia: string,
  prefixosReservados: Record<string, string>
): string {
  const prefixoBase = gerarPrefixoBaseEstampa(nomeFamilia);
  const familiaExistente = prefixosReservados[prefixoBase];
  
  // Se não existe ou é a mesma família, usa o prefixo base
  if (!familiaExistente || familiaExistente.toLowerCase() === nomeFamilia.toLowerCase()) {
    return prefixoBase;
  }
  
  // Conflito! Usar prefixo alternativo (1ª e 3ª letra)
  return gerarPrefixoAlternativoEstampa(nomeFamilia);
}

/**
 * Gera SKU baseado na família da estampa
 */
export async function gerarSkuPorFamiliaEstampa(nome: string): Promise<{
  sku: string | null;
  prefixo: string | null;
  numero: number | null;
}> {
  const nomeFamilia = extrairNomeFamiliaEstampa(nome);
  if (!nomeFamilia) {
    return { sku: null, prefixo: null, numero: null };
  }
  
  // Buscar controle atual
  let control = await getSkuControlEstampa();
  if (!control) {
    control = {
      familias: {},
      prefixosReservados: {},
    };
  }
  
  // Resolver prefixo (evitando conflitos)
  const prefixo = resolverPrefixoEstampa(nomeFamilia, control.prefixosReservados);
  
  // Incrementar contador da família
  const numeroAtual = control.familias[prefixo] || 0;
  const proximoNumero = numeroAtual + 1;
  
  // Atualizar controle
  const novasFamilias = { ...control.familias, [prefixo]: proximoNumero };
  const novosPrefixos = { ...control.prefixosReservados, [prefixo]: nomeFamilia };
  
  await updateSkuControlEstampa(novasFamilias, novosPrefixos);
  
  // Gerar SKU final
  const sku = `${prefixo}${proximoNumero.toString().padStart(3, '0')}`;
  
  return { sku, prefixo, numero: proximoNumero };
}
