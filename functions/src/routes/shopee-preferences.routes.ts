import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import * as preferencesService from '../services/shopee-preferences.service';
import { UpdateShopeePreferencesData } from '../types/shopee-preferences.types';

const router = Router();

/**
 * GET /api/shopee/preferences
 * Busca preferencias do usuario
 */
router.get('/', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.uid;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'Usuario nao autenticado',
      });
      return;
    }

    const preferences = await preferencesService.getUserPreferences(userId);

    res.json({
      success: true,
      data: preferences,
    });
  } catch (error: any) {
    console.error('Erro ao buscar preferencias:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao buscar preferencias',
    });
  }
});

/**
 * GET /api/shopee/preferences/defaults
 * Busca valores padrao combinados (preferencias + sistema)
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
        error: 'Usuario nao autenticado',
      });
      return;
    }

    const defaults = await preferencesService.getDefaultValues(userId, tecidoLargura);

    res.json({
      success: true,
      data: defaults,
    });
  } catch (error: any) {
    console.error('Erro ao buscar valores padrao:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao buscar valores padrao',
    });
  }
});

/**
 * PUT /api/shopee/preferences
 * Atualiza preferencias do usuario
 */
router.put(
  '/',
  authMiddleware,
  async (req: Request<object, object, UpdateShopeePreferencesData>, res: Response): Promise<void> => {
    try {
      const userId = req.user?.uid;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Usuario nao autenticado',
        });
        return;
      }

      const {
        preco_base_padrao,
        comissao_percentual_padrao,
        taxa_fixa_item_padrao,
        margem_liquida_percentual_padrao,
        modo_margem_lucro_padrao,
        margem_lucro_fixa_padrao,
        valor_minimo_baixo_valor_padrao,
        adicional_baixo_valor_padrao,
        teto_comissao_padrao,
        aplicar_teto_padrao,
        aplicar_baixo_valor_padrao,
        estoque_padrao_padrao,
        categoria_id_padrao,
        peso_padrao,
        dimensoes_padrao,
        usar_imagens_publicas_padrao,
        descricao_template,
        ncm_padrao,
        cest_padrao,
        categoria_nome_padrao,
      } = req.body;

      if (preco_base_padrao !== undefined && preco_base_padrao < 0) {
        res.status(400).json({
          success: false,
          error: 'Preco base padrao deve ser maior ou igual a zero',
        });
        return;
      }

      if (
        comissao_percentual_padrao !== undefined &&
        (comissao_percentual_padrao < 0 || comissao_percentual_padrao >= 100)
      ) {
        res.status(400).json({
          success: false,
          error: 'Comissao percentual padrao deve estar entre 0 e 99.99',
        });
        return;
      }

      if (
        margem_liquida_percentual_padrao !== undefined &&
        (margem_liquida_percentual_padrao < 0 || margem_liquida_percentual_padrao >= 100)
      ) {
        res.status(400).json({
          success: false,
          error: 'Margem liquida percentual padrao deve estar entre 0 e 99.99',
        });
        return;
      }

      if (
        modo_margem_lucro_padrao !== undefined &&
        modo_margem_lucro_padrao !== 'percentual' &&
        modo_margem_lucro_padrao !== 'valor_fixo'
      ) {
        res.status(400).json({
          success: false,
          error: 'Modo de margem de lucro padrao invalido',
        });
        return;
      }

      if (margem_lucro_fixa_padrao !== undefined && margem_lucro_fixa_padrao < 0) {
        res.status(400).json({
          success: false,
          error: 'Margem de lucro fixa padrao deve ser maior ou igual a zero',
        });
        return;
      }

      if (taxa_fixa_item_padrao !== undefined && taxa_fixa_item_padrao < 0) {
        res.status(400).json({
          success: false,
          error: 'Taxa fixa por item padrao deve ser maior ou igual a zero',
        });
        return;
      }

      if (valor_minimo_baixo_valor_padrao !== undefined && valor_minimo_baixo_valor_padrao < 0) {
        res.status(400).json({
          success: false,
          error: 'Valor minimo de baixo valor padrao deve ser maior ou igual a zero',
        });
        return;
      }

      if (adicional_baixo_valor_padrao !== undefined && adicional_baixo_valor_padrao < 0) {
        res.status(400).json({
          success: false,
          error: 'Adicional de baixo valor padrao deve ser maior ou igual a zero',
        });
        return;
      }

      if (teto_comissao_padrao !== undefined && teto_comissao_padrao <= 0) {
        res.status(400).json({
          success: false,
          error: 'Teto de comissao padrao deve ser maior que zero',
        });
        return;
      }

      if (aplicar_teto_padrao === true && (teto_comissao_padrao === undefined || teto_comissao_padrao <= 0)) {
        res.status(400).json({
          success: false,
          error: 'Informe um teto de comissao valido quando aplicar teto estiver ativo',
        });
        return;
      }

      if (estoque_padrao_padrao !== undefined && estoque_padrao_padrao < 0) {
        res.status(400).json({
          success: false,
          error: 'Estoque padrao deve ser maior ou igual a zero',
        });
        return;
      }

      if (categoria_id_padrao !== undefined && categoria_id_padrao <= 0) {
        res.status(400).json({
          success: false,
          error: 'Categoria padrao invalida',
        });
        return;
      }

      if (peso_padrao !== undefined && peso_padrao <= 0) {
        res.status(400).json({
          success: false,
          error: 'Peso padrao deve ser maior que zero',
        });
        return;
      }

      if (dimensoes_padrao) {
        if (dimensoes_padrao.comprimento <= 0 || dimensoes_padrao.altura <= 0) {
          res.status(400).json({
            success: false,
            error: 'Dimensoes devem ser maiores que zero',
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

      if (cest_padrao !== undefined) {
        const normalizedCest = String(cest_padrao).replace(/\D/g, '');
        if (!(normalizedCest === '00' || normalizedCest.length === 7)) {
          res.status(400).json({
            success: false,
            error: 'CEST padrao deve conter 7 digitos ou "00"',
          });
          return;
        }
      }

      const preferences = await preferencesService.saveUserPreferences(userId, {
        preco_base_padrao,
        comissao_percentual_padrao,
        taxa_fixa_item_padrao,
        margem_liquida_percentual_padrao,
        modo_margem_lucro_padrao,
        margem_lucro_fixa_padrao,
        valor_minimo_baixo_valor_padrao,
        adicional_baixo_valor_padrao,
        teto_comissao_padrao,
        aplicar_teto_padrao,
        aplicar_baixo_valor_padrao,
        estoque_padrao_padrao,
        categoria_id_padrao,
        peso_padrao,
        dimensoes_padrao,
        usar_imagens_publicas_padrao,
        descricao_template,
        ncm_padrao,
        cest_padrao,
        categoria_nome_padrao,
      });

      res.json({
        success: true,
        data: preferences,
      });
    } catch (error: any) {
      console.error('Erro ao atualizar preferencias:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao atualizar preferencias',
      });
    }
  }
);

/**
 * DELETE /api/shopee/preferences
 * Reseta preferencias para padroes do sistema
 */
router.delete('/', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.uid;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'Usuario nao autenticado',
      });
      return;
    }

    await preferencesService.resetUserPreferences(userId);

    res.json({
      success: true,
      message: 'Preferencias resetadas com sucesso',
    });
  } catch (error: any) {
    console.error('Erro ao resetar preferencias:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao resetar preferencias',
    });
  }
});

export default router;
