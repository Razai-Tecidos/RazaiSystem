import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import * as templateService from '../services/shopee-template.service';
import { CreateShopeeTemplateData } from '../types/shopee-template.types';

const router = Router();

/**
 * GET /api/shopee/templates
 * Lista templates do usuário
 */
router.get('/', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.uid;
    
    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'Usuário não autenticado',
      });
      return;
    }
    
    const templates = await templateService.listTemplates(userId);
    
    res.json({
      success: true,
      data: templates,
    });
  } catch (error: any) {
    console.error('Erro ao listar templates:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao listar templates',
    });
  }
});

/**
 * GET /api/shopee/templates/:id
 * Busca um template por ID
 */
router.get('/:id', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const template = await templateService.getTemplateById(id);
    
    if (!template) {
      res.status(404).json({
        success: false,
        error: 'Template não encontrado',
      });
      return;
    }
    
    res.json({
      success: true,
      data: template,
    });
  } catch (error: any) {
    console.error('Erro ao buscar template:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao buscar template',
    });
  }
});

/**
 * POST /api/shopee/templates
 * Cria um novo template
 */
router.post('/', authMiddleware, async (req: Request<object, object, CreateShopeeTemplateData>, res: Response): Promise<void> => {
  try {
    const userId = req.user?.uid;
    
    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'Usuário não autenticado',
      });
      return;
    }
    
    const { nome } = req.body;
    
    if (!nome || nome.trim() === '') {
      res.status(400).json({
        success: false,
        error: 'Nome é obrigatório',
      });
      return;
    }
    
    const template = await templateService.createTemplate(userId, req.body);
    
    res.status(201).json({
      success: true,
      data: template,
    });
  } catch (error: any) {
    console.error('Erro ao criar template:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao criar template',
    });
  }
});

/**
 * PUT /api/shopee/templates/:id
 * Atualiza um template
 */
router.put('/:id', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.uid;
    const { id } = req.params;
    
    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'Usuário não autenticado',
      });
      return;
    }
    
    const template = await templateService.updateTemplate(id, userId, req.body);
    
    if (!template) {
      res.status(404).json({
        success: false,
        error: 'Template não encontrado',
      });
      return;
    }
    
    res.json({
      success: true,
      data: template,
    });
  } catch (error: any) {
    console.error('Erro ao atualizar template:', error);
    
    if (error.message.includes('permissão')) {
      res.status(403).json({
        success: false,
        error: error.message,
      });
      return;
    }
    
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao atualizar template',
    });
  }
});

/**
 * DELETE /api/shopee/templates/:id
 * Exclui um template
 */
router.delete('/:id', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.uid;
    const { id } = req.params;
    
    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'Usuário não autenticado',
      });
      return;
    }
    
    const deleted = await templateService.deleteTemplate(id, userId);
    
    if (!deleted) {
      res.status(404).json({
        success: false,
        error: 'Template não encontrado',
      });
      return;
    }
    
    res.json({
      success: true,
      message: 'Template excluído com sucesso',
    });
  } catch (error: any) {
    console.error('Erro ao excluir template:', error);
    
    if (error.message.includes('permissão')) {
      res.status(403).json({
        success: false,
        error: error.message,
      });
      return;
    }
    
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao excluir template',
    });
  }
});

export default router;
