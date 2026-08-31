import React, { useState, useEffect, useRef } from 'react';
import { authService, UserProfile } from '../services/authService';
import { Sparkles, ShieldCheck, Lock, Activity, Cpu, Sliders, Music, Globe, CheckCircle2, ChevronRight, Zap } from 'lucide-react';
import { Language, LANGUAGES, getT } from '../services/i18n';

interface AuthGateProps {
  lang: Language;
  onLanguageChange: (lang: Language) => void;
  onLoginSuccess?: (user: UserProfile) => void;
}

export const AuthGate: React.FC<AuthGateProps> = ({ lang, onLanguageChange, onLoginSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const googleButtonContainerRef = useRef<HTMLDivElement>(null);

  const t = getT(lang);

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

  // Listen for storage changes from OAuth callback popup
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'auramaster_user_profile' && e.newValue) {
        try {
          const userObj = JSON.parse(e.newValue);
          if (onLoginSuccess) onLoginSuccess(userObj);
        } catch (err) {}
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [onLoginSuccess]);

  // Initialize Google Identity Services (GSI)
  useEffect(() => {
    if (googleClientId && window.google?.accounts?.id && googleButtonContainerRef.current) {
      try {
        window.google.accounts.id.initialize({
          client_id: googleClientId.trim(),
          callback: async (response: any) => {
            if (response.credential) {
              setLoading(true);
              setError('');
              try {
                const loggedUser = await authService.loginWithGoogleToken(response.credential);
                if (onLoginSuccess) onLoginSuccess(loggedUser);
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
        console.warn('[Google GSI AuthGate] Init warning:', err);
      }
    }
  }, [googleClientId, onLoginSuccess]);

  // Launch Direct Google OAuth 2.0 Flow
  const handleLaunchGoogleOAuth = () => {
    const effectiveClientId = googleClientId.trim();
    if (!effectiveClientId) {
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
    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(effectiveClientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=openid%20email%20profile&prompt=select_account`;

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
        const storedUser = authService.getUser();
        if (storedUser && onLoginSuccess) {
          onLoginSuccess(storedUser);
        }
      }
    }, 500);
  };

  return (
    <div className="min-h-screen w-full bg-[#030712] text-slate-100 flex flex-col justify-between relative overflow-hidden font-sans select-none">
      {/* Ambient background glow effects */}
      <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[900px] h-[600px] bg-gradient-to-b from-cyan-600/15 via-indigo-600/10 to-transparent blur-3xl pointer-events-none rounded-full" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-indigo-900/15 blur-3xl pointer-events-none rounded-full" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-cyan-900/15 blur-3xl pointer-events-none rounded-full" />

      {/* Top Navbar */}
      <header className="relative z-10 w-full px-6 py-5 flex items-center justify-between max-w-7xl mx-auto border-b border-slate-800/40">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center text-white shadow-xl shadow-cyan-500/20 border border-cyan-400/30">
            <Sparkles size={22} className="animate-pulse" />
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-black tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
              AuraMaster <span className="text-cyan-400 font-mono text-sm">AI 4.0</span>
            </span>
            <span className="text-[10px] text-slate-500 font-mono tracking-wider">NEURAL AUDIO MASTERING</span>
          </div>
        </div>

        {/* Language selector */}
        <div className="flex items-center gap-2">
          <Globe size={14} className="text-slate-400" />
          <select
            value={lang}
            onChange={(e) => onLanguageChange(e.target.value as Language)}
            aria-label="Seleccionar idioma"
            className="bg-slate-900/80 border border-slate-700/60 text-slate-300 text-xs font-semibold rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-cyan-500 cursor-pointer"
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.flag} {l.label}
              </option>
            ))}
          </select>
        </div>
      </header>

      {/* Main Hero & Login Box */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-4 sm:p-6 my-auto">
        <div className="w-full max-w-md bg-slate-900/90 border border-slate-700/80 rounded-3xl p-7 sm:p-8 backdrop-blur-2xl shadow-2xl shadow-cyan-950/40 flex flex-col gap-6 relative animate-in fade-in zoom-in-95 duration-300">
          
          {/* Hero Header */}
          <div className="flex flex-col items-center text-center gap-2">
            <div className="p-3.5 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-indigo-500/10 border border-cyan-500/30 text-cyan-300 shadow-lg shadow-cyan-500/10 mb-1">
              <Lock size={28} className="text-cyan-400" />
            </div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">
              {lang === 'es' ? 'Ingreso al Estudio' : 'Studio Access'}
            </h1>
            <p className="text-xs text-slate-400 leading-relaxed max-w-[320px]">
              {lang === 'es'
                ? 'Autentícate con Google OAuth para acceder a la estación de mastering y proteger tu baúl de API Keys en el VPS.'
                : 'Authenticate with Google OAuth to access the mastering workstation and protect your API Key vault on the VPS.'}
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs text-center">
              ⚠️ {error}
            </div>
          )}

          {/* Primary Action: Official Google Login Button */}
          <div className="flex flex-col items-center gap-3">
            <button
              onClick={handleLaunchGoogleOAuth}
              disabled={loading}
              className="w-full py-3.5 px-4 rounded-2xl bg-white hover:bg-slate-100 text-slate-900 font-extrabold text-sm flex items-center justify-center gap-3 shadow-xl shadow-cyan-950/30 transition-all cursor-pointer active:scale-95 disabled:opacity-50 group"
            >
              {/* Google Icon */}
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
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
              <span>{loading ? (lang === 'es' ? 'Conectando...' : 'Connecting...') : (lang === 'es' ? 'Iniciar Sesión con Google' : 'Sign in with Google')}</span>
              <ChevronRight size={16} className="text-slate-400 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>

          {/* Security Features Badges */}
          <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-slate-800/80">
            <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-start gap-2">
              <ShieldCheck size={16} className="text-emerald-400 shrink-0 mt-0.5" />
              <div className="flex flex-col">
                <span className="text-[11px] font-bold text-slate-200">AES-256-GCM</span>
                <span className="text-[9px] text-slate-400">
                  {lang === 'es' ? 'Baúl Cifrado en VPS' : 'Encrypted VPS Vault'}
                </span>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-start gap-2">
              <Cpu size={16} className="text-cyan-400 shrink-0 mt-0.5" />
              <div className="flex flex-col">
                <span className="text-[11px] font-bold text-slate-200">Motor IA 4.0</span>
                <span className="text-[9px] text-slate-400">
                  {lang === 'es' ? 'Gemini / OpenAI / Groq' : 'Gemini / OpenAI / Groq'}
                </span>
              </div>
            </div>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full px-6 py-4 text-center text-xs text-slate-500 font-mono max-w-7xl mx-auto border-t border-slate-800/30">
        AuraMaster AI DAW • 64-bit Audio DSP & Neural Mastering • 2026 Production Release
      </footer>
    </div>
  );
};
