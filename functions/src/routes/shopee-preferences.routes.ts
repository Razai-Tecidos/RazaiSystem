import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import * as preferencesService from '../services/shopee-preferences.service';
import { UpdateShopeePreferencesData } from '../types/shopee-preferences.types';

const router = Router();

/**
 * GET /api/shopee/preferences
 * Busca preferências do usuário
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
    
    const preferences = await preferencesService.getUserPreferences(userId);
    
    res.json({
      success: true,
      data: preferences,
    });
  } catch (error: any) {
    console.error('Erro ao buscar preferências:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao buscar preferências',
    });
  }
});

/**
 * GET /api/shopee/preferences/defaults
 * Busca valores padrão combinados (preferências + sistema)
 */
router.get('/defaults', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.uid;
    const tecidoLargura = req.query.tecido_largura 
      ? parseFloat(req.query.tecido_largura as string) 
      : undefined;
    
    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'Usuário não autenticado',
      });
      return;
    }
    
    const defaults = await preferencesService.getDefaultValues(userId, tecidoLargura);
    
    res.json({
      success: true,
      data: defaults,
    });
  } catch (error: any) {
    console.error('Erro ao buscar valores padrão:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao buscar valores padrão',
    });
  }
});

/**
 * PUT /api/shopee/preferences
 * Atualiza preferências do usuário
 */
router.put('/', authMiddleware, async (req: Request<object, object, UpdateShopeePreferencesData>, res: Response): Promise<void> => {
  try {
    const userId = req.user?.uid;
    
    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'Usuário não autenticado',
      });
      return;
    }
    
    const {
      preco_base_padrao,
      estoque_padrao_padrao,
      categoria_id_padrao,
      peso_padrao,
      dimensoes_padrao,
      usar_imagens_publicas_padrao,
      descricao_template,
    } = req.body;
    
    // Validações básicas
    if (preco_base_padrao !== undefined && preco_base_padrao < 0) {
      res.status(400).json({
        success: false,
        error: 'Preço base padrão deve ser maior ou igual a zero',
      });
      return;
    }
    
    if (estoque_padrao_padrao !== undefined && estoque_padrao_padrao < 0) {
      res.status(400).json({
        success: false,
        error: 'Estoque padrão deve ser maior ou igual a zero',
      });
      return;
    }
    
    if (peso_padrao !== undefined && peso_padrao <= 0) {
      res.status(400).json({
        success: false,
        error: 'Peso padrão deve ser maior que zero',
      });
      return;
    }
    
    if (dimensoes_padrao) {
      if (dimensoes_padrao.comprimento <= 0 || dimensoes_padrao.altura <= 0) {
        res.status(400).json({
          success: false,
          error: 'Dimensões devem ser maiores que zero',
        });
        return;
      }
      if (dimensoes_padrao.largura !== undefined && dimensoes_padrao.largura <= 0) {
        res.status(400).json({
          success: false,
          error: 'Largura deve ser maior que zero',
        });
        return;
      }
    }
    
    const preferences = await preferencesService.saveUserPreferences(userId, {
      preco_base_padrao,
      estoque_padrao_padrao,
      categoria_id_padrao,
      peso_padrao,
      dimensoes_padrao,
      usar_imagens_publicas_padrao,
      descricao_template,
    });
    
    res.json({
      success: true,
      data: preferences,
    });
  } catch (error: any) {
    console.error('Erro ao atualizar preferências:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao atualizar preferências',
    });
  }
});

/**
 * DELETE /api/shopee/preferences
 * Reseta preferências para padrões do sistema
 */
router.delete('/', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.uid;
    
    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'Usuário não autenticado',
      });
      return;
    }
    
    await preferencesService.resetUserPreferences(userId);
    
    res.json({
      success: true,
      message: 'Preferências resetadas com sucesso',
    });
  } catch (error: any) {
    console.error('Erro ao resetar preferências:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao resetar preferências',
    });
  }
});

export default router;
