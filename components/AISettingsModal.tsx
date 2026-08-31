import React, { useState, useEffect } from 'react';
import { X, Key, Cpu, CheckCircle2, AlertCircle, Eye, EyeOff, Sparkles, ShieldCheck, RefreshCw, Trash2, Lock, UserCheck } from 'lucide-react';
import { AIProviderConfig, AIProvider } from '../types';
import { DEFAULT_MODELS, getSecureVaultConfig, saveSecureVaultConfig, deleteSecureVaultConfig, testSecureVaultConnection, SecureVaultStatus } from '../services/aiService';
import { authService, UserProfile } from '../services/authService';

interface AISettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigSaved: (config: AIProviderConfig | null) => void;
}

export const AISettingsModal: React.FC<AISettingsModalProps> = ({ isOpen, onClose, onConfigSaved }) => {
  const [provider, setProvider] = useState<AIProvider>('gemini');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [vaultStatus, setVaultStatus] = useState<SecureVaultStatus | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    if (isOpen) {
      const u = authService.getUser();
      setUser(u);

      getSecureVaultConfig().then(status => {
        setVaultStatus(status);
        if (status && status.configured) {
          setProvider(status.provider || 'gemini');
          setModel(status.model || DEFAULT_MODELS[status.provider] || '');
          setBaseUrl(status.baseUrl || '');
        } else {
          setProvider('gemini');
          setModel(DEFAULT_MODELS.gemini);
        }
      });

      setTestResult(null);
      setApiKey('');
    }
  }, [isOpen]);

  const handleProviderChange = (newProvider: AIProvider) => {
    setProvider(newProvider);
    setModel(DEFAULT_MODELS[newProvider] || '');
    setTestResult(null);
    if (newProvider === 'custom' && !baseUrl) {
      setBaseUrl('http://localhost:11434/v1');
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);

    // If typing a new key, save and test
    if (apiKey.trim()) {
      try {
        await saveSecureVaultConfig({
          provider,
          model: model || DEFAULT_MODELS[provider],
          apiKey: apiKey.trim(),
          baseUrl: provider === 'custom' ? baseUrl : undefined
        });
      } catch (err: any) {
        setTesting(false);
        setTestResult({ success: false, message: err.message || 'Error guardando clave' });
        return;
      }
    }

    const result = await testSecureVaultConnection();
    setTesting(false);
    setTestResult(result);
  };

  const handleSave = async () => {
    if (!apiKey.trim() && (!vaultStatus || !vaultStatus.configured)) {
      alert('Por favor ingresa una API Key válida.');
      return;
    }

    setSaving(true);
    try {
      if (apiKey.trim()) {
        const res = await saveSecureVaultConfig({
          provider,
          model: model || DEFAULT_MODELS[provider],
          apiKey: apiKey.trim(),
          baseUrl: provider === 'custom' ? baseUrl : undefined
        });
        if (res.config) setVaultStatus(res.config);
      }

      onConfigSaved({
        provider,
        apiKey: 'encrypted_in_vps',
        model: model || DEFAULT_MODELS[provider],
        baseUrl
      });
      onClose();
    } catch (e: any) {
      alert(e.message || 'Error al resguardar la clave en el baúl');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (confirm('¿Deseas eliminar permanentemente tu API Key del baúl cifrado en el VPS?')) {
      await deleteSecureVaultConfig();
      setVaultStatus(null);
      setApiKey('');
      setTestResult(null);
      onConfigSaved(null);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/90 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-cyan-500/10 rounded-2xl border border-cyan-500/20 text-cyan-400 shadow-lg shadow-cyan-500/10">
              <Lock size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Baúl Cifrado de IA (VPS)
                <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full">
                  AES-256-GCM
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Tu clave se almacena cifrada en el servidor y nunca se expone al cliente.
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* User Account Info Pill */}
        <div className="px-5 pt-4">
          <div className="p-3 rounded-2xl bg-slate-950/90 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <UserCheck size={16} className="text-cyan-400 shrink-0" />
              <div className="flex flex-col">
                <span className="text-[11px] font-bold text-slate-200">
                  {user ? user.name : 'Usuario Autenticado'}
                </span>
                <span className="text-[10px] text-slate-400 font-mono truncate max-w-[240px]">
                  {user ? user.email : 'Autenticado vía Google OAuth'}
                </span>
              </div>
            </div>
            {vaultStatus?.configured && (
              <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono font-bold">
                CLAVE CIFRADA
              </span>
            )}
          </div>
        </div>

        {/* Body Form */}
        <div className="p-5 flex flex-col gap-4 overflow-y-auto max-h-[60vh]">
          
          {/* Provider Selection */}
          <div>
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-2">
              Proveedor de IA
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(['gemini', 'openai', 'groq', 'anthropic'] as AIProvider[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => handleProviderChange(p)}
                  className={`p-2.5 rounded-xl border text-xs font-bold capitalize flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    provider === p 
                      ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200 shadow-md shadow-cyan-950/50' 
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-white'
                  }`}
                >
                  <Cpu size={15} />
                  <span>{p === 'gemini' ? 'Google Gemini' : p}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Model Name */}
          <div>
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-1.5">
              Modelo
            </label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="e.g. gemini-2.5-flash, gpt-4o-mini"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 font-mono transition-colors"
            />
          </div>

          {/* API Key Input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                {vaultStatus?.configured ? 'Nueva API Key (opcional)' : 'API Key'}
              </label>
              {vaultStatus?.maskedKey && (
                <span className="text-[10px] text-emerald-400 font-mono">
                  Actual: {vaultStatus.maskedKey}
                </span>
              )}
            </div>
            
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={vaultStatus?.configured ? 'Dejar en blanco para mantener la clave actual' : 'Pega tu clave (AIzaSy... o sk-...) aquí'}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-3.5 pr-10 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 font-mono transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            <p className="text-[10px] text-slate-500 mt-1.5 leading-relaxed">
              🔒 Tu clave se cifra con <strong>AES-256-GCM</strong> en el VPS usando un salt derivado de tu cuenta de Google. Las peticiones de masterización se procesan en el backend por proxy seguro.
            </p>
          </div>

          {/* Test Status Feedback */}
          {testResult && (
            <div className={`p-3 rounded-xl border flex items-start gap-2.5 text-xs animate-in fade-in ${
              testResult.success 
                ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300' 
                : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
            }`}>
              {testResult.success ? <CheckCircle2 size={16} className="shrink-0 mt-0.5" /> : <AlertCircle size={16} className="shrink-0 mt-0.5" />}
              <span className="leading-snug">{testResult.message}</span>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="p-5 border-t border-slate-800 bg-slate-950/60 flex flex-wrap items-center justify-between gap-3">
          {vaultStatus?.configured ? (
            <button
              type="button"
              onClick={handleRemove}
              className="px-3.5 py-2 rounded-xl text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/30 border border-transparent text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Trash2 size={14} />
              <span>Eliminar Clave</span>
            </button>
          ) : <div />}

          <div className="flex items-center gap-2.5 ml-auto">
            <button
              type="button"
              onClick={handleTest}
              disabled={testing}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
            >
              {testing ? <RefreshCw size={13} className="animate-spin" /> : <Sparkles size={13} />}
              <span>{testing ? 'Verificando...' : 'Probar Conexión'}</span>
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-400 hover:from-cyan-400 hover:to-cyan-300 text-black text-xs font-extrabold flex items-center gap-1.5 shadow-lg shadow-cyan-500/20 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
            >
              <ShieldCheck size={14} />
              <span>{saving ? 'Cifrando...' : 'Guardar y Cifrar'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
