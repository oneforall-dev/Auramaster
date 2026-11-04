import fs from 'fs';
import path from 'path';
import { CommercialConfig, defaultCommercialConfig, normalizeCommercialConfig } from './commercialConfig';
import { calculateRenewalExpiry, fallbackPlanAfterExpiry } from '../shared/subscriptionLifecycle';
export type { AnnouncementConfig, CommercialConfig, CommercialPlanConfig } from './commercialConfig';

export interface StoredUserCredential {
  userId: string;
  email?: string;
  provider: 'gemini' | 'openai' | 'groq' | 'anthropic' | 'custom';
  model: string;
  baseUrl?: string;
  encryptedKey: string;
  iv: string;
  authTag: string;
  maskedKey: string;
  updatedAt: number;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  picture?: string;
  role: UserRole;
  createdAt: number;
  lastLogin: number;
  loginCount?: number;
  provider?: string;
  ip?: string;
  userAgent?: string;
  plan?: AccountPlan;
  credits?: number;
  freeGenerationsRemaining?: number;
  subscriptionStatus?: 'inactive' | 'active' | 'expired';
  subscriptionExpiresAt?: number;
}

export type UserRole = 'user' | 'admin' | 'owner';
export type AccountPlan = 'free' | 'payg' | 'pro_monthly' | 'pro_annual';

export interface PaymentTransaction {
  reference: string;
  userId: string;
  plan: Exclude<AccountPlan, 'free'>;
  quantity: number;
  expectedAmount: number;
  currency: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'VOIDED';
  paymentLink?: string;
  checkoutUrl?: string;
  paymentId?: string;
  notificationIds: string[];
  createdAt: number;
  updatedAt: number;
  appliedAt?: number;
  reversedAt?: number;
}

export interface UsageTransaction {
  operationId: string;
  userId: string;
  count: number;
  createdAt: number;
}

const DATA_DIR = path.resolve(process.cwd(), '.data');
const VAULT_FILE = path.join(DATA_DIR, 'user_vault.enc.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const CSV_FILE = path.join(DATA_DIR, 'users_registry.csv');
const PAYMENTS_FILE = path.join(DATA_DIR, 'payment_transactions.json');
const USAGE_FILE = path.join(DATA_DIR, 'usage_transactions.json');
const COMMERCIAL_CONFIG_FILE = path.join(DATA_DIR, 'commercial_config.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
  }
}

// In-Memory Cache synced to persistent files
let vaultCache: Record<string, StoredUserCredential> = {};
let usersCache: Record<string, UserProfile> = {};
let paymentsCache: Record<string, PaymentTransaction> = {};
let usageCache: Record<string, UsageTransaction> = {};
let commercialConfigCache: CommercialConfig = defaultCommercialConfig();

function loadVault() {
  ensureDataDir();
  try {
    if (fs.existsSync(VAULT_FILE)) {
      const raw = fs.readFileSync(VAULT_FILE, 'utf8');
      vaultCache = JSON.parse(raw);
    }
  } catch (e) {
    console.error('[Storage] Error reading vault file:', e);
    vaultCache = {};
  }
}

function saveVault() {
  ensureDataDir();
  try {
    fs.writeFileSync(VAULT_FILE, JSON.stringify(vaultCache, null, 2), { mode: 0o600 });
  } catch (e) {
    console.error('[Storage] Error writing vault file:', e);
  }
}

function loadUsers() {
  ensureDataDir();
  try {
    if (fs.existsSync(USERS_FILE)) {
      const raw = fs.readFileSync(USERS_FILE, 'utf8');
      usersCache = JSON.parse(raw);
    }
  } catch (e) {
    usersCache = {};
  }
}

function saveUsers() {
  ensureDataDir();
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(usersCache, null, 2), { mode: 0o600 });
    updateCsvRegistry();
  } catch (e) {
    console.error('[Storage] Error writing users file:', e);
  }
}

function loadJsonRecord<T>(filePath: string): Record<string, T> {
  ensureDataDir();
  try {
    if (fs.existsSync(filePath)) return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    console.error(`[Storage] Error reading ${path.basename(filePath)}:`, e);
  }
  return {};
}

function saveJsonRecord<T>(filePath: string, value: Record<string, T>) {
  ensureDataDir();
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), { mode: 0o600 });
}

function normalizeAccount(user: UserProfile): UserProfile {
  const now = Date.now();
  const expired = Boolean(user.subscriptionExpiresAt && user.subscriptionExpiresAt <= now);
  const proPlan = user.plan === 'pro_monthly' || user.plan === 'pro_annual';
  const email = String(user.email || '').trim().toLowerCase();
  const ownerEmails = (process.env.OWNER_EMAILS || '').split(',').map(value => value.trim().toLowerCase()).filter(Boolean);
  const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(value => value.trim().toLowerCase()).filter(Boolean);
  const role: UserRole = ownerEmails.includes(email) ? 'owner' : adminEmails.includes(email) ? 'admin' : (user.role || 'user');
  return {
    ...user,
    role,
    plan: expired && proPlan ? fallbackPlanAfterExpiry(user.credits) : (user.plan || 'free'),
    credits: Math.max(0, user.credits || 0),
    freeGenerationsRemaining: Math.max(0, user.freeGenerationsRemaining ?? commercialConfigCache.freeGenerations),
    subscriptionStatus: expired && proPlan ? 'expired' : (user.subscriptionStatus || 'inactive')
  };
}

function expireFinishedSubscriptions(): void {
  let changed = false;
  for (const [userId, user] of Object.entries(usersCache)) {
    const normalized = normalizeAccount(user);
    if (JSON.stringify(normalized) !== JSON.stringify(user)) {
      usersCache[userId] = normalized;
      changed = true;
    }
  }
  if (changed) saveUsers();
}

/**
 * Generates and synchronizes a clean CSV file with all registered user emails
 */
function updateCsvRegistry() {
  try {
    const users = Object.values(usersCache).sort((a, b) => (b.lastLogin || 0) - (a.lastLogin || 0));
    const headers = 'ID,Email,Nombre,Fecha Registro (UTC),Ultimo Acceso (UTC),Total Inicios de Sesion,Proveedor,IP\n';
    
    const rows = users.map(u => {
      const regDate = new Date(u.createdAt || Date.now()).toISOString();
      const lastLoginDate = new Date(u.lastLogin || Date.now()).toISOString();
      const cleanName = (u.name || '').replace(/,/g, ' ').replace(/"/g, '""');
      const cleanEmail = (u.email || '').replace(/,/g, '');
      const count = u.loginCount || 1;
      const provider = u.provider || (u.id.startsWith('google_') ? 'Google OAuth' : 'Studio Demo');
      const ip = (u.ip || '127.0.0.1').replace(/,/g, '');

      return `"${u.id}","${cleanEmail}","${cleanName}","${regDate}","${lastLoginDate}",${count},"${provider}","${ip}"`;
    }).join('\n');

    fs.writeFileSync(CSV_FILE, headers + rows, { encoding: 'utf8', mode: 0o600 });
  } catch (e) {
    console.error('[Storage] Error writing CSV registry:', e);
  }
}

loadVault();
loadUsers();
paymentsCache = loadJsonRecord<PaymentTransaction>(PAYMENTS_FILE);
usageCache = loadJsonRecord<UsageTransaction>(USAGE_FILE);
try {
  if (fs.existsSync(COMMERCIAL_CONFIG_FILE)) {
    commercialConfigCache = normalizeCommercialConfig(JSON.parse(fs.readFileSync(COMMERCIAL_CONFIG_FILE, 'utf8')));
  }
} catch (e) {
  console.error('[Storage] Error reading commercial config:', e);
  commercialConfigCache = defaultCommercialConfig();
}
expireFinishedSubscriptions();
const subscriptionExpiryTimer = setInterval(expireFinishedSubscriptions, 60_000);
subscriptionExpiryTimer.unref();
updateCsvRegistry();

export const storage = {
  // User Email & Account Management
  upsertUser(user: UserProfile, meta?: { ip?: string; userAgent?: string }): UserProfile {
    const existing = usersCache[user.id];
    const now = Date.now();

    const updatedUser: UserProfile = normalizeAccount({
      ...existing,
      ...user,
      createdAt: existing ? existing.createdAt : (user.createdAt || now),
      lastLogin: now,
      loginCount: (existing?.loginCount || 0) + 1,
      provider: user.provider || (user.id.startsWith('google_') ? 'Google OAuth' : 'Studio Demo'),
      ip: meta?.ip || user.ip || existing?.ip,
      userAgent: meta?.userAgent || user.userAgent || existing?.userAgent
    });

    usersCache[user.id] = updatedUser;
    saveUsers();
    return updatedUser;
  },

  getUser(userId: string): UserProfile | null {
    const user = usersCache[userId];
    if (!user) return null;
    const normalized = normalizeAccount(user);
    if (JSON.stringify(normalized) !== JSON.stringify(user)) {
      usersCache[userId] = normalized;
      saveUsers();
    }
    return normalized;
  },

  getAllUsers(): UserProfile[] {
    return Object.values(usersCache).sort((a, b) => (b.lastLogin || 0) - (a.lastLogin || 0));
  },

  getCsvFilePath(): string {
    return CSV_FILE;
  },

  getUsersJsonPath(): string {
    return USERS_FILE;
  },

  // Encrypted Credentials Vault
  saveCredential(cred: StoredUserCredential): void {
    vaultCache[cred.userId] = cred;
    saveVault();
  },

  getCredential(userId: string): StoredUserCredential | null {
    return vaultCache[userId] || null;
  },

  deleteCredential(userId: string): boolean {
    if (vaultCache[userId]) {
      delete vaultCache[userId];
      saveVault();
      return true;
    }
    return false;
  },

  isProUser(userId: string): boolean {
    const user = this.getUser(userId);
    return Boolean(user && (user.role === 'owner' || ((user.plan === 'pro_monthly' || user.plan === 'pro_annual') && user.subscriptionStatus === 'active')));
  },

  isOwnerUser(userId: string): boolean {
    return this.getUser(userId)?.role === 'owner';
  },

  isAdminUser(userId: string): boolean {
    const role = this.getUser(userId)?.role;
    return role === 'admin' || role === 'owner';
  },

  getCommercialConfig(): CommercialConfig {
    return JSON.parse(JSON.stringify(commercialConfigCache));
  },

  updateCommercialConfig(input: Partial<CommercialConfig>): CommercialConfig {
    commercialConfigCache = normalizeCommercialConfig({ ...input, updatedAt: Date.now() });
    ensureDataDir();
    fs.writeFileSync(COMMERCIAL_CONFIG_FILE, JSON.stringify(commercialConfigCache, null, 2), { mode: 0o600 });
    return this.getCommercialConfig();
  },

  createPaymentTransaction(tx: PaymentTransaction): void {
    paymentsCache[tx.reference] = tx;
    saveJsonRecord(PAYMENTS_FILE, paymentsCache);
  },

  findPayment(referenceOrLink: string): PaymentTransaction | null {
    return paymentsCache[referenceOrLink] || Object.values(paymentsCache).find(tx => tx.paymentLink === referenceOrLink) || null;
  },

  recordPaymentEvent(referenceOrLink: string, event: {
    notificationId: string;
    type: string;
    paymentId?: string;
    amount?: number;
    currency?: string;
  }): { duplicate: boolean; transaction: PaymentTransaction; user: UserProfile | null } {
    const tx = this.findPayment(referenceOrLink);
    if (!tx) throw new Error('Transacción de AuraMaster no encontrada');
    if (tx.notificationIds.includes(event.notificationId)) {
      return { duplicate: true, transaction: tx, user: this.getUser(tx.userId) };
    }

    if (event.amount !== undefined && Math.abs(event.amount - tx.expectedAmount) > 0.001) {
      throw new Error('El monto del webhook no coincide con la orden');
    }
    if (event.currency && event.currency.toUpperCase() !== tx.currency.toUpperCase()) {
      throw new Error('La moneda del webhook no coincide con la orden');
    }

    tx.notificationIds.push(event.notificationId);
    tx.paymentId = event.paymentId || tx.paymentId;
    tx.updatedAt = Date.now();

    let user = this.getUser(tx.userId);
    if (event.type === 'SALE_APPROVED' && !tx.appliedAt) {
      if (!user) throw new Error('Usuario de la orden no encontrado');
      const now = Date.now();
      if (tx.plan === 'payg') {
        user = normalizeAccount({ ...user, plan: user.plan?.startsWith('pro_') ? user.plan : 'payg', credits: (user.credits || 0) + tx.quantity });
      } else {
        const durationDays = tx.plan === 'pro_annual' ? 365 : 30;
        user = normalizeAccount({
          ...user,
          plan: tx.plan,
          subscriptionStatus: 'active',
          subscriptionExpiresAt: calculateRenewalExpiry(user.subscriptionExpiresAt, durationDays, now)
        });
      }
      usersCache[user.id] = user;
      saveUsers();
      tx.status = 'APPROVED';
      tx.appliedAt = now;
    } else if (event.type === 'SALE_REJECTED') {
      tx.status = 'REJECTED';
    } else if (event.type === 'VOID_APPROVED' && tx.appliedAt && !tx.reversedAt) {
      if (!user) throw new Error('Usuario de la orden no encontrado');
      const now = Date.now();
      if (tx.plan === 'payg') {
        user = normalizeAccount({ ...user, credits: Math.max(0, (user.credits || 0) - tx.quantity) });
      } else {
        const durationDays = tx.plan === 'pro_annual' ? 365 : 30;
        const remainingExpiry = Math.max(0, (user.subscriptionExpiresAt || 0) - durationDays * 24 * 60 * 60 * 1000);
        user = normalizeAccount({
          ...user,
          plan: remainingExpiry > now ? user.plan : 'free',
          subscriptionStatus: remainingExpiry > now ? 'active' : 'inactive',
          subscriptionExpiresAt: remainingExpiry || undefined
        });
      }
      usersCache[user.id] = user;
      saveUsers();
      tx.status = 'VOIDED';
      tx.reversedAt = now;
    }

    paymentsCache[tx.reference] = tx;
    saveJsonRecord(PAYMENTS_FILE, paymentsCache);
    return { duplicate: false, transaction: tx, user };
  },

  consumeGenerations(userId: string, count: number, operationId: string): UserProfile {
    if (usageCache[operationId]) {
      const existing = this.getUser(userId);
      if (!existing) throw new Error('Usuario no encontrado');
      return existing;
    }
    const user = this.getUser(userId);
    if (!user) throw new Error('Usuario no encontrado');
    if (!Number.isInteger(count) || count < 1 || count > 200) throw new Error('Cantidad de generaciones inválida');

    let updated = user;
    if (this.isProUser(userId)) {
      updated = user;
    } else if ((user.credits || 0) >= count) {
      updated = { ...user, credits: (user.credits || 0) - count };
    } else if ((user.freeGenerationsRemaining || 0) >= count) {
      updated = { ...user, freeGenerationsRemaining: (user.freeGenerationsRemaining || 0) - count };
    } else {
      throw new Error('No tienes suficientes generaciones. Elige Pay As You Go o Pro.');
    }

    usersCache[userId] = normalizeAccount(updated);
    usageCache[operationId] = { operationId, userId, count, createdAt: Date.now() };
    saveUsers();
    saveJsonRecord(USAGE_FILE, usageCache);
    return usersCache[userId];
  }
};
