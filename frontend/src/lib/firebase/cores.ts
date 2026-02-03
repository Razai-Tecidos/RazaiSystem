import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import { Cor, SkuControlCor, CreateCorData } from '@/types/cor.types';

const CORES_COLLECTION = 'cores';
const SKU_CONTROL_COR_DOC = 'sku_control_cor';
const SKU_CONTROL_COR_ID = 'main';

/**
 * Busca todas as cores cadastradas (não excluídas)
 */
export async function getCores(): Promise<Cor[]> {
  try {
    const q = query(
      collection(db, CORES_COLLECTION),
      where('deletedAt', '==', null),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Cor[];
  } catch (error: any) {
    // Se erro de índice, tentar sem orderBy
    if (error.code === 'failed-precondition') {
      // Fallback silencioso: busca sem ordenação e ordena manualmente
      // O índice composto pode ser criado no Firebase Console se necessário
      try {
        const q = query(
          collection(db, CORES_COLLECTION),
          where('deletedAt', '==', null)
        );
        const snapshot = await getDocs(q);
        const cores = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Cor[];
        // Ordenar manualmente
        return cores.sort((a, b) => {
          const aTime = a.createdAt?.toMillis() || 0;
          const bTime = b.createdAt?.toMillis() || 0;
          return bTime - aTime;
        });
      } catch (fallbackError: any) {
        // Se ainda falhar, tentar buscar sem filtro de deletedAt
        // (para casos onde a coleção ainda não tem documentos)
        try {
          const q = query(
            collection(db, CORES_COLLECTION),
            orderBy('createdAt', 'desc')
          );
          const snapshot = await getDocs(q);
          return snapshot.docs
            .filter((doc) => !doc.data().deletedAt)
            .map((doc) => ({
              id: doc.id,
              ...doc.data(),
            })) as Cor[];
        } catch (finalError: any) {
          // Último recurso: buscar tudo sem filtros nem ordenação
          if (finalError.code === 'failed-precondition' || finalError.code === 'unavailable') {
            const snapshot = await getDocs(collection(db, CORES_COLLECTION));
            return snapshot.docs
              .filter((doc) => !doc.data().deletedAt)
              .map((doc) => ({
                id: doc.id,
                ...doc.data(),
              })) as Cor[];
          }
          throw finalError;
        }
      }
    }
    
    // Se erro de permissão ou coleção não existe, retornar array vazio
    if (error.code === 'permission-denied' || error.code === 'not-found') {
      console.warn('Permissão negada ou coleção não encontrada. Retornando lista vazia.');
      return [];
    }
    
    throw error;
  }
}

/**
 * Busca uma cor específica por ID
 */
export async function getCorById(id: string): Promise<Cor | null> {
  const docRef = doc(db, CORES_COLLECTION, id);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    return null;
  }

  return {
    id: docSnap.id,
    ...docSnap.data(),
  } as Cor;
}

/**
 * Cria uma nova cor no Firestore
 */
export async function createCor(
  data: CreateCorData,
  sku: string | null
): Promise<Cor> {
  const corData: any = {
    nome: data.nome,
    codigoHex: data.codigoHex || '',
    sku: sku || null, // Pode ser null se nome for "Cor capturada"
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    deletedAt: null,
  };

  // Adicionar campos opcionais se existirem
  if (data.lab) {
    corData.lab = {
      L: data.lab.L,
      a: data.lab.a,
      b: data.lab.b,
    };
  }

  if (data.rgb) {
    corData.rgb = {
      r: data.rgb.r,
      g: data.rgb.g,
      b: data.rgb.b,
    };
  }

  if (data.tecidoId) {
    corData.tecidoId = data.tecidoId;
  }

  if (data.tecidoNome) {
    corData.tecidoNome = data.tecidoNome;
  }

  if (data.tecidoSku) {
    corData.tecidoSku = data.tecidoSku;
  }

  if (data.imagemTingida) {
    corData.imagemTingida = data.imagemTingida;
  }

  const docRef = await addDoc(collection(db, CORES_COLLECTION), corData);
  const createdDoc = await getDoc(docRef);

  return {
    id: createdDoc.id,
    ...createdDoc.data(),
  } as Cor;
}

/**
 * Atualiza uma cor existente
 */
export async function updateCor(
  id: string,
  data: Partial<CreateCorData> & { sku?: string | null }
): Promise<void> {
  const docRef = doc(db, CORES_COLLECTION, id);
  const updateData: any = {
    updatedAt: serverTimestamp(),
  };

  if (data.nome !== undefined) updateData.nome = data.nome;
  if (data.codigoHex !== undefined) updateData.codigoHex = data.codigoHex;
  if (data.imagemTingida !== undefined) updateData.imagemTingida = data.imagemTingida;
  if (data.sku !== undefined) updateData.sku = data.sku;

  await updateDoc(docRef, updateData);
}

/**
 * Exclui uma cor (soft delete - marca deletedAt)
 */
export async function deleteCor(id: string): Promise<void> {
  const docRef = doc(db, CORES_COLLECTION, id);
  
  // Soft delete - marca como excluído
  await updateDoc(docRef, {
    deletedAt: serverTimestamp(),
  });
}

/**
 * Busca o documento de controle de SKU de cores
 */
export async function getSkuControlCor(): Promise<SkuControlCor | null> {
  const docRef = doc(db, SKU_CONTROL_COR_DOC, SKU_CONTROL_COR_ID);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    return null;
  }

  return docSnap.data() as SkuControlCor;
}

/**
 * Cria ou atualiza o documento de controle de SKU de cores
 */
export async function updateSkuControlCor(
  familias: Record<string, number>,
  prefixosReservados: Record<string, string>
): Promise<void> {
  const docRef = doc(db, SKU_CONTROL_COR_DOC, SKU_CONTROL_COR_ID);
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
 * Verifica se o nome é o padrão "Cor capturada XX:XX:XX"
 */
export function isNomePadrao(nome: string): boolean {
  return /^Cor capturada/i.test(nome.trim());
}

/**
 * Extrai o nome da família (primeira palavra) do nome da cor
 * Ex: "Verde Floresta" -> "Verde"
 */
export function extrairNomeFamilia(nome: string): string | null {
  const palavras = nome.trim().split(/\s+/);
  if (palavras.length === 0 || isNomePadrao(nome)) {
    return null;
  }
  return palavras[0];
}

/**
 * Gera prefixo de 2 letras a partir do nome da família
 * Ex: "Verde" -> "VE"
 */
export function gerarPrefixoBase(nomeFamilia: string): string {
  return nomeFamilia.substring(0, 2).toUpperCase();
}

/**
 * Gera prefixo alternativo usando 1ª e 3ª letra
 * Ex: "Vermelho" -> "VM"
 */
export function gerarPrefixoAlternativo(nomeFamilia: string): string {
  if (nomeFamilia.length < 3) {
    // Se não tem 3 letras, usa as 2 primeiras
    return nomeFamilia.substring(0, 2).toUpperCase();
  }
  return (nomeFamilia[0] + nomeFamilia[2]).toUpperCase();
}

/**
 * Resolve conflito de prefixo verificando se já existe outro nome de família
 * usando o mesmo prefixo
 */
export function resolverPrefixo(
  nomeFamilia: string,
  prefixosReservados: Record<string, string>
): string {
  const prefixoBase = gerarPrefixoBase(nomeFamilia);
  const familiaExistente = prefixosReservados[prefixoBase];
  
  // Se não existe ou é a mesma família, usa o prefixo base
  if (!familiaExistente || familiaExistente.toLowerCase() === nomeFamilia.toLowerCase()) {
    return prefixoBase;
  }
  
  // Conflito! Usar prefixo alternativo (1ª e 3ª letra)
  return gerarPrefixoAlternativo(nomeFamilia);
}

/**
 * Gera SKU baseado na família da cor
 * Retorna null se o nome for padrão "Cor capturada"
 */
export async function gerarSkuPorFamilia(nome: string): Promise<{
  sku: string | null;
  prefixo: string | null;
  numero: number | null;
}> {
  // Se nome é padrão, não gera SKU
  if (isNomePadrao(nome)) {
    return { sku: null, prefixo: null, numero: null };
  }
  
  const nomeFamilia = extrairNomeFamilia(nome);
  if (!nomeFamilia) {
    return { sku: null, prefixo: null, numero: null };
  }
  
  // Buscar controle atual
  let control = await getSkuControlCor();
  if (!control) {
    control = {
      familias: {},
      prefixosReservados: {},
    };
  }
  
  // Resolver prefixo (evitando conflitos)
  const prefixo = resolverPrefixo(nomeFamilia, control.prefixosReservados);
  
  // Incrementar contador da família
  const numeroAtual = control.familias[prefixo] || 0;
  const proximoNumero = numeroAtual + 1;
  
  // Atualizar controle
  const novasFamilias = { ...control.familias, [prefixo]: proximoNumero };
  const novosPrefixos = { ...control.prefixosReservados, [prefixo]: nomeFamilia };
  
  await updateSkuControlCor(novasFamilias, novosPrefixos);
  
  // Gerar SKU final
  const sku = `${prefixo}${proximoNumero.toString().padStart(3, '0')}`;
  
  return { sku, prefixo, numero: proximoNumero };
}
