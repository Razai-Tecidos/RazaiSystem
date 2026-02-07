import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import { Cor, SkuControlCor, CreateCorData, LabColor } from '@/types/cor.types';

const CORES_COLLECTION = 'cores';
const SKU_CONTROL_COR_DOC = 'sku_control_cor';
const SKU_CONTROL_COR_ID = 'main';

/**
 * Verifica se já existe uma cor com o mesmo nome (case-insensitive)
 * @param nome Nome a verificar
 * @param excludeId ID da cor a excluir da verificação (para edição)
 * @returns A cor existente com mesmo nome ou null se não existir
 */
export async function checkNomeDuplicado(
  nome: string,
  excludeId?: string
): Promise<Cor | null> {
  const nomeNormalizado = nome.trim().toLowerCase();
  
  // Ignorar nomes genéricos
  if (nomeNormalizado === 'cor capturada' || nomeNormalizado === '') {
    return null;
  }
  
  const cores = await getCores();
  
  const corDuplicada = cores.find(cor => {
    // Ignorar a própria cor (para edição)
    if (excludeId && cor.id === excludeId) {
      return false;
    }
    return cor.nome.trim().toLowerCase() === nomeNormalizado;
  });
  
  return corDuplicada || null;
}

/**
 * Busca todas as cores cadastradas (não excluídas)
 */
export async function getCores(): Promise<Cor[]> {
  try {
    // Buscar todas as cores e filtrar client-side para evitar problemas
    // com documentos que não têm o campo deletedAt
    const snapshot = await getDocs(collection(db, CORES_COLLECTION));
    
    const cores = snapshot.docs
      .filter((doc) => !doc.data().deletedAt) // Filtrar excluídos client-side
      .map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Cor[];
    
    // Ordenar por data de criação (mais recentes primeiro)
    return cores.sort((a, b) => {
      const aTime = a.createdAt?.toMillis() || 0;
      const bTime = b.createdAt?.toMillis() || 0;
      return bTime - aTime;
    });
  } catch (error: any) {
    console.error('Erro ao carregar cores:', error);
    
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
 * NOTA: Cores agora são independentes de tecidos
 * Use cor-tecido.ts para criar vínculos
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

  if (data.labOriginal) {
    corData.labOriginal = {
      L: data.labOriginal.L,
      a: data.labOriginal.a,
      b: data.labOriginal.b,
    };
  }

  if (data.rgb) {
    corData.rgb = {
      r: data.rgb.r,
      g: data.rgb.g,
      b: data.rgb.b,
    };
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
 * NOTA: imagemTingida e ajustesReinhard agora ficam em cor_tecido
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
  if (data.sku !== undefined) updateData.sku = data.sku;
  if (data.lab !== undefined) {
    updateData.lab = {
      L: data.lab.L,
      a: data.lab.a,
      b: data.lab.b,
    };
  }
  if (data.labOriginal !== undefined) {
    updateData.labOriginal = {
      L: data.labOriginal.L,
      a: data.labOriginal.a,
      b: data.labOriginal.b,
    };
  }
  if (data.rgb !== undefined) {
    updateData.rgb = {
      r: data.rgb.r,
      g: data.rgb.g,
      b: data.rgb.b,
    };
  }

  await updateDoc(docRef, updateData);
}

/**
 * Busca cor por valores LAB similares (usando deltaE)
 * Retorna a cor mais próxima se deltaE < limiar
 */
export async function findCorByLab(
  lab: LabColor,
  limiarDeltaE: number = 3
): Promise<Cor | null> {
  const cores = await getCores();
  
  let corMaisProxima: Cor | null = null;
  let menorDeltaE = Infinity;
  
  for (const cor of cores) {
    if (!cor.lab) continue;
    
    // Calcular deltaE simples (CIE76)
    const deltaL = cor.lab.L - lab.L;
    const deltaA = cor.lab.a - lab.a;
    const deltaB = cor.lab.b - lab.b;
    const deltaE = Math.sqrt(deltaL * deltaL + deltaA * deltaA + deltaB * deltaB);
    
    if (deltaE < menorDeltaE && deltaE < limiarDeltaE) {
      menorDeltaE = deltaE;
      corMaisProxima = cor;
    }
  }
  
  return corMaisProxima;
}

/**
 * Busca cores similares por LAB
 * Retorna lista de cores com deltaE menor que o limiar
 */
export async function findCoresSimilares(
  lab: LabColor,
  limiarDeltaE: number = 5
): Promise<Array<{ cor: Cor; deltaE: number }>> {
  const cores = await getCores();
  const similares: Array<{ cor: Cor; deltaE: number }> = [];
  
  for (const cor of cores) {
    if (!cor.lab) continue;
    
    // Calcular deltaE simples (CIE76)
    const deltaL = cor.lab.L - lab.L;
    const deltaA = cor.lab.a - lab.a;
    const deltaB = cor.lab.b - lab.b;
    const deltaE = Math.sqrt(deltaL * deltaL + deltaA * deltaA + deltaB * deltaB);
    
    if (deltaE < limiarDeltaE) {
      similares.push({ cor, deltaE });
    }
  }
  
  // Ordenar por deltaE (mais similar primeiro)
  return similares.sort((a, b) => a.deltaE - b.deltaE);
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
  
  // Garantir que o controle e seus campos existam
  const familias = control?.familias || {};
  const prefixosReservados = control?.prefixosReservados || {};
  
  // Resolver prefixo (evitando conflitos)
  const prefixo = resolverPrefixo(nomeFamilia, prefixosReservados);
  
  // Incrementar contador da família
  const numeroAtual = familias[prefixo] || 0;
  const proximoNumero = numeroAtual + 1;
  
  // Atualizar controle
  const novasFamilias = { ...familias, [prefixo]: proximoNumero };
  const novosPrefixos = { ...prefixosReservados, [prefixo]: nomeFamilia };
  
  await updateSkuControlCor(novasFamilias, novosPrefixos);
  
  // Gerar SKU final
  const sku = `${prefixo}${proximoNumero.toString().padStart(3, '0')}`;
  
  return { sku, prefixo, numero: proximoNumero };
}
