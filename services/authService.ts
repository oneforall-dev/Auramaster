export interface UserProfile {
  id: string;
  email: string;
  name: string;
  picture?: string;
  role: 'user' | 'admin';
  plan?: 'free' | 'payg' | 'pro_monthly' | 'pro_annual';
  credits?: number;
  freeGenerationsRemaining?: number;
  subscriptionStatus?: 'inactive' | 'active' | 'expired';
  subscriptionExpiresAt?: number;
}

const TOKEN_KEY = 'auramaster_session_token';
const USER_KEY = 'auramaster_user_profile';

type AuthListener = (user: UserProfile | null) => void;
const listeners: Set<AuthListener> = new Set();

function notifyListeners(user: UserProfile | null) {
  listeners.forEach(l => l(user));
}

function storeSession(sessionToken: string, user: UserProfile) {
  localStorage.setItem(TOKEN_KEY, sessionToken);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  notifyListeners(user);
}

export const authService = {
  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  },

  getUser(): UserProfile | null {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  isAuthenticated(): boolean {
    return !!this.getToken() && !!this.getUser();
  },

  async loginWithGoogleToken(idToken: string): Promise<UserProfile> {
    const res = await fetch('/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Error al autenticar con Google');
    }

    const data = await res.json();
    storeSession(data.sessionToken, data.user);
    return data.user;
  },

  async loginWithDevAccount(email = 'studio.engineer@auramaster.ai', name = 'Google Audio Pro'): Promise<UserProfile> {
    const res = await fetch('/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isDevLogin: true, email, name })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Error al iniciar sesión');
    }

    const data = await res.json();
    storeSession(data.sessionToken, data.user);
    return data.user;
  },

  completeOAuthSession(sessionToken: string, user: UserProfile): UserProfile {
    storeSession(sessionToken, user);
    return user;
  },

  updateStoredUser(user: UserProfile): UserProfile {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    notifyListeners(user);
    return user;
  },

  async refreshProfile(): Promise<UserProfile | null> {
    const token = this.getToken();
    if (!token) return null;
    const res = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return null;
    const data = await res.json();
    return data.user ? this.updateStoredUser(data.user) : null;
  },

  async getGoogleAuthorizationUrl(): Promise<string> {
    const res = await fetch('/api/auth/google/start', { cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.authorizationUrl) throw new Error(data.error || 'No se pudo iniciar Google OAuth');
    return data.authorizationUrl;
  },

  async logout(): Promise<void> {
    const token = this.getToken();
    if (token) {
      fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      }).catch(() => {});
    }

    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    notifyListeners(null);
  },

  subscribe(listener: AuthListener): () => void {
    listeners.add(listener);
    listener(this.getUser());
    return () => {
      listeners.delete(listener);
    };
  }
};
