import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { authService, UserProfile } from '../services/authService';
import { LogIn, LogOut, ShieldCheck, User, Sparkles, KeyRound, CheckCircle2, ChevronDown, Lock, Settings2, ExternalLink } from 'lucide-react';
import { Language, getT } from '../services/i18n';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: any) => void;
          renderButton: (parent: HTMLElement, options: any) => void;
          prompt: () => void;
        };
      };
    };
  }
}

interface GoogleAuthButtonProps {
  onOpenAISettings?: () => void;
  lang?: Language;
}

export const GoogleAuthButton: React.FC<GoogleAuthButtonProps> = ({ onOpenAISettings, lang = 'es' }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  
  const [googleClientId, setGoogleClientId] = useState<string>(() => {
    return (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || (process.env as any).GOOGLE_CLIENT_ID || '';
  });

  // Fetch client ID from VPS backend if not present in build
  useEffect(() => {
    if (!googleClientId) {
      fetch('/api/auth/google-client-id')
        .then(res => res.json())
        .then(data => {
          if (data && data.clientId) {
            setGoogleClientId(data.clientId);
          }
        })
        .catch(() => {});
    }
  }, [googleClientId]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isGsiLoaded, setIsGsiLoaded] = useState(false);

  const googleButtonContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return authService.subscribe((u) => setUser(u));
  }, []);

  // Listen for storage changes from OAuth callback popup
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'auramaster_user_profile' && e.newValue) {
        try {
          const userObj = JSON.parse(e.newValue);
          setUser(userObj);
          setIsLoginModalOpen(false);
        } catch (err) {}
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Check if Google SDK script is ready
  useEffect(() => {
    const checkGsi = () => {
      if (window.google?.accounts?.id) {
        setIsGsiLoaded(true);
      }
    };
    checkGsi();
    const interval = setInterval(checkGsi, 300);
    return () => clearInterval(interval);
  }, []);

  // Initialize and Render Real Google Button when modal opens
  useEffect(() => {
    if (!isLoginModalOpen) return;

    const effectiveClientId = googleClientId.trim();

    if (window.google?.accounts?.id && googleButtonContainerRef.current) {
      try {
        window.google.accounts.id.initialize({
          client_id: effectiveClientId,
          callback: async (response: any) => {
            if (response.credential) {
              setLoading(true);
              setError('');
              try {
                // Send REAL Google JWT Token to backend for cryptographic verification
                await authService.loginWithGoogleToken(response.credential);
                setIsLoginModalOpen(false);
              } catch (err: any) {
                setError(err.message || 'Error al autenticar token con Google');
              } finally {
                setLoading(false);
              }
            }
          },
          auto_select: false,
          cancel_on_tap_outside: true,
        });

        googleButtonContainerRef.current.innerHTML = '';
        window.google.accounts.id.renderButton(googleButtonContainerRef.current, {
          theme: 'filled_black',
          size: 'large',
          shape: 'pill',
          width: 320,
          text: 'signin_with',
          logo_alignment: 'left'
        });
      } catch (err) {
        console.warn('[Google GSI] Init warning:', err);
      }
    }
  }, [isLoginModalOpen, googleClientId, isGsiLoaded]);

  // Direct OAuth 2.0 Flow (matches user's /auth/google/callback redirect URI in Google Cloud Console)
  const handleLaunchDirectOAuth = () => {
    const clientId = googleClientId.trim();
    if (!clientId) {
      setError(
        lang === 'es'
          ? '⚠️ Falta configurar GOOGLE_CLIENT_ID en el archivo .env de tu servidor VPS.'
          : '⚠️ GOOGLE_CLIENT_ID is missing in your VPS .env file.'
      );
      return;
    }

    setLoading(true);
    setError('');
    const redirectUri = `${window.location.origin}/auth/google/callback`;
    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=openid%20email%20profile&prompt=select_account`;

    const width = 520;
    const height = 640;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    const popup = window.open(
      googleAuthUrl,
      'GoogleOAuthPopup',
      `width=${width},height=${height},left=${left},top=${top},status=no,toolbar=no,menubar=no,location=no`
    );

    const timer = setInterval(() => {
      if (popup && popup.closed) {
        clearInterval(timer);
        setLoading(false);
        // Refresh auth from localStorage
        const storedUser = localStorage.getItem('auramaster_user_profile');
        if (storedUser) {
          try {
            setUser(JSON.parse(storedUser));
            setIsLoginModalOpen(false);
          } catch (e) {}
        }
      }
    }, 500);
  };

  const handleLogout = async () => {
    await authService.logout();
    setIsDropdownOpen(false);
  };

  return (
    <div className="relative">
      {user ? (
        // Logged In User Pill
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 backdrop-blur-md shadow-lg transition-all cursor-pointer group"
          >
            {user.picture ? (
              <img
                src={user.picture}
                alt={user.name}
                className="w-5 h-5 rounded-full object-cover border border-cyan-400/50"
              />
            ) : (
              <div className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-300 flex items-center justify-center text-[10px] font-bold border border-cyan-500/40">
                {user.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex flex-col items-start text-left">
              <span className="text-[11px] font-bold text-slate-200 group-hover:text-white transition-colors truncate max-w-[110px]">
                {user.name}
              </span>
            </div>
            <ShieldCheck size={13} className="text-emerald-400 shrink-0" />
            <ChevronDown size={11} className="text-slate-400 group-hover:text-white transition-colors" />
          </button>

          {/* User Dropdown Menu */}
          {isDropdownOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setIsDropdownOpen(false)} />
              <div className="absolute right-0 top-full mt-2 w-64 z-50 p-2 bg-slate-900/95 border border-slate-700/90 rounded-2xl shadow-2xl backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-150">
                {/* User Info Header */}
                <div className="p-2.5 border-b border-slate-800 flex items-center gap-2.5">
                  {user.picture ? (
                    <img src={user.picture} alt="" className="w-8 h-8 rounded-full border border-cyan-400" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-cyan-500/20 text-cyan-300 flex items-center justify-center font-bold">
                      {user.name.charAt(0)}
                    </div>
                  )}
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-bold text-white truncate">{user.name}</span>
                    <span className="text-[10px] text-slate-400 truncate">{user.email}</span>
                  </div>
                </div>

                {/* Security Vault Status */}
                <div className="p-2.5 my-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2">
                  <Lock size={14} className="text-emerald-400 shrink-0" />
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-emerald-300">
                      {lang === 'es' ? 'Baúl Cifrado AES-256' : 'AES-256 Encrypted Vault'}
                    </span>
                    <span className="text-[9px] text-emerald-400/80">
                      {lang === 'es' ? 'Protegido por Google OAuth en VPS' : 'Secured by Google OAuth on VPS'}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-1 mt-1">
                  {onOpenAISettings && (
                    <button
                      onClick={() => {
                        setIsDropdownOpen(false);
                        onOpenAISettings();
                      }}
                      className="w-full p-2 rounded-xl flex items-center gap-2 text-slate-300 hover:text-white hover:bg-white/10 text-xs font-medium transition-all text-left cursor-pointer"
                    >
                      <KeyRound size={14} className="text-cyan-400" />
                      <span>{lang === 'es' ? 'Gestionar API Key en Baúl' : 'Manage API Key in Vault'}</span>
                    </button>
                  )}

                  <button
                    onClick={handleLogout}
                    className="w-full p-2 rounded-xl flex items-center gap-2 text-rose-300 hover:text-rose-200 hover:bg-rose-500/15 text-xs font-medium transition-all text-left cursor-pointer border-t border-slate-800/80 mt-1"
                  >
                    <LogOut size={14} className="text-rose-400" />
                    <span>{lang === 'es' ? 'Cerrar Sesión' : 'Sign Out'}</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      ) : (
        // Logged Out Button
        <button
          onClick={() => setIsLoginModalOpen(true)}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-slate-900 to-slate-800 hover:from-slate-800 hover:to-slate-700 border border-cyan-500/40 text-cyan-300 hover:text-white text-xs font-bold shadow-lg shadow-cyan-950/40 transition-all cursor-pointer group active:scale-95"
        >
          {/* Official Google Icon SVG */}
          <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
            <path
              fill="#EA4335"
              d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.4l3.7 2.9C6.5 7.4 9 5 12 5z"
            />
            <path
              fill="#4285F4"
              d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z"
            />
            <path
              fill="#FBBC05"
              d="M5.6 14.7c-.2-.7-.4-1.5-.4-2.3 0-.8.2-1.6.4-2.3L1.9 7.2C.7 9.6 0 12.2 0 15s.7 5.4 1.9 7.8l3.7-2.9z"
            />
            <path
              fill="#34A853"
              d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.3L1.9 16C3.7 19.8 7.5 23 12 23z"
            />
          </svg>
          <span>{lang === 'es' ? 'Acceso con Google OAuth' : 'Sign in with Google OAuth'}</span>
        </button>
      )}

      {/* Google Sign-In Modal (Centered via Portal) */}
      {isLoginModalOpen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-md p-6 bg-slate-900 border border-slate-700/90 rounded-3xl shadow-2xl relative text-slate-100 flex flex-col gap-5 m-auto max-h-[90vh] overflow-y-auto">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                  <Lock size={20} />
                </div>
                <div className="flex flex-col">
                  <h3 className="text-base font-bold text-white">
                    {lang === 'es' ? 'Autenticación con Google OAuth' : 'Google OAuth Authentication'}
                  </h3>
                  <span className="text-[11px] text-slate-400">
                    {lang === 'es' ? 'Acceso seguro y baúl cifrado AES-256' : 'Secure access & AES-256 encrypted vault'}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setIsLoginModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                ⚠️ {error}
              </div>
            )}

            {/* Official Google OAuth Sign-In Button Container */}
            <div className="flex flex-col items-center justify-center gap-3 py-3 bg-slate-950/80 border border-slate-800/80 rounded-2xl p-4">
              
              {/* Primary Direct OAuth 2.0 Button */}
              <button
                onClick={handleLaunchDirectOAuth}
                disabled={loading}
                className="w-full max-w-[320px] p-3 rounded-full bg-white hover:bg-slate-100 text-slate-900 font-bold text-sm flex items-center justify-center gap-3 shadow-xl transition-all cursor-pointer active:scale-95 disabled:opacity-50"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#EA4335"
                    d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.4l3.7 2.9C6.5 7.4 9 5 12 5z"
                  />
                  <path
                    fill="#4285F4"
                    d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.6 14.7c-.2-.7-.4-1.5-.4-2.3 0-.8.2-1.6.4-2.3L1.9 7.2C.7 9.6 0 12.2 0 15s.7 5.4 1.9 7.8l3.7-2.9z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.3L1.9 16C3.7 19.8 7.5 23 12 23z"
                  />
                </svg>
                <span>{loading ? 'Conectando con Google...' : 'Continuar con Google'}</span>
              </button>
              
              {loading && (
                <div className="flex items-center gap-2 text-xs text-cyan-400 font-semibold animate-pulse">
                  <span>Verificando credencial criptográfica de Google...</span>
                </div>
              )}
            </div>

            {/* Security Guarantee */}
            <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 text-[11px] text-slate-400 flex items-start gap-2.5">
              <ShieldCheck size={18} className="text-emerald-400 shrink-0 mt-0.5" />
              <span className="leading-relaxed">
                {lang === 'es'
                  ? 'Tus claves de API se cifran mediante AES-256-GCM en el VPS ligado de forma única a tu cuenta de Google.'
                  : 'Your API Keys are encrypted via AES-256-GCM on the VPS uniquely tied to your Google account.'}
              </span>
            </div>

          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
