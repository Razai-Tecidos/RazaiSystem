import { Router, Request, Response } from 'express';
import admin from '../config/firebase';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();
const db = admin.firestore();
const COLLECTION = 'tamanhos';

function isDeleted(value: unknown): boolean {
  return value !== null && value !== undefined;
}

function toOrder(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
}

/**
 * GET /api/tamanhos
 * Lista tamanhos (ativos por padrão)
 */
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    const snapshot = await db.collection(COLLECTION).get();

    const tamanhos = snapshot.docs
      .map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))
      .filter((tamanho: any) => {
        if (isDeleted(tamanho.deletedAt)) return false;
        if (includeInactive) return true;
        return tamanho.ativo !== false;
      })
      .sort((a: any, b: any) => {
        const orderDiff = toOrder(a.ordem) - toOrder(b.ordem);
        if (orderDiff !== 0) return orderDiff;
        return String(a.nome || '').localeCompare(String(b.nome || ''));
      });

    res.json({
      success: true,
      data: tamanhos,
    });
  } catch (error: any) {
    console.error('Erro ao listar tamanhos:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao listar tamanhos',
    });
  }
});

/**
 * POST /api/tamanhos/reorder
 */
router.post('/reorder', authMiddleware, async (req: Request, res: Response) => {
  try {
    const orderedIds = req.body?.orderedIds as string[] | undefined;

    if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Lista de IDs ordenados é obrigatória',
      });
    }

    const batch = db.batch();
    const now = admin.firestore.FieldValue.serverTimestamp();

    orderedIds.forEach((id, index) => {
      const ref = db.collection(COLLECTION).doc(id);
      batch.update(ref, {
        ordem: index + 1,
        updatedAt: now,
      });
    });

    await batch.commit();

    res.json({
      success: true,
      message: 'Tamanhos reordenados com sucesso',
    });
  } catch (error: any) {
    console.error('Erro ao reordenar tamanhos:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao reordenar tamanhos',
    });
  }
});

/**
 * GET /api/tamanhos/:id
 */
router.get('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const doc = await db.collection(COLLECTION).doc(id).get();

    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Tamanho não encontrado',
      });
    }

    const data = doc.data();
    if (isDeleted(data?.deletedAt)) {
      return res.status(404).json({
        success: false,
        error: 'Tamanho não encontrado',
      });
    }

    res.json({
      success: true,
      data: {
        id: doc.id,
        ...data,
      },
    });
  } catch (error: any) {
    console.error('Erro ao buscar tamanho:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao buscar tamanho',
    });
  }
});

/**
 * POST /api/tamanhos
 */
router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const nome = String(req.body?.nome || '').trim();
    const descricao = typeof req.body?.descricao === 'string' ? req.body.descricao.trim() : undefined;
    const ordemInput = req.body?.ordem;

    if (!nome) {
      return res.status(400).json({
        success: false,
        error: 'Nome é obrigatório',
      });
    }

    const snapshot = await db.collection(COLLECTION).get();
    const highestOrder = snapshot.docs.reduce((max, doc) => {
      const data = doc.data() as Record<string, unknown>;
      if (isDeleted(data.deletedAt)) return max;
      return Math.max(max, toOrder(data.ordem));
    }, 0);

    const ordem = Number.isFinite(Number(ordemInput)) ? Number(ordemInput) : highestOrder + 1;
    const now = admin.firestore.FieldValue.serverTimestamp();

    const payload: Record<string, unknown> = {
      nome,
      ordem,
      ativo: true,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    if (descricao) {
      payload.descricao = descricao;
    }

    const ref = await db.collection(COLLECTION).add(payload);
    const created = await ref.get();

    res.status(201).json({
      success: true,
      data: {
        id: created.id,
        ...created.data(),
      },
    });
  } catch (error: any) {
    console.error('Erro ao criar tamanho:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao criar tamanho',
    });
  }
});

/**
 * PUT /api/tamanhos/:id
 */
router.put('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const ref = db.collection(COLLECTION).doc(id);
    const doc = await ref.get();

    if (!doc.exists || isDeleted(doc.data()?.deletedAt)) {
      return res.status(404).json({
        success: false,
        error: 'Tamanho não encontrado',
      });
    }

    const updateData: Record<string, unknown> = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (req.body?.nome !== undefined) {
      const nome = String(req.body.nome).trim();
      if (!nome) {
        return res.status(400).json({
          success: false,
          error: 'Nome não pode ser vazio',
        });
      }
      updateData.nome = nome;
    }

    if (req.body?.descricao !== undefined) {
      const descricao = req.body.descricao;
      if (descricao === null || String(descricao).trim() === '') {
        updateData.descricao = admin.firestore.FieldValue.delete();
      } else {
        updateData.descricao = String(descricao).trim();
      }
    }

    if (req.body?.ordem !== undefined) {
      const ordem = Number(req.body.ordem);
      if (!Number.isFinite(ordem)) {
        return res.status(400).json({
          success: false,
          error: 'Ordem inválida',
        });
      }
      updateData.ordem = ordem;
    }

    if (req.body?.ativo !== undefined) {
      updateData.ativo = Boolean(req.body.ativo);
    }

    await ref.update(updateData);
    const updated = await ref.get();

    res.json({
      success: true,
      data: {
        id: updated.id,
        ...updated.data(),
      },
    });
  } catch (error: any) {
    console.error('Erro ao atualizar tamanho:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao atualizar tamanho',
    });
  }
});

/**
 * DELETE /api/tamanhos/:id (soft delete)
 */
router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const ref = db.collection(COLLECTION).doc(id);
    const doc = await ref.get();

    if (!doc.exists || isDeleted(doc.data()?.deletedAt)) {
      return res.status(404).json({
        success: false,
        error: 'Tamanho não encontrado',
      });
    }

    await ref.update({
      deletedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      ativo: false,
    });

    res.json({
      success: true,
      message: 'Tamanho excluído com sucesso',
    });
  } catch (error: any) {
    console.error('Erro ao excluir tamanho:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao excluir tamanho',
    });
  }
});

export default router;

