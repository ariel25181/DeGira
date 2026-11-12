import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import webpush from 'web-push';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '10mb' }));

// VAPID keys for Web Push
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBKr3qBUYIHBQFLXYp5Nksh8U';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'UUxI4O84qEw_1q1WpL4gR63B0g03gK9M54P_w0Z8k0c';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:notificaciones@degira.com.ar';

try {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
} catch (e) {
  console.warn('VAPID setup warning (fallback used):', e);
}

// In-memory Push Subscription store
interface StoredSubscription {
  id: string;
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  userId?: string;
  userRole?: string;
  userAgent?: string;
  createdAt: string;
}

const pushSubscriptions: Map<string, StoredSubscription> = new Map();

// API Endpoints for Web Push
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'DeGira Backend API',
    time: new Date().toISOString(),
    pushSubscriptionsCount: pushSubscriptions.size,
  });
});

app.get('/api/push/vapid-public-key', (_req, res) => {
  res.json({
    publicKey: VAPID_PUBLIC_KEY,
  });
});

app.get('/api/push/subscriptions', (_req, res) => {
  const list = Array.from(pushSubscriptions.values()).map((s) => ({
    id: s.id,
    endpoint: s.endpoint.slice(0, 40) + '...',
    userRole: s.userRole || 'espectador',
    userId: s.userId || 'anon',
    createdAt: s.createdAt,
  }));
  res.json({ count: pushSubscriptions.size, subscriptions: list });
});

// Endpoint que recibe y registra Subscription Objects de los clientes
app.post('/api/push/subscribe', (req, res) => {
  const { subscription, userId, userRole, userAgent } = req.body;

  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ error: 'Subscription object with endpoint is required' });
  }

  const endpoint = subscription.endpoint;
  const p256dh = subscription.keys?.p256dh || '';
  const auth = subscription.keys?.auth || '';

  const stored: StoredSubscription = {
    id: `sub-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    endpoint,
    keys: { p256dh, auth },
    userId: userId || 'anon',
    userRole: userRole || 'espectador',
    userAgent: userAgent || req.headers['user-agent'] || '',
    createdAt: new Date().toISOString(),
  };

  pushSubscriptions.set(endpoint, stored);
  console.log(`[Push] Nueva suscripción registrada (${userRole || 'espectador'}). Total: ${pushSubscriptions.size}`);

  res.status(201).json({
    success: true,
    message: 'Subscription registered successfully',
    id: stored.id,
    totalSubscribers: pushSubscriptions.size,
  });
});

app.post('/api/push/unsubscribe', (req, res) => {
  const { endpoint } = req.body;
  if (!endpoint) {
    return res.status(400).json({ error: 'Endpoint is required' });
  }
  const deleted = pushSubscriptions.delete(endpoint);
  res.json({ success: deleted });
});

// Endpoint para enviar notificaciones push a través del Service Worker
app.post('/api/push/send', async (req, res) => {
  const { title, body, url, tag, targetRole, userId } = req.body;

  if (!title || !body) {
    return res.status(400).json({ error: 'Title and body are required' });
  }

  const payload = JSON.stringify({
    title,
    body,
    url: url || '/',
    tag: tag || `degira-${Date.now()}`,
  });

  let sentCount = 0;
  const errors: any[] = [];

  const targets = Array.from(pushSubscriptions.values()).filter((sub) => {
    if (targetRole && sub.userRole && sub.userRole !== targetRole) return false;
    if (userId && sub.userId && sub.userId !== userId) return false;
    return true;
  });

  for (const sub of targets) {
    try {
      const pushSub = {
        endpoint: sub.endpoint,
        keys: sub.keys,
      };
      await webpush.sendNotification(pushSub, payload);
      sentCount++;
    } catch (err: any) {
      console.warn(`[Push Error] Failed to send to ${sub.endpoint.slice(0, 30)}:`, err?.message || err);
      if (err?.statusCode === 410 || err?.statusCode === 404) {
        // Expired subscription
        pushSubscriptions.delete(sub.endpoint);
      }
      errors.push(err?.message || 'Push error');
    }
  }

  res.json({
    success: true,
    sentCount,
    targetedCount: targets.length,
    errorsCount: errors.length,
  });
});

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`DeGira server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
