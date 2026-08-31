import { AIProviderConfig, MasteringChainParams } from '../types';
import { authService } from './authService';

export const DEFAULT_MODELS: Record<string, string> = {
  gemini: 'gemini-2.5-flash',
  openai: 'gpt-4o-mini',
  groq: 'llama-3.3-70b-versatile',
  anthropic: 'claude-3-5-haiku-20241022',
  custom: 'llama3',
};

export interface SecureVaultStatus {
  configured: boolean;
  provider: 'gemini' | 'openai' | 'groq' | 'anthropic' | 'custom';
  model: string;
  baseUrl?: string;
  maskedKey: string | null;
  updatedAt?: number;
}

/**
 * Gets the user's secure AI config status from the VPS AES-256-GCM Vault.
 */
export async function getSecureVaultConfig(): Promise<SecureVaultStatus | null> {
  const token = authService.getToken();
  if (!token) return null;

  try {
    const res = await fetch('/api/ai/config', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.warn('[AI Service] Error fetching vault status:', e);
    return null;
  }
}

/**
 * Encrypts and saves the user's API Key into the VPS AES-256-GCM Vault.
 */
export async function saveSecureVaultConfig(config: {
  provider: 'gemini' | 'openai' | 'groq' | 'anthropic' | 'custom';
  model: string;
  apiKey: string;
  baseUrl?: string;
}): Promise<{ success: boolean; message: string; config?: SecureVaultStatus }> {
  const token = authService.getToken();
  if (!token) {
    throw new Error('Debes iniciar sesión con Google para resguardar tu clave en el VPS.');
  }

  const res = await fetch('/api/ai/config', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(config)
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Error al guardar la clave cifrada en el servidor');
  }

  return data;
}

/**
 * Permanently deletes the user's encrypted API Key from the VPS Vault.
 */
export async function deleteSecureVaultConfig(): Promise<boolean> {
  const token = authService.getToken();
  if (!token) return false;

  const res = await fetch('/api/ai/config', {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  return res.ok;
}

/**
 * Tests connection to the AI provider securely via the VPS backend.
 */
export async function testSecureVaultConnection(): Promise<{ success: boolean; message: string }> {
  const token = authService.getToken();
  if (!token) {
    return { success: false, message: 'Inicia sesión con Google primero' };
  }

  try {
    const res = await fetch('/api/ai/test', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await res.json();
    if (!res.ok) {
      return { success: false, message: data.error || 'Error al verificar conexión' };
    }

    return { success: true, message: data.message || '¡Conexión y cifrado verificados con éxito!' };
  } catch (e: any) {
    return { success: false, message: e.message || 'Error de conexión con el servidor' };
  }
}

/**
 * Core AI Mastering Assistant Function.
 * Sends prompt to the secure VPS Proxy (/api/ai/mastering-suggestion) where the key is decrypted in RAM only.
 */
export async function getMasteringSuggestionWithUserAI(
  description: string, 
  config?: AIProviderConfig | null,
  currentParams?: MasteringChainParams
): Promise<Partial<MasteringChainParams>> {
  const token = authService.getToken();

  // If user is authenticated on VPS, use the 100% secure AES-256 backend proxy
  if (token) {
    const res = await fetch('/api/ai/mastering-suggestion', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        prompt: description,
        currentParams
      })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Error procesando solicitud de IA en el servidor');
    }

    return data.suggestedParams;
  }

  // Fallback client-side call if user is not logged into VPS
  if (config && config.apiKey) {
    return fallbackClientCall(description, config, currentParams);
  }

  throw new Error('Por favor inicia sesión con Google o configura tu API Key en el Asistente.');
}

async function fallbackClientCall(
  prompt: string,
  config: AIProviderConfig,
  currentParams?: MasteringChainParams
): Promise<Partial<MasteringChainParams>> {
  const { provider, apiKey, model } = config;
  const apiKeyClean = apiKey.trim();

  const systemInstruction = `You are a world-class audio mastering engineer AI assistant. 
You provide exact JSON parameter adjustments for 5-band EQ, 3-band Multiband Compressor, Transient Shaper, Saturation/Distortion, Gain, and Stereo Width. 
Always respond ONLY with a valid raw JSON object matching the requested schema. No markdown formatting like \`\`\`json, just pure JSON text.`;

  const userPrompt = `Current mastering parameters: ${JSON.stringify(currentParams || {})}
User goal: "${prompt}"

Return JSON matching schema with eq, multiband, transient, distortion, gain, stereoWidth.`;

  if (provider === 'gemini') {
    const modelName = model || DEFAULT_MODELS.gemini;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKeyClean}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${systemInstruction}\n\n${userPrompt}` }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.3 }
      })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Error Gemini HTTP ${res.status}`);
    }
    const data = await res.json();
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    return JSON.parse(raw);
  }

  throw new Error(`Inicia sesión con Google para usar el baúl seguro.`);
}
