
export interface EQBand {
  frequency: number;
  gain: number;
  q: number;
}

export interface EQParams {
  enabled: boolean;
  low: EQBand;
  lowMid: EQBand;
  mid: EQBand;
  highMid: EQBand;
  high: EQBand;
}

export interface CompressorParams {
  threshold: number; // dB -60 to 0
  ratio: number; // 1 to 20
  attack: number; // ms 0 to 1
  release: number; // ms 0 to 1
}

export interface MultibandCompressorParams {
  enabled: boolean;
  low: CompressorParams;
  mid: CompressorParams;
  high: CompressorParams;
}

export interface ReverbParams {
  enabled: boolean;
  mix: number; // 0 to 1
  decay: number; // 0.1 to 10 seconds
}

export interface DelayParams {
  enabled: boolean;
  mix: number; // 0 to 1
  time: number; // 0 to 1 seconds
  feedback: number; // 0 to 0.9
}

export interface DistortionParams {
  enabled: boolean;
  amount: number; // 0 to 100
  mode?: 'tape' | 'digital'; // Added Tape mode
}

export interface LoFiParams {
  enabled: boolean;
  bitDepth: number; // 2 to 32
  sampleRate: number; // 1000 to 48000 (Hz)
  mix: number; // 0 to 1
}

export interface TransientParams {
  enabled: boolean;
  amount: number; // 0 to 100 (Attack Boost)
  sustain: number; // -100 to 100 (Tail Boost/Cut)
}

export interface ModulationParams {
  enabled: boolean;
  type: 'chorus' | 'phaser';
  mix: number; // 0 to 1
  rate: number; // 0 to 10 Hz
  depth: number; // 0 to 100
  feedback: number; // 0 to 0.9
}

export interface GateParams {
  enabled: boolean;
  threshold: number; // -100 to 0
  ratio: number; // 1 to 20
}

export interface LimiterParams {
    enabled: boolean;
    threshold: number; // -6.0 to 0.0 dB
    breathe: number; // 0 to 100% - Dynamic Expansion
}

export interface DeEsserParams {
    enabled: boolean;
    threshold: number; // -60 to 0
    amount: number; // Ratio-like factor
}

export interface MasteringChainParams {
  eq: EQParams;
  multiband: MultibandCompressorParams;
  gate: GateParams;
  deEsser: DeEsserParams; // Added De-Esser
  transient: TransientParams;
  distortion: DistortionParams;
  lofi: LoFiParams;
  modulation: ModulationParams;
  delay: DelayParams;
  reverb: ReverbParams;
  limiter: LimiterParams;
  gain: number; // 0 to 2
  stereoWidth: number; // 0 to 2
}

export interface Track {
  id: string;
  name: string;
  volume: number; // 0 to 1.5
  pan: number; // -1 (L) to 1 (R)
  muted: boolean;
  soloed: boolean;
  color: string;
  startTime: number; // Where in the timeline this track starts (seconds)
  fadeIn: number; // Seconds
  fadeOut: number; // Seconds
}

export enum PlaybackState {
  STOPPED,
  PLAYING,
  PAUSED,
}

export type SkinMode = 'modern' | 'clear';
export type ProcessingMode = 'stems' | 'bulk';

export interface TrackMasterInfo {
  trackId: string;
  isMastered: boolean;
  result?: AIMasteringResult;
  params?: MasteringChainParams;
  isProcessing?: boolean;
}

export type AIProvider = 'gemini' | 'openai' | 'groq' | 'anthropic' | 'custom';

export interface AIProviderConfig {
  provider: AIProvider;
  apiKey: string;
  model: string;
  baseUrl?: string;
}

export interface AnalysisMetrics {
  sampleRate: number;
  bitDepth: string;
  clipping: boolean;
  phaseCorrelation: number; // -1 to 1
  integratedLoudness: number;
  truePeak: number; // Instantaneous / Max True Peak (dBTP)
  maxTruePeak: number; // Session Max dBTP
  dynamicRange: number; // PSR / LRA in LU
  stereoField: 'Mono' | 'Narrow' | 'Normal' | 'Wide';
  tonalBalance: number[]; // Array of 4 values (Low, LowMid, HighMid, High) 0-1
  // Adaptive Engine Metrics
  detectedBpm?: number;
  crestFactor?: number;
  suggestedGenre?: string;
  spectralCentroid?: number;
  shortTermLoudness?: number;
  loudnessRangeLRA?: number;
}

export interface AIMasteringStats {
  integratedLUFS: number;
  truePeakDbTP: number;
  dynamicRangeLRA: number;
  crestFactor: number;
  peakDb?: number;
}

export interface ReferenceMasterProfile {
  integratedLUFS: number;
  shortTermMaxLUFS: number;
  momentaryMaxLUFS: number;
  truePeakDbTP: number;
  dynamicRangeLRA: number;
  crestFactor: number;
  rmsDb: number;
  // 5 spectral energy bands relative to total RMS: [sub, lowMid, mid, highMid, high]
  spectralBands: [number, number, number, number, number];
  stereoWidthRatio: number; // Mid/Side ratio (0.0 = mono, 1.0 = standard, >1.0 = wide)
  transientPunch: number; // 0-100 punch index based on crest factor & transient envelope
  harmonicDensity: number; // 0-100 texture and saturation index
  subBassWeight: number; // Sub-energy <80Hz
  highAirSheen: number; // Air energy >10kHz
  phaseCorrelation: number; // -1 to +1
}

export type ReferenceMasteringMode = 'replicate' | 'adapt' | 'adapt_and_enhance';
export type ReferenceMatchIntensity = 'subtle' | 'moderate' | 'strong';

export interface ReferenceTrack {
  id: string;
  name: string;
  size: number;
  duration: number;
  sampleRate: number;
  buffer?: AudioBuffer;
  profile: ReferenceMasterProfile;
  isPrimary: boolean;
  weight: number; // 0 to 1
  features: {
    tonal: boolean;
    dynamics: boolean;
    stereo: boolean;
    loudness: boolean;
    texture: boolean;
  };
}

export interface ReferenceMasteringConfig {
  mode: ReferenceMasteringMode;
  intensity: ReferenceMatchIntensity;
  blendMode: 'primary' | 'weighted_average' | 'modular';
  safeMode: boolean; // Protect transients, don't crush dynamics, center sub-bass
}

export interface ReferenceMasteringReportData {
  references: Array<{ name: string; profile: ReferenceMasterProfile; weight: number; isPrimary: boolean }>;
  targetProfile: ReferenceMasterProfile;
  originalProfile: ReferenceMasterProfile;
  finalProfile: ReferenceMasterProfile;
  config: ReferenceMasteringConfig;
  matchingScorePercent: number;
  maxGainReductionDb: number;
  sampleRate: number;
  bitDepth: string;
}

export interface AIMasteringResult {
  before: AIMasteringStats;
  after: AIMasteringStats;
  decisions: string[];
  appliedParams: MasteringChainParams;
  targetMet: boolean;
  statusNote: string;
  timestamp: number;
  referenceReport?: ReferenceMasteringReportData;
}

