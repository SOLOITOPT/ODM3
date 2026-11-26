import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import express, { type NextFunction, type Request, type Response } from 'express';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '.data');
const DATA_FILE = path.join(DATA_DIR, 'odm-store.json');

type MissionOrderStatus = 'draft' | 'issued' | 'archived';
type AuthorizedBy = 'operations' | 'administration' | null;

type Employee = {
  id: string;
  first_name: string;
  last_name: string;
  position: string;
  created_at: string;
};

type Vehicle = {
  id: string;
  model: string;
  registration_plate: string;
  created_at: string;
};

type Project = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
};

type MissionOrder = {
  id: string;
  order_number: string;
  employee_id: string;
  vehicle_id: string;
  project_id: string | null;
  destination: string;
  start_date: string;
  end_date: string;
  status: MissionOrderStatus;
  authorized_by: AuthorizedBy;
  notes: string | null;
  created_at: string;
};

type StoreData = {
  employees: Employee[];
  vehicles: Vehicle[];
  projects: Project[];
  mission_orders: MissionOrder[];
  order_sequences: Record<string, number>;
  app_settings: {
    admin_password_hash: string | null;
    admin_password_set_at: string | null;
  };
};

function defaultStore(): StoreData {
  return {
    employees: [],
    vehicles: [],
    projects: [],
    mission_orders: [],
    order_sequences: {},
    app_settings: {
      admin_password_hash: null,
      admin_password_set_at: null,
    },
  };
}

function loadStore(): StoreData {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      return defaultStore();
    }
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<StoreData>;
    return {
      employees: Array.isArray(parsed.employees) ? parsed.employees : [],
      vehicles: Array.isArray(parsed.vehicles) ? parsed.vehicles : [],
      projects: Array.isArray(parsed.projects) ? parsed.projects : [],
      mission_orders: Array.isArray(parsed.mission_orders) ? parsed.mission_orders : [],
      order_sequences:
        parsed.order_sequences && typeof parsed.order_sequences === 'object'
          ? parsed.order_sequences
          : {},
      app_settings: parsed.app_settings ?? {
        admin_password_hash: null,
        admin_password_set_at: null,
      },
    };
  } catch {
    return defaultStore();
  }
}

function saveStore(store: StoreData): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tempFile = `${DATA_FILE}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(store, null, 2), 'utf-8');
  fs.renameSync(tempFile, DATA_FILE);
}

const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const revokedTokens = new Set<string>();
const TOKEN_TTL_MS = 1000 * 60 * 60 * 12;

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${derived}`;
}

function verifyPasswordHash(password: string, stored: string): boolean {
  const parts = stored.split(':');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const [, salt, expectedHex] = parts;
  const actual = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHex, 'hex');
  if (actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(actual, expected);
}

function verifyEnvPassword(password: string, envPassword: string): boolean {
  const a = Buffer.from(password, 'utf-8');
  const b = Buffer.from(envPassword, 'utf-8');
  if (a.length !== b.length) {
    crypto.timingSafeEqual(a, a);
    return false;
  }
  return crypto.timingSafeEqual(a, b);
}

function verifyAdminPassword(password: string, store: StoreData): boolean {
  const envPass = process.env.ADMIN_PASSWORD?.trim();
  if (envPass) {
    return verifyEnvPassword(password, envPass);
  }
  if (!store.app_settings.admin_password_hash) {
    return false;
  }
  return verifyPasswordHash(password, store.app_settings.admin_password_hash);
}

function issueToken(): string {
  const payload = Buffer.from(
    JSON.stringify({
      sub: 'admin',
      jti: crypto.randomUUID(),
      exp: Date.now() + TOKEN_TTL_MS,
    })
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifyToken(token: string): { sub: string; jti: string; exp: number } | null {
  const dotIdx = token.indexOf('.');
  if (dotIdx <= 0) return null;
  const payload = token.slice(0, dotIdx);
  const sig = token.slice(dotIdx + 1);
  const expectedSig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payload)
    .digest('base64url');
  const sigBuf = Buffer.from(sig, 'utf-8');
  const expectedBuf = Buffer.from(expectedSig, 'utf-8');
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8')) as {
      sub?: string;
      jti?: string;
      exp?: number;
    };
    if (
      parsed.sub !== 'admin' ||
      typeof parsed.jti !== 'string' ||
      typeof parsed.exp !== 'number' ||
      parsed.exp < Date.now() ||
      revokedTokens.has(parsed.jti)
    ) {
      return null;
    }
    return { sub: parsed.sub, jti: parsed.jti, exp: parsed.exp };
  } catch {
    return null;
  }
}

function extractBearer(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  return header.slice(7).trim() || null;
}

function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = extractBearer(req);
  if (!token || !verifyToken(token)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}

function cleanText(val: unknown): string {
  return typeof val === 'string' ? val.trim() : '';
}

function cleanOptionalText(val: unknown): string | null {
  if (typeof val !== 'string') return null;
  const trimmed = val.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isValidDateStr(val: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(val);
}

function isValidStatus(val: unknown): val is MissionOrderStatus {
  return val === 'draft' || val === 'issued' || val === 'archived';
}

function isValidAuthorizedBy(val: unknown): val is AuthorizedBy {
  return val === null || val === undefined || val === '' || val === 'operations' || val === 'administration';
}

function normalizeAuthorizedBy(val: unknown): AuthorizedBy {
  if (val === 'operations' || val === 'administration') return val;
  return null;
}

function hydrateMissionOrder(order: MissionOrder, store: StoreData) {
  const employee = store.employees.find((e) => e.id === order.employee_id) ?? null;
  const vehicle = store.vehicles.find((v) => v.id === order.vehicle_id) ?? null;
  const project = order.project_id
    ? store.projects.find((p) => p.id === order.project_id) ?? null
    : null;
  return {
    ...order,
    employee,
    vehicle,
    project,
  };
}

function createApiRouter() {
  const api = express.Router();
  api.use(express.json({ limit: '1mb' }));

  api.get('/health', (_req, res) => {
    res.json({ ok: true, backend: 'node-express' });
  });

  api.get('/auth/status', (_req, res) => {
    const store = loadStore();
    const envOverride = Boolean(process.env.ADMIN_PASSWORD?.trim());
    const needsSetup = !envOverride && !store.app_settings.admin_password_hash;
    res.json({
      needsSetup,
      envOverride,
      passwordSetAt: store.app_settings.admin_password_set_at,
    });
  });

  api.post('/auth/setup', (req, res) => {
    const store = loadStore();
    const envOverride = Boolean(process.env.ADMIN_PASSWORD?.trim());
    if (envOverride || store.app_settings.admin_password_hash) {
      res.status(409).json({ error: 'Admin password is already configured' });
      return;
    }
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters' });
      return;
    }
    const now = new Date().toISOString();
    store.app_settings.admin_password_hash = hashPassword(password);
    store.app_settings.admin_password_set_at = now;
    saveStore(store);

    const token = issueToken();
    res.status(201).json({ token, passwordSetAt: now });
  });

  api.post('/auth/login', (req, res) => {
    const store = loadStore();
    const username = cleanText(req.body?.username);
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (username !== 'admin' || !password || !verifyAdminPassword(password, store)) {
      res.status(401).json({ error: 'Invalid username or password' });
      return;
    }
    const token = issueToken();
    res.json({
      token,
      passwordSetAt: store.app_settings.admin_password_set_at,
    });
  });

  api.post('/auth/logout', (req, res) => {
    const token = extractBearer(req);
    if (token) {
      const claims = verifyToken(token);
      if (claims) {
        revokedTokens.add(claims.jti);
      }
    }
    res.json({ ok: true });
  });

  api.use(requireAuth);

  api.get('/settings', (_req, res) => {
    const store = loadStore();
    res.json({
      admin_password_set_at: store.app_settings.admin_password_set_at,
      envOverride: Boolean(process.env.ADMIN_PASSWORD?.trim()),
    });
  });

  api.put('/settings/password', (req, res) => {
    if (process.env.ADMIN_PASSWORD?.trim()) {
      res.status(400).json({
        error: 'Admin password is managed by server environment configuration',
        code: 'ENV_MANAGED',
      });
      return;
    }
    const store = loadStore();
    const currentPassword =
      typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
    const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';
    if (!verifyAdminPassword(currentPassword, store)) {
      res.status(400).json({ error: 'Current password is incorrect', code: 'WRONG_PASSWORD' });
      return;
    }
    if (newPassword.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters' });
      return;
    }
    const now = new Date().toISOString();
    store.app_settings.admin_password_hash = hashPassword(newPassword);
    store.app_settings.admin_password_set_at = now;
    saveStore(store);
    res.json({ admin_password_set_at: now });
  });

  // Employees
  api.get('/employees', (_req, res) => {
    const store = loadStore();
    const sorted = [...store.employees].sort((a, b) => a.last_name.localeCompare(b.last_name));
    res.json(sorted);
  });

  api.post('/employees', (req, res) => {
    const first_name = cleanText(req.body?.first_name);
    const last_name = cleanText(req.body?.last_name);
    const position = cleanText(req.body?.position);
    if (!first_name || !last_name || !position) {
      res.status(400).json({ error: 'First name, last name, and position are required' });
      return;
    }
    const store = loadStore();
    const employee: Employee = {
      id: crypto.randomUUID(),
      first_name,
      last_name,
      position,
      created_at: new Date().toISOString(),
    };
    store.employees.push(employee);
    saveStore(store);
    res.status(201).json(employee);
  });

  api.put('/employees/:id', (req, res) => {
    const first_name = cleanText(req.body?.first_name);
    const last_name = cleanText(req.body?.last_name);
    const position = cleanText(req.body?.position);
    if (!first_name || !last_name || !position) {
      res.status(400).json({ error: 'First name, last name, and position are required' });
      return;
    }
    const store = loadStore();
    const idx = store.employees.findIndex((e) => e.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Employee not found' });
      return;
    }
    store.employees[idx] = {
      ...store.employees[idx],
      first_name,
      last_name,
      position,
    };
    saveStore(store);
    res.json(store.employees[idx]);
  });

  api.delete('/employees/:id', (req, res) => {
    const store = loadStore();
    const inUse = store.mission_orders.some((o) => o.employee_id === req.params.id);
    if (inUse) {
      res.status(409).json({ error: 'Employee is referenced by existing mission orders' });
      return;
    }
    const next = store.employees.filter((e) => e.id !== req.params.id);
    if (next.length === store.employees.length) {
      res.status(404).json({ error: 'Employee not found' });
      return;
    }
    store.employees = next;
    saveStore(store);
    res.json({ ok: true });
  });

  // Vehicles
  api.get('/vehicles', (_req, res) => {
    const store = loadStore();
    const sorted = [...store.vehicles].sort((a, b) => a.model.localeCompare(b.model));
    res.json(sorted);
  });

  api.post('/vehicles', (req, res) => {
    const model = cleanText(req.body?.model);
    const registration_plate = cleanText(req.body?.registration_plate);
    if (!model || !registration_plate) {
      res.status(400).json({ error: 'Vehicle model and registration plate are required' });
      return;
    }
    const store = loadStore();
    const vehicle: Vehicle = {
      id: crypto.randomUUID(),
      model,
      registration_plate,
      created_at: new Date().toISOString(),
    };
    store.vehicles.push(vehicle);
    saveStore(store);
    res.status(201).json(vehicle);
  });

  api.put('/vehicles/:id', (req, res) => {
    const model = cleanText(req.body?.model);
    const registration_plate = cleanText(req.body?.registration_plate);
    if (!model || !registration_plate) {
      res.status(400).json({ error: 'Vehicle model and registration plate are required' });
      return;
    }
    const store = loadStore();
    const idx = store.vehicles.findIndex((v) => v.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Vehicle not found' });
      return;
    }
    store.vehicles[idx] = {
      ...store.vehicles[idx],
      model,
      registration_plate,
    };
    saveStore(store);
    res.json(store.vehicles[idx]);
  });

  api.delete('/vehicles/:id', (req, res) => {
    const store = loadStore();
    const inUse = store.mission_orders.some((o) => o.vehicle_id === req.params.id);
    if (inUse) {
      res.status(409).json({ error: 'Vehicle is referenced by existing mission orders' });
      return;
    }
    const next = store.vehicles.filter((v) => v.id !== req.params.id);
    if (next.length === store.vehicles.length) {
      res.status(404).json({ error: 'Vehicle not found' });
      return;
    }
    store.vehicles = next;
    saveStore(store);
    res.json({ ok: true });
  });

  // Projects
  api.get('/projects', (_req, res) => {
    const store = loadStore();
    const sorted = [...store.projects]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((p) => ({
        ...p,
        mission_count: store.mission_orders.filter((o) => o.project_id === p.id).length,
      }));
    res.json(sorted);
  });

  api.post('/projects', (req, res) => {
    const name = cleanText(req.body?.name);
    const description = cleanOptionalText(req.body?.description);
    if (!name) {
      res.status(400).json({ error: 'Project name is required' });
      return;
    }
    const store = loadStore();
    const project: Project = {
      id: crypto.randomUUID(),
      name,
      description,
      created_at: new Date().toISOString(),
    };
    store.projects.push(project);
    saveStore(store);
    res.status(201).json({ ...project, mission_count: 0 });
  });

  api.put('/projects/:id', (req, res) => {
    const name = cleanText(req.body?.name);
    const description = cleanOptionalText(req.body?.description);
    if (!name) {
      res.status(400).json({ error: 'Project name is required' });
      return;
    }
    const store = loadStore();
    const idx = store.projects.findIndex((p) => p.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }
    store.projects[idx] = {
      ...store.projects[idx],
      name,
      description,
    };
    saveStore(store);
    res.json({
      ...store.projects[idx],
      mission_count: store.mission_orders.filter((o) => o.project_id === req.params.id).length,
    });
  });

  api.delete('/projects/:id', (req, res) => {
    const store = loadStore();
    const next = store.projects.filter((p) => p.id !== req.params.id);
    if (next.length === store.projects.length) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }
    store.projects = next;
    store.mission_orders = store.mission_orders.map((o) =>
      o.project_id === req.params.id ? { ...o, project_id: null } : o
    );
    saveStore(store);
    res.json({ ok: true });
  });

  // Mission Orders
  api.get('/mission-orders', (req, res) => {
    const store = loadStore();
    const orderBy = req.query.orderBy === 'start_date' ? 'start_date' : 'created_at';
    const sorted = [...store.mission_orders].sort((a, b) =>
      b[orderBy].localeCompare(a[orderBy])
    );
    res.json(sorted.map((o) => hydrateMissionOrder(o, store)));
  });

  api.post('/mission-orders', (req, res) => {
    const employee_id = cleanText(req.body?.employee_id);
    const vehicle_id = cleanText(req.body?.vehicle_id);
    const project_id = cleanOptionalText(req.body?.project_id);
    const destination = cleanText(req.body?.destination);
    const start_date = cleanText(req.body?.start_date);
    const end_date = cleanText(req.body?.end_date);
    const status = req.body?.status ?? 'issued';
    const authorized_by = req.body?.authorized_by;
    const notes = cleanOptionalText(req.body?.notes);

    if (
      !employee_id ||
      !vehicle_id ||
      !destination ||
      !isValidDateStr(start_date) ||
      !isValidDateStr(end_date) ||
      end_date < start_date ||
      !isValidStatus(status) ||
      !isValidAuthorizedBy(authorized_by)
    ) {
      res.status(400).json({ error: 'Invalid mission order payload' });
      return;
    }

    const store = loadStore();
    if (!store.employees.some((e) => e.id === employee_id)) {
      res.status(400).json({ error: 'Invalid employee' });
      return;
    }
    if (!store.vehicles.some((v) => v.id === vehicle_id)) {
      res.status(400).json({ error: 'Invalid vehicle' });
      return;
    }
    if (project_id && !store.projects.some((p) => p.id === project_id)) {
      res.status(400).json({ error: 'Invalid project' });
      return;
    }

    const yearStr = String(new Date().getFullYear());
    const nextSeq = (store.order_sequences[yearStr] ?? 0) + 1;
    store.order_sequences[yearStr] = nextSeq;
    const order_number = `MO-${yearStr}-${String(nextSeq).padStart(3, '0')}`;

    const order: MissionOrder = {
      id: crypto.randomUUID(),
      order_number,
      employee_id,
      vehicle_id,
      project_id,
      destination,
      start_date,
      end_date,
      status,
      authorized_by: normalizeAuthorizedBy(authorized_by),
      notes,
      created_at: new Date().toISOString(),
    };

    store.mission_orders.push(order);
    saveStore(store);
    res.status(201).json(hydrateMissionOrder(order, store));
  });

  api.put('/mission-orders/:id', (req, res) => {
    const employee_id = cleanText(req.body?.employee_id);
    const vehicle_id = cleanText(req.body?.vehicle_id);
    const project_id = cleanOptionalText(req.body?.project_id);
    const destination = cleanText(req.body?.destination);
    const start_date = cleanText(req.body?.start_date);
    const end_date = cleanText(req.body?.end_date);
    const status = req.body?.status ?? 'issued';
    const authorized_by = req.body?.authorized_by;
    const notes = cleanOptionalText(req.body?.notes);

    if (
      !employee_id ||
      !vehicle_id ||
      !destination ||
      !isValidDateStr(start_date) ||
      !isValidDateStr(end_date) ||
      end_date < start_date ||
      !isValidStatus(status) ||
      !isValidAuthorizedBy(authorized_by)
    ) {
      res.status(400).json({ error: 'Invalid mission order payload' });
      return;
    }

    const store = loadStore();
    const idx = store.mission_orders.findIndex((o) => o.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Mission order not found' });
      return;
    }
    if (!store.employees.some((e) => e.id === employee_id)) {
      res.status(400).json({ error: 'Invalid employee' });
      return;
    }
    if (!store.vehicles.some((v) => v.id === vehicle_id)) {
      res.status(400).json({ error: 'Invalid vehicle' });
      return;
    }
    if (project_id && !store.projects.some((p) => p.id === project_id)) {
      res.status(400).json({ error: 'Invalid project' });
      return;
    }

    store.mission_orders[idx] = {
      ...store.mission_orders[idx],
      employee_id,
      vehicle_id,
      project_id,
      destination,
      start_date,
      end_date,
      status,
      authorized_by: normalizeAuthorizedBy(authorized_by),
      notes,
    };
    saveStore(store);
    res.json(hydrateMissionOrder(store.mission_orders[idx], store));
  });

  api.delete('/mission-orders/:id', (req, res) => {
    const store = loadStore();
    const next = store.mission_orders.filter((o) => o.id !== req.params.id);
    if (next.length === store.mission_orders.length) {
      res.status(404).json({ error: 'Mission order not found' });
      return;
    }
    store.mission_orders = next;
    saveStore(store);
    res.json({ ok: true });
  });

  return api;
}

async function startServer() {
  const app = express();
  app.use('/api', createApiRouter());

  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${port}`);
  });
}

startServer();
