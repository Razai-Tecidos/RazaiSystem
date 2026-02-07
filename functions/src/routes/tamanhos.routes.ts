import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import * as tamanhoService from '../services/tamanho.service';
import { CreateTamanhoData, UpdateTamanhoData } from '../types/tamanho.types';

const router = Router();

/**
 * GET /api/tamanhos
 * Lista todos os tamanhos
 */
router.get('/', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    const tamanhos = await tamanhoService.listTamanhos(includeInactive);
    
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
 * Reordena tamanhos
 * IMPORTANTE: Esta rota deve vir ANTES das rotas com :id
 */
router.post('/reorder', authMiddleware, async (req: Request<object, object, { orderedIds: string[] }>, res: Response): Promise<void> => {
  try {
    const { orderedIds } = req.body;
    
    if (!orderedIds || !Array.isArray(orderedIds) || orderedIds.length === 0) {
      res.status(400).json({
        success: false,
        error: 'Lista de IDs ordenados é obrigatória',
      });
      return;
    }
    
    await tamanhoService.reorderTamanhos(orderedIds);
    
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
 * Busca um tamanho por ID
 */
router.get('/:id', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const tamanho = await tamanhoService.getTamanhoById(id);
    
    if (!tamanho) {
      res.status(404).json({
        success: false,
        error: 'Tamanho não encontrado',
      });
      return;
    }
    
    res.json({
      success: true,
      data: tamanho,
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
 * Cria um novo tamanho
 */
router.post('/', authMiddleware, async (req: Request<object, object, CreateTamanhoData>, res: Response): Promise<void> => {
  try {
    const { nome, descricao, ordem } = req.body;
    
    if (!nome || nome.trim() === '') {
      res.status(400).json({
        success: false,
        error: 'Nome é obrigatório',
      });
      return;
    }
    
    const tamanho = await tamanhoService.createTamanho({
      nome: nome.trim(),
      descricao: descricao?.trim(),
      ordem,
    });
    
    res.status(201).json({
      success: true,
      data: tamanho,
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
 * Atualiza um tamanho
 */
router.put('/:id', authMiddleware, async (req: Request<{ id: string }, object, UpdateTamanhoData>, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { nome, descricao, ordem, ativo } = req.body;
    
    const updateData: UpdateTamanhoData = {};
    
    if (nome !== undefined) {
      if (nome.trim() === '') {
        res.status(400).json({
          success: false,
          error: 'Nome não pode ser vazio',
        });
        return;
      }
      updateData.nome = nome.trim();
    }
    
    if (descricao !== undefined) updateData.descricao = descricao?.trim();
    if (ordem !== undefined) updateData.ordem = ordem;
    if (ativo !== undefined) updateData.ativo = ativo;
    
    const tamanho = await tamanhoService.updateTamanho(id, updateData);
    
    if (!tamanho) {
      res.status(404).json({
        success: false,
        error: 'Tamanho não encontrado',
      });
      return;
    }
    
    res.json({
      success: true,
      data: tamanho,
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
 * DELETE /api/tamanhos/:id
 * Exclui um tamanho (soft delete)
 */
router.delete('/:id', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const deleted = await tamanhoService.deleteTamanho(id);
    
    if (!deleted) {
      res.status(404).json({
        success: false,
        error: 'Tamanho não encontrado',
      });
      return;
    }
    
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
