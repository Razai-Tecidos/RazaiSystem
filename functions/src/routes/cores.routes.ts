import { Router, Request, Response } from 'express';
import admin from '../config/firebase';
import { authMiddleware } from '../middleware/auth.middleware';
import { CreateCorRequest, UpdateCorRequest } from '../types/cor.types';

const router = Router();
const db = admin.firestore();

/**
 * GET /api/cores
 * Lista todas as cores não excluídas
 */
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const snapshot = await db
      .collection('cores')
      .where('deletedAt', '==', null)
      .orderBy('createdAt', 'desc')
      .get();

    const cores = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return res.json({
      success: true,
      data: cores,
    });
  } catch (error: any) {
    console.error('Erro ao buscar cores:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro ao buscar cores',
    });
  }
});

/**
 * GET /api/cores/:id
 * Busca uma cor específica
 */
router.get('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const doc = await db.collection('cores').doc(id).get();

    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Cor não encontrada',
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
    console.error('Erro ao buscar cor:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro ao buscar cor',
    });
  }
});

/**
 * POST /api/cores
 * Cria uma nova cor
 */
router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const data: CreateCorRequest = req.body;

    // Validações básicas
    if (!data.nome) {
      return res.status(400).json({
        success: false,
        error: 'Nome é obrigatório',
      });
    }

    // Validar código hexadecimal se fornecido
    if (data.codigoHex && !/^#[0-9A-F]{6}$/i.test(data.codigoHex)) {
      return res.status(400).json({
        success: false,
        error: 'Código hexadecimal inválido. Use o formato #RRGGBB',
      });
    }

    const corData = {
      ...data,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      deletedAt: null,
    };

    const docRef = await db.collection('cores').add(corData);
    const createdDoc = await docRef.get();

    return res.status(201).json({
      success: true,
      data: {
        id: createdDoc.id,
        ...createdDoc.data(),
      },
    });
  } catch (error: any) {
    console.error('Erro ao criar cor:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro ao criar cor',
    });
  }
});

/**
 * PUT /api/cores/:id
 * Atualiza uma cor existente
 */
router.put('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data: UpdateCorRequest = req.body;

    const docRef = db.collection('cores').doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Cor não encontrada',
      });
    }

    // Validar código hexadecimal se fornecido
    if (data.codigoHex && !/^#[0-9A-F]{6}$/i.test(data.codigoHex)) {
      return res.status(400).json({
        success: false,
        error: 'Código hexadecimal inválido. Use o formato #RRGGBB',
      });
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
    console.error('Erro ao atualizar cor:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro ao atualizar cor',
    });
  }
});

/**
 * DELETE /api/cores/:id
 * Exclui uma cor (soft delete)
 */
router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const docRef = db.collection('cores').doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Cor não encontrada',
      });
    }

    // Soft delete
    await docRef.update({
      deletedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.json({
      success: true,
      message: 'Cor excluída com sucesso',
    });
  } catch (error: any) {
    console.error('Erro ao excluir cor:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro ao excluir cor',
    });
  }
});

export default router;
