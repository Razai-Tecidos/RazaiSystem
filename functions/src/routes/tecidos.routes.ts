import { Router, Request, Response } from 'express';
import admin from '../config/firebase';
import { authMiddleware } from '../middleware/auth.middleware';
import { CreateTecidoRequest, UpdateTecidoRequest } from '../types/tecido.types';

const router = Router();
const db = admin.firestore();

/**
 * GET /api/tecidos
 * Lista todos os tecidos não excluídos
 */
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const snapshot = await db
      .collection('tecidos')
      .where('deletedAt', '==', null)
      .orderBy('createdAt', 'desc')
      .get();

    const tecidos = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return res.json({
      success: true,
      data: tecidos,
    });
  } catch (error: any) {
    console.error('Erro ao buscar tecidos:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro ao buscar tecidos',
    });
  }
});

/**
 * GET /api/tecidos/:id
 * Busca um tecido específico (ignora soft-deleted)
 */
router.get('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const doc = await db.collection('tecidos').doc(id).get();

    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Tecido não encontrado',
      });
    }

    // Verificar soft-delete
    const data = doc.data();
    if (data?.deletedAt) {
      return res.status(404).json({
        success: false,
        error: 'Tecido não encontrado',
      });
    }

    return res.json({
      success: true,
      data: {
        id: doc.id,
        ...data,
      },
    });
  } catch (error: any) {
    console.error('Erro ao buscar tecido:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro ao buscar tecido',
    });
  }
});

/**
 * POST /api/tecidos
 * Cria um novo tecido
 */
router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const data: CreateTecidoRequest = req.body;

    // Validações básicas
    if (!data.nome?.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Nome é obrigatório',
      });
    }

    if (data.nome.trim().length < 3) {
      return res.status(400).json({
        success: false,
        error: 'Nome deve ter pelo menos 3 caracteres',
      });
    }

    if (!data.largura || typeof data.largura !== 'number' || data.largura <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Largura deve ser um número positivo',
      });
    }

    if (!data.composicao?.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Composição é obrigatória',
      });
    }

    const tipo = data.tipo || 'liso';

    // Imagem obrigatória apenas para tecidos lisos
    if (tipo === 'liso' && !data.imagemPadrao) {
      return res.status(400).json({
        success: false,
        error: 'Imagem é obrigatória para tecidos lisos',
      });
    }

    const tecidoData = {
      nome: data.nome.trim(),
      tipo,
      largura: data.largura,
      composicao: data.composicao.trim(),
      imagemPadrao: data.imagemPadrao || '',
      descricao: data.descricao?.trim() || '',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      deletedAt: null,
    };

    const docRef = await db.collection('tecidos').add(tecidoData);
    const createdDoc = await docRef.get();

    return res.status(201).json({
      success: true,
      data: {
        id: createdDoc.id,
        ...createdDoc.data(),
      },
    });
  } catch (error: any) {
    console.error('Erro ao criar tecido:', error);
    return res.status(500).json({
      success: false,
      error: `Erro ao criar tecido: ${error.message || 'erro desconhecido'}`,
    });
  }
});

/**
 * PUT /api/tecidos/:id
 * Atualiza um tecido existente
 */
router.put('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data: UpdateTecidoRequest = req.body;

    const docRef = db.collection('tecidos').doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Tecido não encontrado',
      });
    }

    // Verificar soft-delete
    if (doc.data()?.deletedAt) {
      return res.status(404).json({
        success: false,
        error: 'Tecido não encontrado',
      });
    }

    // Validações condicionais
    if (data.nome !== undefined && (!data.nome.trim() || data.nome.trim().length < 3)) {
      return res.status(400).json({
        success: false,
        error: 'Nome deve ter pelo menos 3 caracteres',
      });
    }

    if (data.largura !== undefined && (typeof data.largura !== 'number' || data.largura <= 0)) {
      return res.status(400).json({
        success: false,
        error: 'Largura deve ser um número positivo',
      });
    }

    if (data.composicao !== undefined && !data.composicao.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Composição não pode ser vazia',
      });
    }

    const updateData: Record<string, unknown> = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (data.nome !== undefined) updateData.nome = data.nome.trim();
    if (data.tipo !== undefined) updateData.tipo = data.tipo;
    if (data.largura !== undefined) updateData.largura = data.largura;
    if (data.composicao !== undefined) updateData.composicao = data.composicao.trim();
    if (data.imagemPadrao !== undefined) updateData.imagemPadrao = data.imagemPadrao;
    if (data.descricao !== undefined) updateData.descricao = data.descricao.trim();

    await docRef.update(updateData);
    const updatedDoc = await docRef.get();

    return res.json({
      success: true,
      data: {
        id: updatedDoc.id,
        ...updatedDoc.data(),
      },
    });
  } catch (error: any) {
    console.error('Erro ao atualizar tecido:', error);
    return res.status(500).json({
      success: false,
      error: `Erro ao atualizar tecido: ${error.message || 'erro desconhecido'}`,
    });
  }
});

/**
 * DELETE /api/tecidos/:id
 * Exclui um tecido (soft delete)
 */
router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const docRef = db.collection('tecidos').doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Tecido não encontrado',
      });
    }

    // Verificar se já foi excluído
    if (doc.data()?.deletedAt) {
      return res.status(404).json({
        success: false,
        error: 'Tecido já foi excluído',
      });
    }

    // Soft delete
    await docRef.update({
      deletedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.json({
      success: true,
      message: 'Tecido excluído com sucesso',
    });
  } catch (error: any) {
    console.error('Erro ao excluir tecido:', error);
    return res.status(500).json({
      success: false,
      error: `Erro ao excluir tecido: ${error.message || 'erro desconhecido'}`,
    });
  }
});

export default router;
