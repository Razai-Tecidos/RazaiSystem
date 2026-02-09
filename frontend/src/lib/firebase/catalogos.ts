import {
  collection,
  doc,
  getDoc,
  addDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { auth, db } from '@/config/firebase';
import { Tecido } from '@/types/tecido.types';
import { CorTecido } from '@/types/cor.types';

const CATALOGOS_COLLECTION = 'catalogos';

// Tempo de expiração em dias
const EXPIRATION_DAYS = 7;

export interface Catalogo {
  id: string;
  tecidoIds: string[];
  createdAt: Timestamp;
  expiresAt: Timestamp;
  createdBy: string;
}

export interface CreateCatalogoData {
  tecidoIds: string[];
}

/**
 * Cria um novo catálogo com link temporário
 * O catálogo expira após 7 dias
 */
export async function createCatalogo(data: CreateCatalogoData): Promise<Catalogo> {
  // Verificar se usuário está autenticado
  if (!auth.currentUser) {
    throw new Error('Usuário não autenticado. Faça login para continuar.');
  }

  // Calcular data de expiração (7 dias a partir de agora)
  const now = new Date();
  const expiresAt = new Date(now.getTime() + EXPIRATION_DAYS * 24 * 60 * 60 * 1000);

  const catalogoData = {
    tecidoIds: data.tecidoIds,
    createdAt: serverTimestamp(),
    expiresAt: Timestamp.fromDate(expiresAt),
    createdBy: auth.currentUser.uid,
  };

  const docRef = await addDoc(collection(db, CATALOGOS_COLLECTION), catalogoData);
  const createdDoc = await getDoc(docRef);

  return {
    id: createdDoc.id,
    ...createdDoc.data(),
  } as Catalogo;
}

/**
 * Busca um catálogo por ID
 * Retorna null se não existir ou se estiver expirado
 */
export async function getCatalogoById(id: string): Promise<Catalogo | null> {
  try {
    const docRef = doc(db, CATALOGOS_COLLECTION, id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    const data = docSnap.data();
    const catalogo = {
      id: docSnap.id,
      ...data,
    } as Catalogo;

    // Verificar se o catálogo expirou
    const now = new Date();
    const expiresAt = catalogo.expiresAt.toDate();
    
    if (now > expiresAt) {
      return null; // Catálogo expirado
    }

    return catalogo;
  } catch (error) {
    console.error('Erro ao buscar catálogo:', error);
    return null;
  }
}

/**
 * Verifica se um catálogo existe e está válido (não expirado)
 */
export async function isCatalogoValid(id: string): Promise<boolean> {
  const catalogo = await getCatalogoById(id);
  return catalogo !== null;
}

/**
 * Gera a URL compartilhável do catálogo
 */
export function getCatalogoUrl(catalogoId: string): string {
  const baseUrl = window.location.origin;
  return `${baseUrl}?catalogo=${catalogoId}`;
}

/**
 * Calcula quantos dias restam até a expiração
 */
export function getDaysUntilExpiration(catalogo: Catalogo): number {
  const now = new Date();
  const expiresAt = catalogo.expiresAt.toDate();
  const diffMs = expiresAt.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
  return Math.max(0, diffDays);
}

/**
 * Tipo para agrupar vínculos por tecido
 */
export interface TecidoComVinculos {
  tecido: Tecido;
  vinculos: CorTecido[];
}

/**
 * Agrupa vínculos (cores) por tecido
 * Filtra apenas vínculos com imagem tingida e ordena por nome da cor
 * Reutilizado em Catalogo.tsx e useCatalogos.ts
 */
export function agruparVinculosPorTecido(
  vinculos: CorTecido[],
  tecidos: Tecido[]
): TecidoComVinculos[] {
  const grupos: TecidoComVinculos[] = [];

  // Agrupar vínculos por tecidoId
  const vinculosPorTecido = new Map<string, CorTecido[]>();
  vinculos.forEach((vinculo) => {
    if (!vinculo.imagemTingida) return; // Ignorar vínculos sem imagem

    const lista = vinculosPorTecido.get(vinculo.tecidoId) || [];
    lista.push(vinculo);
    vinculosPorTecido.set(vinculo.tecidoId, lista);
  });

  // Criar grupos com dados do tecido
  tecidos.forEach((tecido) => {
    const vinculosDoTecido = vinculosPorTecido.get(tecido.id);
    if (vinculosDoTecido && vinculosDoTecido.length > 0) {
      grupos.push({
        tecido,
        vinculos: vinculosDoTecido.sort((a, b) =>
          (a.corNome || '').localeCompare(b.corNome || '')
        ),
      });
    }
  });

  return grupos.sort((a, b) => a.tecido.nome.localeCompare(b.tecido.nome));
}
