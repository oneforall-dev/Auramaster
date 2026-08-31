import fs from 'fs';
import path from 'path';

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
  role: 'user' | 'admin';
  createdAt: number;
  lastLogin: number;
  loginCount?: number;
  provider?: string;
  ip?: string;
  userAgent?: string;
}

const DATA_DIR = path.resolve(process.cwd(), '.data');
const VAULT_FILE = path.join(DATA_DIR, 'user_vault.enc.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const CSV_FILE = path.join(DATA_DIR, 'users_registry.csv');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
  }
}

// In-Memory Cache synced to persistent files
let vaultCache: Record<string, StoredUserCredential> = {};
let usersCache: Record<string, UserProfile> = {};

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
updateCsvRegistry();

export const storage = {
  // User Email & Account Management
  upsertUser(user: UserProfile, meta?: { ip?: string; userAgent?: string }): UserProfile {
    const existing = usersCache[user.id];
    const now = Date.now();

    const updatedUser: UserProfile = {
      ...user,
      createdAt: existing ? existing.createdAt : (user.createdAt || now),
      lastLogin: now,
      loginCount: (existing?.loginCount || 0) + 1,
      provider: user.provider || (user.id.startsWith('google_') ? 'Google OAuth' : 'Studio Demo'),
      ip: meta?.ip || user.ip || existing?.ip,
      userAgent: meta?.userAgent || user.userAgent || existing?.userAgent
    };

    usersCache[user.id] = updatedUser;
    saveUsers();
    return updatedUser;
  },

  getUser(userId: string): UserProfile | null {
    return usersCache[userId] || null;
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
  }
};
