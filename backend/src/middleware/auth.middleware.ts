import { Request, Response, NextFunction } from 'express';
import admin from '../config/firebase';
import { isEmailAuthorized } from '../config/authorizedEmails';

// Estender o tipo Request para incluir user
declare global {
  namespace Express {
    interface Request {
      user?: {
        uid: string;
        email: string;
        name?: string;
      };
    }
  }
}

/**
 * Middleware de autenticação Firebase
 * Verifica o token ID do Firebase e valida se o email está autorizado
 */
export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    // Obter token do header Authorization
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false,
        error: 'Token não fornecido. Faça login para continuar.' 
      });
    }

    const token = authHeader.split('Bearer ')[1];

    // Verificar e decodificar o token
    const decodedToken = await admin.auth().verifyIdToken(token);
    
    // Verificar se o email está autorizado
    if (!isEmailAuthorized(decodedToken.email)) {
      return res.status(403).json({ 
        success: false,
        error: 'Acesso negado. Seu email não está autorizado.' 
      });
    }

    // Adicionar informações do usuário ao request
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email || '',
      name: decodedToken.name
    };

    next();
  } catch (error: any) {
    console.error('Erro na autenticação:', error);
    
    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({ 
        success: false,
        error: 'Token expirado. Faça login novamente.' 
      });
    }
    
    if (error.code === 'auth/id-token-revoked') {
      return res.status(401).json({ 
        success: false,
        error: 'Token revogado. Faça login novamente.' 
      });
    }

    return res.status(401).json({ 
      success: false,
      error: 'Token inválido. Faça login para continuar.' 
    });
  }
}
