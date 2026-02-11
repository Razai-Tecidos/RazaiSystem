import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { authMiddleware } from './middleware/auth.middleware';

// Carregar variáveis de ambiente primeiro
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
app.set('trust proxy', 1);

// Importar Firebase após dotenv e criação do app
try {
  require('./config/firebase');
  console.log('✅ Firebase Admin SDK inicializado com sucesso');
} catch (error) {
  console.error('❌ Erro ao inicializar Firebase:', error);
  // Continuar mesmo se Firebase falhar (para desenvolvimento)
}

// Middlewares
const defaultAllowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'https://razaisystem.web.app',
  'https://razaisystem.firebaseapp.com',
  process.env.FRONTEND_URL,
].filter(Boolean);
const configuredAllowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedOrigins = configuredAllowedOrigins.length > 0
  ? configuredAllowedOrigins
  : defaultAllowedOrigins;
const isDevelopment = process.env.NODE_ENV !== 'production';

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    if (isDevelopment && /^http:\/\/localhost:\d+$/i.test(origin)) {
      callback(null, true);
      return;
    }

    console.log('CORS blocked origin:', origin);
    callback(null, false);
  },
  credentials: true,
}));

app.use(helmet({
  contentSecurityPolicy: false,
}));

const shopeeWebhookRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 180,
  standardHeaders: true,
  legacyHeaders: false,
});
const shopeeAuthRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});
const shopeeProxyRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/shopee/webhook', shopeeWebhookRateLimit);
app.use('/api/shopee/callback', shopeeAuthRateLimit);
app.use('/api/shopee/proxy', shopeeProxyRateLimit);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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

// Rotas de tamanhos
import tamanhosRoutes from './routes/tamanhos.routes';
app.use('/api/tamanhos', tamanhosRoutes);

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

