
import { GoogleGenAI, Type } from "@google/genai";
import { MasteringChainParams } from "../types";

// Always use the named parameter for apiKey initialization
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function getMasteringSuggestion(description: string): Promise<MasteringChainParams> {
  const defaultComp = { threshold: -20, ratio: 2, attack: 0.05, release: 0.2 };
  const defaultParams: MasteringChainParams = {
    eq: { 
        enabled: true,
        low: { frequency: 100, gain: 0, q: 0.7 },
        lowMid: { frequency: 300, gain: 0, q: 1 },
        mid: { frequency: 1000, gain: 0, q: 1 },
        highMid: { frequency: 3000, gain: 0, q: 1 },
        high: { frequency: 10000, gain: 0, q: 0.7 }
    },
    multiband: {
        enabled: true,
        low: { ...defaultComp, threshold: -16, ratio: 4, release: 0.1 },
        mid: { ...defaultComp },
        high: { ...defaultComp, threshold: -24, ratio: 1.5, attack: 0.1 }
    },
    gate: { enabled: true, threshold: -100, ratio: 10 },
    deEsser: { enabled: false, threshold: -20, amount: 4 },
    transient: { enabled: true, amount: 0, sustain: 0 },
    distortion: { enabled: true, amount: 0 },
    lofi: { enabled: true, bitDepth: 32, sampleRate: 48000, mix: 0 },
    modulation: { enabled: true, type: 'chorus', mix: 0, rate: 0.5, depth: 0, feedback: 0 },
    delay: { enabled: true, mix: 0, time: 0.3, feedback: 0.3 },
    reverb: { enabled: true, mix: 0, decay: 1.5 },
    gain: 1.0,
    stereoWidth: 1.0,
    limiter: { enabled: true, threshold: -1.0, breathe: 0 }
  };

  try {
    // Using gemini-2.5-flash for text analysis tasks
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Suggest audio mastering parameters for a track described as: "${description}".
      
      5-Band Parametric EQ (Low, LowMid, Mid, HighMid, High). Each band has frequency, gain, and Q.
      Multiband Compressor (Low, Mid, High):
      - Threshold -60 to 0 dB
      - Ratio 1 to 20
      - Attack 0 to 1s
      - Release 0 to 1s

      Transient Shaper:
      - Amount 0 to 100 (Attack Boost)
      - Sustain -100 to 100 (Tail Boost/Cut)
      
      Output Gain: 0.5 to 1.5.
      
      Return JSON.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            eq: {
              type: Type.OBJECT,
              properties: {
                low: { type: Type.OBJECT, properties: { frequency: {type: Type.NUMBER}, gain: {type: Type.NUMBER}, q: {type: Type.NUMBER} }, required: ["frequency", "gain", "q"] },
                lowMid: { type: Type.OBJECT, properties: { frequency: {type: Type.NUMBER}, gain: {type: Type.NUMBER}, q: {type: Type.NUMBER} }, required: ["frequency", "gain", "q"] },
                mid: { type: Type.OBJECT, properties: { frequency: {type: Type.NUMBER}, gain: {type: Type.NUMBER}, q: {type: Type.NUMBER} }, required: ["frequency", "gain", "q"] },
                highMid: { type: Type.OBJECT, properties: { frequency: {type: Type.NUMBER}, gain: {type: Type.NUMBER}, q: {type: Type.NUMBER} }, required: ["frequency", "gain", "q"] },
                high: { type: Type.OBJECT, properties: { frequency: {type: Type.NUMBER}, gain: {type: Type.NUMBER}, q: {type: Type.NUMBER} }, required: ["frequency", "gain", "q"] },
              },
              required: ["low", "lowMid", "mid", "highMid", "high"]
            },
            multiband: {
               type: Type.OBJECT,
               properties: {
                  low: {
                      type: Type.OBJECT,
                      properties: { threshold: { type: Type.NUMBER }, ratio: { type: Type.NUMBER }, attack: { type: Type.NUMBER }, release: { type: Type.NUMBER } },
                      required: ["threshold", "ratio", "attack", "release"]
                  },
                  mid: {
                      type: Type.OBJECT,
                      properties: { threshold: { type: Type.NUMBER }, ratio: { type: Type.NUMBER }, attack: { type: Type.NUMBER }, release: { type: Type.NUMBER } },
                      required: ["threshold", "ratio", "attack", "release"]
                  },
                  high: {
                      type: Type.OBJECT,
                      properties: { threshold: { type: Type.NUMBER }, ratio: { type: Type.NUMBER }, attack: { type: Type.NUMBER }, release: { type: Type.NUMBER } },
                      required: ["threshold", "ratio", "attack", "release"]
                  }
               },
               required: ["low", "mid", "high"]
            },
            transient: {
                type: Type.OBJECT,
                properties: { amount: { type: Type.NUMBER }, sustain: { type: Type.NUMBER } },
                required: ["amount", "sustain"]
            },
            gain: { type: Type.NUMBER },
          },
          required: ["eq", "multiband", "transient", "gain"]
        }
      }
    });

    // Access text property directly, not as a method
    const text = response.text;
    if (text) {
      const result = JSON.parse(text);
      return {
        ...defaultParams,
        eq: { ...defaultParams.eq, ...result.eq },
        multiband: { ...defaultParams.multiband, ...result.multiband },
        transient: result.transient ? { ...defaultParams.transient, ...result.transient } : defaultParams.transient,
        gain: result.gain || 1.0,
      };
    }
    
    return defaultParams;
  } catch (error) {
    console.error("Gemini API Error:", error);
    return defaultParams;
  }
}
