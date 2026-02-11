import * as functions from 'firebase-functions';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { authMiddleware } from './middleware/auth.middleware';
import tecidosRoutes from './routes/tecidos.routes';
import coresRoutes from './routes/cores.routes';
import shopeeRoutes from './routes/shopee.routes';
import shopeeWebhookRoutes from './routes/shopee-webhook.routes';
import tamanhosRoutes from './routes/tamanhos.routes';
import shopeeCategoriesRoutes from './routes/shopee-categories.routes';
import shopeePreferencesRoutes from './routes/shopee-preferences.routes';
import shopeeProductsRoutes from './routes/shopee-products.routes';
import shopeeTemplatesRoutes from './routes/shopee-templates.routes';
import shopeeLogisticsRoutes from './routes/shopee-logistics.routes';
import shopeeItemLimitRoutes from './routes/shopee-item-limit.routes';

// Inicializar Firebase Admin (já inicializado automaticamente no Cloud Functions)
import * as admin from 'firebase-admin';

// Cloud Functions já inicializa o Firebase Admin automaticamente
// Mas podemos garantir que está inicializado
if (!admin.apps.length) {
  admin.initializeApp();
}

const app = express();
export { app };

app.set('trust proxy', 1);

const defaultAllowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'https://razaisystem.web.app',
  'https://razaisystem.firebaseapp.com',
];
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
    if (!origin) {
      callback(null, true);
      return;
    }

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    if (isDevelopment && /^http:\/\/localhost:\d+$/i.test(origin)) {
      callback(null, true);
      return;
    }

    console.warn(`[CORS] Blocked origin: ${origin}`);
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

app.use(['/api/shopee/webhook', '/shopee/webhook'], shopeeWebhookRateLimit);
app.use(['/api/shopee/callback', '/shopee/callback'], shopeeAuthRateLimit);
app.use(['/api/shopee/proxy', '/shopee/proxy'], shopeeProxyRateLimit);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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
app.use('/api/tecidos', tecidosRoutes);

// Rotas de cores
app.use('/cores', coresRoutes);
app.use('/api/cores', coresRoutes);

// Rotas do Shopee
app.use('/shopee', shopeeRoutes);
app.use('/api/shopee', shopeeRoutes);

// Rotas de webhook do Shopee (sem authMiddleware, verificação própria)
app.use('/api/shopee', shopeeWebhookRoutes);

// Rotas de tamanhos
app.use('/tamanhos', tamanhosRoutes);
app.use('/api/tamanhos', tamanhosRoutes);

// Rotas de categorias Shopee
app.use('/shopee/categories', shopeeCategoriesRoutes);
app.use('/api/shopee/categories', shopeeCategoriesRoutes);

// Rotas de preferências Shopee
app.use('/shopee/preferences', shopeePreferencesRoutes);
app.use('/api/shopee/preferences', shopeePreferencesRoutes);

// Rotas de produtos Shopee
app.use('/shopee/products', shopeeProductsRoutes);
app.use('/api/shopee/products', shopeeProductsRoutes);

// Rotas de templates Shopee
app.use('/shopee/templates', shopeeTemplatesRoutes);
app.use('/api/shopee/templates', shopeeTemplatesRoutes);

// Rotas de logística Shopee
app.use('/shopee/logistics', shopeeLogisticsRoutes);
app.use('/api/shopee/logistics', shopeeLogisticsRoutes);

// Rotas de limites de item Shopee
app.use('/shopee/item-limit', shopeeItemLimitRoutes);
app.use('/api/shopee/item-limit', shopeeItemLimitRoutes);

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Algo deu errado!' });
});

// Exportar como Cloud Function
// Timeout de 540s (9min) para suportar publish com muitos uploads de imagem
export const api = functions
  .runWith({ timeoutSeconds: 540, memory: '1GB' })
  .https.onRequest(app);

// Exportar funções agendadas
export { maintainDisabledColors } from './scheduled/maintain-disabled-colors';
export { scheduledSyncShopeeProducts } from './scheduled/sync-shopee-products';


