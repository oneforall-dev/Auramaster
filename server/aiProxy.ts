import { decryptApiKey } from './crypto';
import { storage } from './storage';

export async function executeAiMasteringSuggestion(
  userId: string,
  prompt: string,
  currentParams?: any
): Promise<any> {
  const cred = storage.getCredential(userId);
  if (!cred) {
    throw new Error('No tienes una API Key configurada. Configúrala en el panel de Asistente IA.');
  }

  // 1. Decrypt API Key strictly in local memory scope
  let decryptedApiKey = '';
  try {
    decryptedApiKey = decryptApiKey(cred.encryptedKey, cred.iv, cred.authTag, userId);
  } catch (e) {
    throw new Error('Error de descifrado en el servidor. La clave guardada podría estar corrupta. Vuelve a guardarla.');
  }

  const { provider, model, baseUrl } = cred;

  const systemInstruction = `You are a world-class audio mastering engineer AI assistant. 
You provide exact JSON parameter adjustments for 5-band EQ, 3-band Multiband Compressor, Transient Shaper, Saturation/Distortion, Gain, and Stereo Width. 
Always respond ONLY with a valid raw JSON object matching the requested schema. No markdown formatting like \`\`\`json, just pure JSON text.`;

  const userPrompt = `Current mastering parameters: ${JSON.stringify(currentParams || {})}
User goal / sound description: "${prompt}"

Adjust parameters to achieve this sound. Return JSON with this structure:
{
  "eq": {
    "low": { "frequency": 100, "gain": 0.0, "q": 0.7 },
    "lowMid": { "frequency": 300, "gain": 0.0, "q": 1.0 },
    "mid": { "frequency": 1000, "gain": 0.0, "q": 1.0 },
    "highMid": { "frequency": 3000, "gain": 0.0, "q": 1.0 },
    "high": { "frequency": 10000, "gain": 0.0, "q": 0.7 }
  },
  "multiband": {
    "low": { "threshold": -16, "ratio": 3.0, "attack": 0.03, "release": 0.2 },
    "mid": { "threshold": -18, "ratio": 2.0, "attack": 0.025, "release": 0.15 },
    "high": { "threshold": -20, "ratio": 1.8, "attack": 0.02, "release": 0.1 }
  },
  "transient": {
    "amount": 10,
    "sustain": 0
  },
  "distortion": {
    "amount": 2
  },
  "gain": 1.25,
  "stereoWidth": 1.15
}`;

  let rawResponse = '';

  try {
    if (provider === 'gemini') {
      const targetModel = model || 'gemini-2.5-flash';
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${decryptedApiKey}`;
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemInstruction }] },
          contents: [{ parts: [{ text: userPrompt }] }],
          generationConfig: {
            temperature: 0.3,
            responseMimeType: 'application/json'
          }
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Google Gemini Error (${response.status}): ${errText}`);
      }

      const json = await response.json();
      rawResponse = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } else if (provider === 'openai' || provider === 'groq' || provider === 'custom') {
      const defaultUrl = provider === 'groq' 
        ? 'https://api.groq.com/openai/v1/chat/completions'
        : 'https://api.openai.com/v1/chat/completions';
      const targetUrl = (baseUrl && baseUrl.trim()) ? `${baseUrl.trim().replace(/\/$/, '')}/chat/completions` : defaultUrl;

      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${decryptedApiKey}`
        },
        body: JSON.stringify({
          model: model || (provider === 'groq' ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini'),
          messages: [
            { role: 'system', content: systemInstruction },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.3,
          response_format: { type: 'json_object' }
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`${provider.toUpperCase()} Error (${response.status}): ${errText}`);
      }

      const json = await response.json();
      rawResponse = json.choices?.[0]?.message?.content || '';
    } else if (provider === 'anthropic') {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': decryptedApiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: model || 'claude-3-5-haiku-20241022',
          max_tokens: 1024,
          system: systemInstruction,
          messages: [{ role: 'user', content: userPrompt }]
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Anthropic Error (${response.status}): ${errText}`);
      }

      const json = await response.json();
      rawResponse = json.content?.[0]?.text || '';
    }
  } finally {
    // Zero out decrypted memory string
    decryptedApiKey = '';
  }

  // Parse and validate result JSON
  const cleaned = rawResponse.replace(/```json/gi, '').replace(/```/g, '').trim();
  const parsed = JSON.parse(cleaned);
  return parsed;
}
