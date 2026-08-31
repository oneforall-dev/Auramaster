export interface UserProfile {
  id: string;
  email: string;
  name: string;
  picture?: string;
  role: 'user' | 'admin';
}

const TOKEN_KEY = 'auramaster_session_token';
const USER_KEY = 'auramaster_user_profile';

type AuthListener = (user: UserProfile | null) => void;
const listeners: Set<AuthListener> = new Set();

function notifyListeners(user: UserProfile | null) {
  listeners.forEach(l => l(user));
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
    localStorage.setItem(TOKEN_KEY, data.sessionToken);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    notifyListeners(data.user);
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
    localStorage.setItem(TOKEN_KEY, data.sessionToken);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    notifyListeners(data.user);
    return data.user;
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
