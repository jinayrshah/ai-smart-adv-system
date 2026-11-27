import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import path from 'path';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';

const getRuntimeDataFile = (fileName: string, defaultValue: unknown) => {
  if (!process.env.VERCEL) {
    return path.join(process.cwd(), fileName);
  }

  const dataDir = path.join('/tmp', 'smart-agriculture-ai');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const runtimeFile = path.join(dataDir, fileName);
  const bundledFile = path.join(process.cwd(), fileName);

  if (!fs.existsSync(runtimeFile)) {
    if (fs.existsSync(bundledFile)) {
      fs.copyFileSync(bundledFile, runtimeFile);
    } else {
      fs.writeFileSync(runtimeFile, JSON.stringify(defaultValue, null, 2));
    }
  }

  return runtimeFile;
};

export async function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  // A hard-coded fallback secret lets anyone who reads this repo forge login tokens.
  // Production refuses to start without JWT_SECRET; development uses a random
  // per-process secret (sessions reset on restart).
  let JWT_SECRET = process.env.JWT_SECRET || '';
  if (!JWT_SECRET) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET must be set in production');
    }
    JWT_SECRET = crypto.randomBytes(32).toString('hex');
    console.warn('[AUTH] JWT_SECRET not set; using a random development secret (logins reset on restart).');
  }

  app.use(express.json({ limit: '1mb' }));

  // Persistence for users
  const usersFile = getRuntimeDataFile('users.json', {});

  if (!fs.existsSync(usersFile)) {
    fs.writeFileSync(usersFile, JSON.stringify({}));
  }

  // Accounts live in Supabase when it is configured. The JSON file is for local dev only:
  // on Vercel it sits in /tmp, which is wiped on cold starts, so accounts (and the farm
  // keyed by their id) used to vanish.
  const SB_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  // Legacy service_role keys are JWTs and go in both headers; new sb_secret_ keys must not be
  // sent as a Bearer token (Supabase rejects them there), only as apikey.
  const sbHeaders: Record<string, string> = {
    apikey: SB_KEY, 'Content-Type': 'application/json',
    ...(SB_KEY.startsWith('eyJ') ? { Authorization: `Bearer ${SB_KEY}` } : {}),
  };
  const readUserFile = (): Record<string, any> => {
    try {
      const data = fs.readFileSync(usersFile, 'utf-8');
      return data.trim() ? JSON.parse(data) : {};
    } catch (error) {
      console.error('[AUTH] Failed to read users file:', error);
      return {};
    }
  };
  // Set once Supabase says app_users does not exist, so logins keep working from the
  // local file until the migration (supabase/migrations/20261101000000_app_users.sql) is run.
  // Once Supabase fails for accounts (table missing, bad key, unreachable), this process
  // serves accounts from the local users.json so sign-in keeps working; the reason is logged.
  let sbUsersOff = false;
  const IS_PROD = process.env.NODE_ENV === 'production' || !!process.env.VERCEL;
  if (IS_PROD && !(SB_URL && SB_KEY)) {
    // On Vercel the local file lives in /tmp and is wiped on cold starts: accounts would vanish.
    console.error('[AUTH] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set; accounts cannot be stored in production.');
  }
  const useSb = () => !!(SB_URL && SB_KEY) && (IS_PROD || !sbUsersOff);
  const sbOff = (why: string) => {
    if (IS_PROD) {
      // Never fall back to the throwaway file in production; surface the failure instead.
      console.error(`[AUTH] Supabase account store failed: ${why}`);
      throw new Error('account store unavailable');
    }
    sbUsersOff = true;
    console.warn(`[AUTH] Supabase account store disabled for this run: ${why}. Using local users.json. Fix the cause and restart.`);
  };
  const sbFailed = async (r: Response, op: string): Promise<void> => {
    const body = await r.text().catch(() => '');
    const hint = r.status === 404 || /PGRST205|42P01|does not exist|Could not find the table/i.test(body)
      ? 'table app_users not found (run supabase/migrations/20261101000000_app_users.sql in the SQL editor)'
      : r.status === 401 || r.status === 403
        ? 'SUPABASE_SERVICE_ROLE_KEY was rejected (check it matches this project; use the service_role / secret key)'
        : `HTTP ${r.status}`;
    sbOff(`${op}: ${hint}. Response: ${body.slice(0, 200)}`);
  };
  const sbFetch = async (url: string, init: RequestInit, op: string): Promise<Response | null> => {
    try {
      const r = await fetch(url, init);
      if (r.ok) return r;
      await sbFailed(r, op);
    } catch (err: any) {
      sbOff(`${op}: cannot reach ${SB_URL} (${err?.cause?.code || err?.message})`);
    }
    return null;
  };
  const findInFile = (by: { identifier?: string; id?: string }) => {
    const users = readUserFile();
    return by.identifier ? users[by.identifier] ?? null : Object.values(users).find((u: any) => u.id === by.id) ?? null;
  };
  const findUser = async (by: { identifier?: string; id?: string }): Promise<any | null> => {
    if (useSb()) {
      const q = by.identifier ? `identifier=eq.${encodeURIComponent(by.identifier)}` : `id=eq.${encodeURIComponent(by.id || '')}`;
      const r = await sbFetch(`${SB_URL}/rest/v1/app_users?${q}&select=data&limit=1`, { headers: sbHeaders }, 'read');
      if (r) {
        const rows = await r.json();
        if (rows[0]) return rows[0].data;
        // One-time move of an account created before Supabase was configured.
        const local = findInFile(by);
        if (local) await saveUser(local);
        return local;
      }
    }
    if (IS_PROD) throw new Error('account store unavailable');
    return findInFile(by);
  };
  const saveUser = async (user: any): Promise<void> => {
    if (useSb()) {
      const r = await sbFetch(`${SB_URL}/rest/v1/app_users?on_conflict=identifier`, {
        method: 'POST',
        headers: { ...sbHeaders, Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({ identifier: user.identifier, id: user.id, data: user, updated_at: new Date().toISOString() }),
      }, 'write');
      if (r) return;
    }
    if (IS_PROD) throw new Error('account store unavailable');
    const users = readUserFile();
    users[user.identifier] = user;
    fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
  };

  // In-memory OTP store (identifier -> { hashedOtp, expiresAt, attempts })
  const otpStore = new Map<string, { hashedOtp: string; expiresAt: number; attempts: number }>();

  // Rate limiting for login and register
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Limit each IP to 10 requests per windowMs
    message: { status: 'error', error: 'Too many requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Rate limiting for public API endpoints (Architecture §13)
  const publicApiLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 300, // 300 requests per minute per IP
    message: { error: 'Too many API requests from this IP, please try again shortly.' },
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api/', publicApiLimiter);

  // Auth Middleware
  const authenticateToken = (req: any, res: any, next: any) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ status: 'error', error: 'Access denied' });

    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
      if (err) return res.status(403).json({ status: 'error', error: 'Invalid token' });
      req.user = user;
      next();
    });
  };

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'AI Smart Agriculture Adviser API is running' });
  });

  // --- Auth Routes ---

  // Register
  app.post('/api/auth/register', authLimiter, async (req, res) => {
    try {
      const { identifier, password, type } = req.body;
      if (!identifier || !password || !type) {
        return res.status(400).json({ status: 'error', error: 'Identifier, password and type are required' });
      }
      if (typeof identifier !== 'string' || identifier.length > 254 || typeof password !== 'string') {
        return res.status(400).json({ status: 'error', error: 'Invalid identifier or password' });
      }
      if (password.length < 8) {
        return res.status(400).json({ status: 'error', error: 'Password must be at least 8 characters' });
      }
      if (type !== 'email' && type !== 'mobile') {
        return res.status(400).json({ status: 'error', error: "Type must be 'email' or 'mobile'" });
      }

      if (await findUser({ identifier })) {
        return res.status(400).json({ status: 'error', error: 'User already exists' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const user = {
        id: crypto.randomUUID(),
        identifier,
        password: hashedPassword,
        type,
        role: 'farmer',
        createdAt: new Date().toISOString()
      };

      await saveUser(user);

      const token = jwt.sign(
        { userId: user.id, identifier: user.identifier, role: user.role },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      const { password: _, ...userWithoutPassword } = user;
      res.status(201).json({ status: 'ok', user: userWithoutPassword, token, isNewUser: true });
    } catch (error) {
      console.error('[API] Register error:', error);
      res.status(503).json({ status: 'error', error: 'Registration failed due to server error. The account service is unreachable (is the Supabase project paused?). Please try again.' });
    }
  });

  // Login
  app.post('/api/auth/login', authLimiter, async (req, res) => {
    try {
      const { identifier, password } = req.body;
      if (!identifier || !password) {
        return res.status(400).json({ status: 'error', error: 'Identifier and password are required' });
      }

      const user = await findUser({ identifier });

      if (!user || !user.password) {
        return res.status(401).json({ status: 'error', error: 'Invalid credentials' });
      }

      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid) {
        return res.status(401).json({ status: 'error', error: 'Invalid credentials' });
      }

      const token = jwt.sign(
        { userId: user.id, identifier: user.identifier, role: user.role },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      const { password: _, ...userWithoutPassword } = user;
      res.json({ status: 'ok', user: userWithoutPassword, token, isNewUser: false });
    } catch (error) {
      console.error('[API] Login error:', error);
      res.status(503).json({ status: 'error', error: 'Login failed due to server error. The account service is unreachable (is the Supabase project paused?). Please try again.' });
    }
  });

  // Change Password
  app.post('/api/auth/change-password', authenticateToken, async (req: any, res) => {
    try {
      const { oldPassword, newPassword } = req.body;
      if (!oldPassword || !newPassword) {
        return res.status(400).json({ status: 'error', error: 'Old and new passwords are required' });
      }
      if (typeof newPassword !== 'string' || newPassword.length < 8) {
        return res.status(400).json({ status: 'error', error: 'New password must be at least 8 characters' });
      }

      const user = await findUser({ id: req.user.userId });

      if (!user || !user.password) {
        return res.status(404).json({ status: 'error', error: 'User not found' });
      }

      const isValid = await bcrypt.compare(oldPassword, user.password);
      if (!isValid) {
        return res.status(401).json({ status: 'error', error: 'Invalid old password' });
      }

      user.password = await bcrypt.hash(newPassword, 10);
      await saveUser(user);

      res.json({ status: 'ok', message: 'Password changed successfully' });
    } catch (error) {
      console.error('[API] Change password error:', error);
      res.status(503).json({ status: 'error', error: 'Failed to change password. The account service is unreachable (is the Supabase project paused?). Please try again.' });
    }
  });

  // Password Reset Request (Send OTP)
  app.post('/api/auth/reset-password-request', authLimiter, async (req, res) => {
    try {
      const { identifier } = req.body;
      if (!identifier) return res.status(400).json({ status: 'error', error: 'Identifier is required' });

      const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes
      // Same answer whether or not the account exists, so this cannot be used to probe accounts.
      if (!(await findUser({ identifier }))) {
        return res.json({ status: 'ok', message: 'Reset OTP sent successfully', expiresAt });
      }

      const otp = crypto.randomInt(100000, 1000000).toString(); // CSPRNG, not Math.random
      const hashedOtp = await bcrypt.hash(otp, 10);

      otpStore.set(identifier, { hashedOtp, expiresAt, attempts: 0 });

      if (process.env.NODE_ENV !== 'production') {
        // Development only: no SMS/e-mail provider is wired up yet.
        console.log(`[AUTH] (dev) Password reset OTP for ${identifier}: ${otp}`);
      }
      res.json({ status: 'ok', message: 'Reset OTP sent successfully', expiresAt });
    } catch (error) {
      console.error('[API] Reset password request error:', error);
      res.status(503).json({ status: 'error', error: 'Failed to send reset OTP. The account service is unreachable (is the Supabase project paused?). Please try again.' });
    }
  });

  // Password Reset Confirm
  app.post('/api/auth/reset-password-confirm', authLimiter, async (req, res) => {
    try {
      const { identifier, otp, newPassword } = req.body;
      if (!identifier || !otp || !newPassword) {
        return res.status(400).json({ status: 'error', error: 'Identifier, OTP and new password are required' });
      }

      if (typeof newPassword !== 'string' || newPassword.length < 8) {
        return res.status(400).json({ status: 'error', error: 'New password must be at least 8 characters' });
      }

      const storedData = otpStore.get(identifier);
      if (!storedData) return res.status(400).json({ status: 'error', error: 'OTP not found or expired' });

      if (Date.now() > storedData.expiresAt) {
        otpStore.delete(identifier);
        return res.status(400).json({ status: 'error', error: 'OTP expired' });
      }

      const isValid = await bcrypt.compare(otp, storedData.hashedOtp);
      if (!isValid) {
        storedData.attempts += 1;
        if (storedData.attempts >= 5) {
          otpStore.delete(identifier);
          return res.status(400).json({ status: 'error', error: 'Too many attempts. Please request a new OTP.' });
        }
        return res.status(400).json({ status: 'error', error: 'Invalid OTP' });
      }

      otpStore.delete(identifier);

      const user = await findUser({ identifier });
      if (!user) return res.status(404).json({ status: 'error', error: 'User not found' });

      user.password = await bcrypt.hash(newPassword, 10);
      await saveUser(user);

      res.json({ status: 'ok', message: 'Password reset successfully' });
    } catch (error) {
      console.error('[API] Reset password confirm error:', error);
      res.status(500).json({ status: 'error', error: 'Failed to reset password' });
    }
  });

  app.get('/api/auth/profile', authenticateToken, async (req: any, res) => {
    try {
      const user = await findUser({ id: req.user.userId });
      if (!user) return res.status(404).json({ status: 'error', error: 'User not found' });
      const { password: _pw, ...safeUser } = user as any;
      res.json({ status: 'ok', ...safeUser });
    } catch (error) {
      console.error('[API] Fetch profile error:', error);
      res.status(503).json({ status: 'error', error: 'Failed to fetch profile. The account service is unreachable (is the Supabase project paused?). Please try again.' });
    }
  });

  app.post('/api/auth/update-profile', authenticateToken, async (req: any, res) => {
    try {
      // `role` is never taken from the client: letting it through let anyone make themselves admin.
      const { name, location, farmType } = req.body;
      const user = await findUser({ id: req.user.userId });

      if (!user) return res.status(404).json({ status: 'error', error: 'User not found' });

      const updatedUser = {
        ...(user as any),
        name: name || (user as any).name,
        location: location || (user as any).location,
        farmType: farmType || (user as any).farmType,
        role: (user as any).role || 'farmer'
      };

      await saveUser(updatedUser);

      const { password: _pw, ...safeUser } = updatedUser;
      res.json({ status: 'ok', ...safeUser });
    } catch (error) {
      console.error('[API] Update profile error:', error);
      res.status(503).json({ status: 'error', error: 'Failed to update profile. The account service is unreachable (is the Supabase project paused?). Please try again.' });
    }
  });
  // --- End Auth Routes ---

  // ---- FastAPI proxy -------------------------------------------------------------
  // One helper instead of three copies. Fixes:
  //  * multipart bodies (disease photo upload) are streamed through untouched — the old
  //    proxies rebuilt every request as JSON from req.body, so uploads arrived empty;
  //  * the caller's IP is forwarded (FastAPI trusts X-Forwarded-For only from this local
  //    proxy), otherwise every user shared FastAPI's single per-IP rate-limit bucket;
  //  * non-JSON responses are passed through instead of crashing on response.json().
  const FASTAPI_URL = (process.env.FASTAPI_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
  const proxyToFastApi = async (req: any, res: any) => {
    try {
      const headers: Record<string, string> = {};
      if (req.headers.authorization) headers['Authorization'] = req.headers.authorization;
      const clientIp = req.ip || req.socket?.remoteAddress;
      if (clientIp) headers['X-Forwarded-For'] = clientIp;
      if (req.headers['accept-language']) headers['Accept-Language'] = String(req.headers['accept-language']);

      const contentType = String(req.headers['content-type'] || '');
      const init: any = { method: req.method, headers };
      if (!['GET', 'HEAD'].includes(req.method)) {
        if (contentType.startsWith('application/json')) {
          headers['Content-Type'] = 'application/json';
          init.body = JSON.stringify(req.body ?? {});
        } else if (contentType) {
          headers['Content-Type'] = contentType;
          if (req.headers['content-length']) headers['Content-Length'] = String(req.headers['content-length']);
          init.body = req; // stream (express.json() leaves non-JSON bodies unread)
          init.duplex = 'half';
        }
      }

      const response = await fetch(`${FASTAPI_URL}${req.originalUrl}`, init);
      const respType = response.headers.get('content-type') || '';
      res.status(response.status);
      if (respType.includes('application/json')) {
        res.json(await response.json());
      } else {
        if (respType) res.type(respType);
        res.end(new Uint8Array(await response.arrayBuffer()));
      }
    } catch (err: any) {
      res.status(502).json({
        error: 'FastAPI backend unavailable',
        hint: `Make sure the FastAPI backend is running at ${FASTAPI_URL} (npm run dev:backend)`,
        details: err.message,
      });
    }
  };

  app.all('/api/farmer*', proxyToFastApi);
  app.all('/api/advisory*', proxyToFastApi);

  // The grounded market insight lives in FastAPI (Revisions §2.3). Requests that name a
  // market come from the new market page; the legacy route below keeps serving the old
  // state/district-only widget.
  app.get('/api/market/insight', (req: any, res: any, next: any) => {
    if (req.query.market) return proxyToFastApi(req, res);
    next();
  });

  // Data-layer endpoints (trend, latest prices, search, calculators, weather, context).
  // MUST be declared BEFORE /api/weather/:city so routes like /api/weather/summary are not hijacked.
  app.get([
    '/api/market/trend',
    '/api/market/prices/latest',
    '/api/market/search',
    '/api/market/list-markets',
    '/api/market/margin',
    '/api/market/storage-estimate',
    '/api/health/data',
    '/api/weather/current',
    '/api/weather/forecast',
    '/api/weather/history',
    '/api/weather/summary',
    '/api/weather/search',
    '/api/context/market-weather',
  ], proxyToFastApi);

  // Catch-all for API routes that don't match
  app.all('/api/*', (req, res) => {
    console.warn(`[API] 404 Not Found: ${req.method} ${req.url}`);
    res.status(404).json({ status: 'error', error: `API route not found: ${req.method} ${req.url}` });
  });

  // Vite middleware for local development. Vercel serves the built frontend
  // separately, so serverless API functions should only register API routes.
  if (!process.env.VERCEL && process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else if (!process.env.VERCEL) {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  return app;
}

async function startServer() {
  const PORT = Number(process.env.PORT) || 3000;
  const app = await createApp();

  app.listen(PORT, '0.0.0.0', async () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer();
}
