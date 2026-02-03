import * as functions from 'firebase-functions';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { authMiddleware } from './middleware/auth.middleware';
import tecidosRoutes from './routes/tecidos.routes';
import coresRoutes from './routes/cores.routes';

// Inicializar Firebase Admin (já inicializado automaticamente no Cloud Functions)
import * as admin from 'firebase-admin';

// Cloud Functions já inicializa o Firebase Admin automaticamente
// Mas podemos garantir que está inicializado
if (!admin.apps.length) {
  admin.initializeApp();
}

const app = express();

// CORS - permitir todas as origens em produção (ou configurar específicas)
app.use(cors({
  origin: true, // Permitir todas as origens (ou configurar específicas)
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.get('/', (req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'RazaiSystem API está funcionando' });
});

app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'RazaiSystem API está funcionando' });
});

// Rota protegida de exemplo
app.get('/me', authMiddleware, (req: Request, res: Response) => {
  res.json({ 
    success: true,
    data: {
      uid: req.user?.uid,
      email: req.user?.email,
      name: req.user?.name
    }
  });
});

// Rotas de tecidos
app.use('/tecidos', tecidosRoutes);

// Rotas de cores
app.use('/cores', coresRoutes);

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Algo deu errado!' });
});

// Exportar como Cloud Function
export const api = functions.https.onRequest(app);
