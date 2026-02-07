import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  orderBy, 
  limit,
  Timestamp,
  where,
  deleteDoc,
  doc
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import { TrainingExample } from '@/types/ml.types';

const COLLECTION_NAME = 'ml_training_examples';

/**
 * Salva um exemplo de treinamento no Firestore
 */
export async function saveTrainingExample(
  example: Omit<TrainingExample, 'id' | 'timestamp'>
): Promise<string> {
  try {
    const docRef = await addDoc(collection(db, COLLECTION_NAME), {
      ...example,
      timestamp: Timestamp.now(),
    });
    return docRef.id;
  } catch (error) {
    console.error('Erro ao salvar exemplo de treinamento:', error);
    throw error;
  }
}

/**
 * Busca exemplos de treinamento do Firestore
 */
export async function getTrainingExamples(
  limitCount: number = 1000
): Promise<TrainingExample[]> {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      orderBy('timestamp', 'desc'),
      limit(limitCount)
    );
    
    const querySnapshot = await getDocs(q);
    const examples: TrainingExample[] = [];
    
    querySnapshot.forEach((doc) => {
      examples.push({
        id: doc.id,
        ...doc.data(),
      } as TrainingExample);
    });
    
    return examples.reverse(); // Mais antigos primeiro para treinamento
  } catch (error) {
    console.error('Erro ao buscar exemplos de treinamento:', error);
    throw error;
  }
}

/**
 * Busca exemplos de treinamento desde uma data específica
 */
export async function getTrainingExamplesSince(
  since: Timestamp,
  limitCount: number = 1000
): Promise<TrainingExample[]> {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('timestamp', '>=', since),
      orderBy('timestamp', 'asc'),
      limit(limitCount)
    );
    
    const querySnapshot = await getDocs(q);
    const examples: TrainingExample[] = [];
    
    querySnapshot.forEach((doc) => {
      examples.push({
        id: doc.id,
        ...doc.data(),
      } as TrainingExample);
    });
    
    return examples;
  } catch (error) {
    console.error('Erro ao buscar exemplos de treinamento desde data:', error);
    throw error;
  }
}

/**
 * Conta o número total de exemplos de treinamento
 */
export async function countTrainingExamples(): Promise<number> {
  try {
    const querySnapshot = await getDocs(collection(db, COLLECTION_NAME));
    return querySnapshot.size;
  } catch (error) {
    console.error('Erro ao contar exemplos de treinamento:', error);
    return 0;
  }
}

/**
 * Busca exemplos de treinamento de uma cor específica
 */
export async function getTrainingExamplesByCorId(corId: string): Promise<TrainingExample[]> {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('corId', '==', corId),
      orderBy('timestamp', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    const examples: TrainingExample[] = [];
    
    querySnapshot.forEach((doc) => {
      examples.push({
        id: doc.id,
        ...doc.data(),
      } as TrainingExample);
    });
    
    return examples;
  } catch (error) {
    console.error('Erro ao buscar exemplos de treinamento por corId:', error);
    return [];
  }
}

/**
 * Remove exemplos de treinamento anteriores de uma cor específica
 * Usado quando uma cor é reeditada para evitar dados conflitantes
 */
export async function deleteTrainingExamplesByCorId(corId: string): Promise<number> {
  try {
    const examples = await getTrainingExamplesByCorId(corId);
    let deletedCount = 0;
    
    for (const example of examples) {
      if (example.id) {
        try {
          await deleteDoc(doc(db, COLLECTION_NAME, example.id));
          deletedCount++;
        } catch (error) {
          console.warn(`Erro ao deletar exemplo ${example.id}:`, error);
        }
      }
    }
    
    return deletedCount;
  } catch (error) {
    console.error('Erro ao deletar exemplos de treinamento por corId:', error);
    return 0;
  }
}
