
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
    frequency?: number; // Sibilance center frequency (5000 to 9000 Hz)
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
  midDensity750Gain?: number; // Dynamic 750 Hz density control
  dynamicSubCutDb?: number; // Selective 30-75 Hz dynamic sub/kick attenuation
  vocalBodyMidRecoveryDb?: number; // Selective 300-900 Hz mid recovery in vocal sections
  isTransparentFallback?: boolean; // When active, strictly enforces pure linear passthrough & true peak safety
  stemAssisted?: boolean; // Tier 3 stem-assisted mastering
  stemMicroDuckingDb?: number; // 0.2 to 0.5 dB dynamic spectral instrumental ducking during active vocal
  stemVocalFocusDb?: number; // Focused vocal presence/body reinforcement
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
  sourceId?: string; // Deterministic unique identifier of source audio
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
  sourceId?: string;
  trackSessionId?: string;
  isMastered: boolean;
  result?: AIMasteringResult;
  params?: MasteringChainParams;
  isProcessing?: boolean;
  currentPhase?: 'reset' | 'analyze' | 'dsp' | 'vocal_audit' | 'render' | 'validate' | 'complete' | 'error';
  errorMessage?: string;
  blob?: Blob;
  url?: string;
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

export type VocalProtectionStatus = 
  | 'approved'             // delta <= 0.3 dB
  | 'acceptable'           // 0.3 < delta <= 0.5 dB
  | 'warning'              // 0.5 < delta <= 0.8 dB
  | 'failed'               // delta > 0.8 dB
  | 'partially_achieved';  // improved but safety limits reached

export interface VocalAnalysisProfile {
  centerEnergyDb: number;             // 250 Hz - 5 kHz (Mid channel focus)
  vocalBodyDb: number;                // 180 Hz - 900 Hz (Warmth & proximity)
  intelligibilityDb: number;          // 1 kHz - 4 kHz (Clarity & consonants)
  presenceDb: number;                 // 2 kHz - 5 kHz (Frontal placement)
  sibilanceDb: number;                // 5 kHz - 9 kHz (Air & 's' sounds)
  airEnergyDb: number;                // > 8 kHz (Breath & shimmer)
  lowEndEnergyDb: number;             // 30 Hz - 200 Hz (Sub & bass)
  guitarsSynthsMidDb: number;         // 400 Hz - 2.5 kHz (Mid instrumentation)
  instrumentalBrightnessDb: number;   // 5 kHz - 12 kHz (High percussion & sheen)
  sideEnergyDb: number;               // Side channel overall RMS in dB
  vocalToBassRatioDb: number;         // Vocal (800Hz-4kHz) vs Low-end (30Hz-200Hz)
  vocalToInstrumentalRatioDb: number; // Mid vocal band vs Side & overall RMS
  hasProminentVocals: boolean;        // True if vocal energy & mid coherence detected
  detectedVocalRegister: 'male_deep' | 'female_high' | 'neutral_instrumental';
  exactPresenceFreq: number;          // Measured peak frequency in 2.0k-4.5k (Hz)
  exactSibilanceFreq: number;         // Measured resonant peak in 5.5k-8.5k (Hz)
  sibilanceExcessDb: number;          // Sibilance above expected natural curve
  lowMidBuildup750Db: number;         // Resonant buildup at 750 Hz / 300 Hz
  bassMaskingIndex: number;           // 0-100 masking risk caused by sub/kick
  monoCompatibilityScore: number;     // 0-100 mono phase coherence in vocal range
  temporalConsistencyScore: number;   // 0-100 stability across verse/chorus blocks
  vocalSectionsCount: number;         // Count of temporal blocks with active voice
  instrumentalSectionsCount: number;  // Count of temporal blocks without voice
  vocalBlocksP50PresenceDb?: number;  // Robust 50th percentile (median) presence in vocal blocks
  vocalBlocksP50BodyDb?: number;      // Robust 50th percentile body in vocal blocks
  blockHarmonicVocalEnergy?: number[]; // Synchronized block energy values representing coherent vocal energy
  blockMidRmsArr?: number[];          // 16 block Mid RMS values
  blockPresRmsArr?: number[];         // 16 block Presence RMS values
  blockBodyRmsArr?: number[];         // 16 block Estimated Vocal Body RMS values
  blockLowEndRmsArr?: number[];       // 16 block Low-End RMS values
  blockSideRmsArr?: number[];         // 16 block Side RMS values
  vocalActiveBlocks?: boolean[];      // 16 block boolean indicators of vocal activity
}

export interface VocalProtectionReport {
  original: VocalAnalysisProfile;
  final: VocalAnalysisProfile;
  vocalStatus: VocalProtectionStatus;
  statusLabel: string;                // 'Protección aprobada', 'Protección aceptable', 'Advertencia de enmascaramiento', 'Protección fallida', 'Protección parcialmente alcanzada'
  relativePresenceDeltaDb: number;    // Net relative vocal presence delta vs mix
  vocalDeltaDb: number;               // Delta in absolute vocal presence band (dB)
  lowEndDeltaDb: number;              // Delta in low-end energy 30-200Hz (dB)
  lowEndVsVocalDiffDb: number;        // lowEndDeltaDb - vocalDeltaDb (rule: <= 0.5 dB)
  
  // Multiband Relative Deltas: Delta = Masking Element Delta - Vocal Region Delta
  subBassRelDeltaDb: number;          // Sub/Bass vs Vocal Body (dB)
  lowMidRelDeltaDb: number;           // Low-Mid 250-400Hz vs Vocal Body (dB)
  midInstRelDeltaDb: number;          // Guitars/Synths/Pads vs Intelligibility (dB)
  highInstRelDeltaDb: number;         // Brightness/Percussion vs Vocal Presence (dB)
  sideStereoRelDeltaDb: number;       // Side Width Growth vs Mid Vocal Growth (dB)
  maxRelativeDeltaDb: number;         // Worst-case relative delta across dimensions

  vocalBodyPreserved: boolean;
  intelligibilityPreserved: boolean;
  maskingElementDetected: string;     // Identified masking obstacle or "Ninguno"
  deEsserApplied: boolean;
  exactDeEsserFreq: number;           // Exact tuned de-esser frequency (Hz)
  deEsserReductionDb: number;
  density750ReductionDb: number;
  midCompensationAppliedDb: number;   // Applied Mid boost (0.0 if not needed)
  midCompensationFreq: number;        // Frequency of Mid compensation (Hz)
  dynamicSubCutAppliedDb?: number;    // Selective 30-75 Hz dynamic sub cut
  vocalBodyRecoveryAppliedDb?: number;// Selective 300-900 Hz Mid vocal body recovery
  bassDuckingPrevented: boolean;
  monoCompatibilityPreserved: boolean;
  safetyLimitReached: boolean;        // True if further correction would alter mix too heavily
  recommendedMixAdjustment?: string;  // Guidance for the user's mix if not approved
  sectionsSummary: string;            // Summary of sections evaluated
  iterationsPerformed: number;        // Real DSP re-render iterations executed (1 to 6)
  responsibleStagesIdentified: string[]; // Specific DSP processors causing/exacerbating masking
  dspAdjustmentsSummary: string[];    // DSP parameters modified during closed-loop passes
  measuredAudioDeltas: {
    subBassMeasuredDb: number;        // Final measured change in 30-150 Hz
    vocalBodyMeasuredDb: number;      // Final measured change in 180-900 Hz
    vocalPresenceMeasuredDb: number;  // Final measured change in vocal presence band
    highPercussionMeasuredDb: number; // Final measured change in 5-12 kHz
    sideStereoMeasuredDb: number;     // Final measured change in Side channel RMS
  };
  sideStereoStatus: 'centered_stable' | 'widened_risk'; // Center strengthened vs Side widening risk
  verdict: 'EXCELLENT' | 'COMPENSATED' | 'OPTIMAL';
  summaryNote: string;
}

export interface MasteringQualityScore {
  totalScore: number; // 0 - 100
  tonalBalance: number; // max 20
  vocalPreservation: number; // max 20
  dynamicsTransients: number; // max 15
  lowEndControl: number; // max 10
  claritySeparation: number; // max 10
  stereoPhase: number; // max 10
  loudnessTruePeak: number; // max 10
  distortionFatigue: number; // max 5
  breakdown: string[];
  rejectionTriggers: string[];
  isApproved: boolean;
}

export interface MasteringIterationRecord {
  iterationIndex: number;
  mqs: MasteringQualityScore;
  appliedTweaks: string[];
  renderedLufs: number;
  renderedPeak: number;
  isRejected: boolean;
  rejectedReasons: string[];
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
  vocalReport?: VocalProtectionReport;
  sourceId?: string; // Links master to exact source audio
  sessionId?: string; // Tracks execution session to prevent stale race conditions
  mqs?: MasteringQualityScore;
  originalMqs?: MasteringQualityScore;
  selectedIteration?: number;
  totalIterationsRun?: number;
  iterationHistory?: MasteringIterationRecord[];
  isFallbackApplied?: boolean;
  qualityVerdict?: 'APPROVED_BETTER' | 'TRANSPARENT_FALLBACK' | 'REJECTED';
  fallbackBandDeltas?: { band: string; deltaDb: number; maxAllowedDb: number; passed: boolean }[];
  masteringTierApplied?: 'stereo_direct' | 'stereo_microscopic_guided' | 'stem_assisted';
  reconstructionTestPassed?: boolean;
  reconstructionCorrelation?: number;
  microscopicMasking?: {
    activeVocalBlocks: number;
    competingInstrumentalBands: { band: string; maskingDeltaDb: number; suggestedDipDb: number }[];
    reconstructionFidelityPercent: number;
  };
  qcVerification?: {
    lufsIntegrated: number;
    truePeakDbTP: number;
    samplePeakDb: number;
    lra: number;
    clippingDetected: boolean;
    format: string;
    passed: boolean;
  };
}

export interface BulkMasteringSummary {
  bulkSessionId?: string;
  totalTracks: number;
  completedCount: number;
  warningCount?: number;
  failedCount: number;
  originalAvgLUFS: number;
  masterAvgLUFS: number;
  maxTruePeakDbTP: number;
  avgLRA: number;
  vocalApprovedCount: number;
  vocalPartialCount?: number;
  vocalWarningCount?: number;
  instrumentalCount: number;
  tracks: {
    trackId: string;
    trackName: string;
    sourceId?: string;
    status: 'completed' | 'warning' | 'failed' | 'skipped';
    originalLUFS: number;
    masterLUFS: number;
    truePeakDbTP: number;
    dynamicRangeLRA: number;
    vocalStatus: string;
    errorMessage?: string;
    result?: AIMasteringResult;
  }[];
  // Compatibility aliases
  completedTracks?: number;
  failedTracks?: number;
  averageOriginalLUFS?: number;
  averageMasterLUFS?: number;
  averageLRA?: number;
  vocalProtectedCount?: number;
  items?: any[];
}

