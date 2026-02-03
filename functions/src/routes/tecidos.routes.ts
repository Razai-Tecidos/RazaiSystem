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
 * Busca um tecido específico
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

    return res.json({
      success: true,
      data: {
        id: doc.id,
        ...doc.data(),
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
    if (!data.nome || !data.largura || !data.composicao || !data.imagemPadrao) {
      return res.status(400).json({
        success: false,
        error: 'Campos obrigatórios: nome, largura, composicao, imagemPadrao',
      });
    }

    if (data.composicao.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Composição deve ter pelo menos um item',
      });
    }

    const somaPorcentagem = data.composicao.reduce(
      (sum, item) => sum + item.porcentagem,
      0
    );

    if (somaPorcentagem !== 100) {
      return res.status(400).json({
        success: false,
        error: `A soma das porcentagens deve ser 100% (atual: ${somaPorcentagem}%)`,
      });
    }

    const tecidoData = {
      ...data,
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
      error: 'Erro ao criar tecido',
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

    // Validar composição se fornecida
    if (data.composicao) {
      const somaPorcentagem = data.composicao.reduce(
        (sum, item) => sum + item.porcentagem,
        0
      );

      if (somaPorcentagem !== 100) {
        return res.status(400).json({
          success: false,
          error: `A soma das porcentagens deve ser 100% (atual: ${somaPorcentagem}%)`,
        });
      }
    }

    const updateData = {
      ...data,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

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
      error: 'Erro ao atualizar tecido',
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
      error: 'Erro ao excluir tecido',
    });
  }
});

export default router;
