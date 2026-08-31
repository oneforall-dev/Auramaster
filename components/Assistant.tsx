import React, { useState, useEffect } from 'react';
import { Sparkles, Loader2, Settings, KeyRound, ArrowRight, Zap, Radio, CheckCircle2, ChevronDown, ChevronUp, Lock } from 'lucide-react';
import { getSecureVaultConfig, getMasteringSuggestionWithUserAI, SecureVaultStatus } from '../services/aiService';
import { MasteringChainParams, AIProviderConfig } from '../types';
import { AISettingsModal } from './AISettingsModal';
import { Language, getT } from '../services/i18n';
import { authService, UserProfile } from '../services/authService';

interface AssistantProps {
  onApplyPreset: (params: MasteringChainParams) => void;
  currentParams?: MasteringChainParams;
  lang?: Language;
}

export const Assistant: React.FC<AssistantProps> = ({ onApplyPreset, currentParams, lang = 'es' }) => {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [vaultStatus, setVaultStatus] = useState<SecureVaultStatus | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(true);

  const t = getT(lang);

  const QUICK_PROMPTS = [
    lang === 'es' ? 'Calidez analógica vintage cinta 80s' : lang === 'ko' ? '80년대 아날로그 테이프 질감' : lang === 'ja' ? '80年代風アナログテープの温かみ' : '80s vintage analog tape warmth',
    lang === 'es' ? 'Pop brillante con voz clara' : lang === 'ko' ? '선명한 보컬의 팝 마스터링' : lang === 'ja' ? 'クリアなボーカルのポップマスタリング' : 'Bright Pop with clear vocals',
    lang === 'es' ? 'Hip-Hop / Trap con kick contundente' : lang === 'ko' ? '단단한 킥의 힙합/트랩' : lang === 'ja' ? '迫力あるキックのヒップホップ' : 'Hip-Hop / Trap punchy kick',
    lang === 'es' ? 'Acústico natural y dinámico' : lang === 'ko' ? '자연스러운 어쿠스틱 사운드' : lang === 'ja' ? '自然なアコースティック' : 'Natural dynamic acoustic',
    lang === 'es' ? 'EDM amplio y estéreo abierto' : lang === 'ko' ? '넓은 스테레오 EDM' : lang === 'ja' ? 'ワイドなステレオEDM' : 'EDM wide stereo image'
  ];

  const refreshVault = () => {
    getSecureVaultConfig().then(status => {
      setVaultStatus(status);
    });
  };

  useEffect(() => {
    refreshVault();
    return authService.subscribe((u) => {
      setUser(u);
      refreshVault();
    });
  }, []);

  const handleConfigSaved = () => {
    refreshVault();
    setError('');
  };

  const handleGenerate = async (customPrompt?: string) => {
    const activePrompt = (customPrompt || prompt).trim();
    if (!activePrompt) return;

    if (!user) {
      setError('Por favor inicia sesión con Google en la esquina superior derecha.');
      return;
    }

    if (!vaultStatus || !vaultStatus.configured) {
      setIsModalOpen(true);
      return;
    }

    setLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      const suggestedPartial = await getMasteringSuggestionWithUserAI(activePrompt, null, currentParams);
      
      if (currentParams) {
        const mergedParams: MasteringChainParams = {
          ...currentParams,
          eq: suggestedPartial.eq ? { ...currentParams.eq, ...suggestedPartial.eq } : currentParams.eq,
          multiband: suggestedPartial.multiband ? { ...currentParams.multiband, ...suggestedPartial.multiband } : currentParams.multiband,
          transient: suggestedPartial.transient ? { ...currentParams.transient, ...suggestedPartial.transient } : currentParams.transient,
          distortion: suggestedPartial.distortion ? { ...currentParams.distortion, ...suggestedPartial.distortion } : currentParams.distortion,
          gain: typeof suggestedPartial.gain === 'number' ? suggestedPartial.gain : currentParams.gain,
          stereoWidth: typeof suggestedPartial.stereoWidth === 'number' ? suggestedPartial.stereoWidth : currentParams.stereoWidth
        };
        onApplyPreset(mergedParams);
      }
      
      setPrompt('');
      setSuccessMsg(lang === 'es' ? '¡Ajustes de IA aplicados con éxito!' : lang === 'ko' ? 'AI 마스터링 설정이 적용되었습니다!' : lang === 'ja' ? 'AI設定が正常に適用されました！' : 'AI settings applied successfully!');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'Error connecting to AI Provider.');
    } finally {
      setLoading(false);
    }
  };

  const getProviderDisplayName = (p?: string) => {
    switch (p) {
      case 'gemini': return 'Google Gemini';
      case 'openai': return 'OpenAI GPT';
      case 'groq': return 'Groq (Llama)';
      case 'anthropic': return 'Anthropic Claude';
      case 'custom': return 'Custom Ollama';
      default: return 'AI Engine';
    }
  };

  return (
    <div className="shrink-0 min-h-fit bg-slate-900/90 border border-slate-800/80 rounded-2xl p-3.5 sm:p-4 backdrop-blur-xl shadow-2xl relative overflow-hidden transition-all duration-300">
      {/* Top Header Row */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-cyan-500 to-cyan-700 text-white rounded-xl shadow-lg shadow-cyan-500/20 shrink-0">
            <Sparkles size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-sm sm:text-base text-white tracking-tight">
                {t.aiAssistantTitle}
              </h3>
              {vaultStatus?.configured ? (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                  <Lock size={11} className="text-emerald-400" />
                  <span>{getProviderDisplayName(vaultStatus.provider)}</span>
                  <span className="text-[9px] text-emerald-400/80 font-mono">(AES-256)</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400">
                  API Key Offline
                </span>
              )}
            </div>
            {!isCollapsed && (
              <p className="text-xs text-slate-400 mt-0.5 hidden sm:block">
                {vaultStatus?.configured 
                  ? `${t.aiAssistantDesc} (${vaultStatus.model})` 
                  : t.aiKeyModalDesc}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-700/80 bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-all shadow-sm cursor-pointer"
          >
            <Settings size={14} className="text-cyan-400" />
            <span className="hidden sm:inline">{t.aiSettings}</span>
          </button>

          {/* Collapse / Expand Toggle Button */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 rounded-xl border border-slate-700/80 bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition-all flex items-center gap-1 text-xs font-medium px-2.5 cursor-pointer"
            title={isCollapsed ? t.expand : t.collapse}
          >
            {isCollapsed ? (
              <>
                <span className="text-[11px] hidden xs:inline">{t.expand}</span>
                <ChevronDown size={14} />
              </>
            ) : (
              <>
                <span className="text-[11px] hidden xs:inline">{t.collapse}</span>
                <ChevronUp size={14} />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Content Area (Collapsible) */}
      {!isCollapsed && (
        <div className="mt-4 pt-4 border-t border-slate-800/80 transition-all duration-300">
          {!vaultStatus?.configured ? (
            /* Disabled State */
            <div className="border border-dashed border-slate-800 bg-slate-950/60 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="p-2.5 bg-cyan-500/10 border border-cyan-500/30 rounded-xl text-cyan-400 shrink-0">
                  <KeyRound size={22} />
                </div>
                <div>
                  <h4 className="font-semibold text-xs sm:text-sm text-slate-200">
                    {t.aiKeyModalTitle}
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Google Gemini, OpenAI, Groq, Anthropic, Ollama.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(true)}
                className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-cyan-500/20 transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                <span>{t.connectKey}</span>
                <ArrowRight size={14} />
              </button>
            </div>
          ) : (
            /* Active Prompting UI */
            <div className="flex flex-col gap-3">
              {/* Quick Preset Buttons */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                <span className="text-[11px] font-semibold text-slate-400 shrink-0 flex items-center gap-1">
                  <Radio size={12} className="text-cyan-400" />
                  {t.quickStyles}
                </span>
                {QUICK_PROMPTS.map((qp, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleGenerate(qp)}
                    disabled={loading}
                    className="shrink-0 text-xs px-3 py-1 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 transition-all font-medium disabled:opacity-50 cursor-pointer active:scale-95"
                  >
                    {qp}
                  </button>
                ))}
              </div>

              {/* Text Input Row */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleGenerate();
                      }
                    }}
                    placeholder={t.aiPromptPlaceholder}
                    disabled={loading}
                    className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500/80 focus:ring-1 focus:ring-cyan-500/50 transition-all disabled:opacity-50"
                  />
                </div>

                <button
                  onClick={() => handleGenerate()}
                  disabled={loading || !prompt.trim()}
                  className="px-4 sm:px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-slate-950 font-bold text-xs sm:text-sm rounded-xl shadow-lg shadow-cyan-500/20 transition-all flex items-center gap-2 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-95"
                >
                  {loading ? (
                    <>
                      <Loader2 size={16} className="animate-spin text-slate-950" />
                      <span className="hidden sm:inline">{t.analyzing}</span>
                    </>
                  ) : (
                    <>
                      <Zap size={16} className="text-slate-950 fill-current" />
                      <span>{t.applyMasterAI}</span>
                    </>
                  )}
                </button>
              </div>

              {/* Status Alerts */}
              {error && (
                <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-center gap-2">
                  <span>⚠️ {error}</span>
                </div>
              )}

              {successMsg && (
                <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-emerald-400" />
                  <span>{successMsg}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Settings Modal */}
      <AISettingsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfigSaved={handleConfigSaved}
      />
    </div>
  );
};
