import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { authMiddleware } from './middleware/auth.middleware';

// Carregar variáveis de ambiente primeiro
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Importar Firebase após dotenv e criação do app
try {
  require('./config/firebase');
  console.log('✅ Firebase Admin SDK inicializado com sucesso');
} catch (error) {
  console.error('❌ Erro ao inicializar Firebase:', error);
  // Continuar mesmo se Firebase falhar (para desenvolvimento)
}

// Middlewares
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'https://razaisystem.web.app',
  'https://razaisystem.firebaseapp.com',
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Permite requisições sem origin (ex: Postman, curl)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      callback(null, true); // Em desenvolvimento, permite todas
    }
  },
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'RazaiSystem API está funcionando' });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'RazaiSystem API está funcionando' });
});

// Rota protegida de exemplo
app.get('/api/me', authMiddleware, (req, res) => {
  res.json({ 
    success: true,
    data: {
      uid: req.user?.uid,
      email: req.user?.email,
      name: req.user?.name
    }
  });
});

// Rotas de tecidos (opcional - frontend usa Firebase Client SDK diretamente)
import tecidosRoutes from './routes/tecidos.routes';
app.use('/api/tecidos', tecidosRoutes);

// Rotas de cores (opcional - frontend usa Firebase Client SDK diretamente)
import coresRoutes from './routes/cores.routes';
app.use('/api/cores', coresRoutes);

// Rotas do Shopee
import shopeeRoutes from './routes/shopee.routes';
app.use('/api/shopee', shopeeRoutes);

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Algo deu errado!' });
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
