
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
  vocalMidPresenceDb?: number; // Dedicated 1.5k-3.8k Mid channel vocal lift to place vocals on top of instruments
  sideVocalCarveDb?: number; // Dedicated Side-channel acoustic pocket carving to prevent instruments from masking vocals
  sideLowMidDipDb?: number; // Subtle low-mid side dip to preserve mono firmness and front-to-back contrast
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
  buffer?: AudioBuffer; // In-memory decoded PCM buffer for stems and preview
  sourceFile?: File; // Original browser File retained for lazy bulk decoding
}

export enum PlaybackState {
  STOPPED,
  PLAYING,
  PAUSED,
}

export type SkinMode = 'modern' | 'clear';
export type ProcessingMode = 'stems' | 'bulk';

export interface FinalMasterArtifact {
  deliveryVariantId?: string;
  sourceId: string;
  sessionId: string;
  candidateId: string;
  renderId: string;

  wavBlob: Blob;
  wavArrayBuffer?: ArrayBuffer;
  sha256: string;
  opfsFileName?: string; // Disk-backed browser storage for large bulk sessions
  externalFileHandle?: any; // User-selected destination for very large bulk sessions

  sampleRate: number;
  channels: number;
  bitDepth: 16 | 24 | 32;
  duration: number;

  finalDecodedPCM?: AudioBuffer;

  finalIntegratedLUFS: number;
  finalTruePeak: number;
  finalLRA: number;
  finalRMS: number;
  finalCrestFactor: number;

  finalMQS: MasteringQualityScore;
  finalDSPTelemetry?: LimiterTelemetry;
}

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
  finalMasterArtifact?: FinalMasterArtifact;
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
  | 'partial'
  | 'partially_achieved';  // improved but safety limits reached

export type VocalClassification = 'VOCAL_PRESENT' | 'VOCAL_UNCERTAIN' | 'INSTRUMENTAL';

export interface VocalPresenceResult {
  hasVocals: boolean;
  confidence: number; // 0.0 - 1.0
  classification: VocalClassification;
  vocalActivityRatio: number; // 0.0 - 1.0
  vocalSegmentCount: number;
  averageVocalConfidence: number; // 0.0 - 1.0
  pitchContinuityScore: number; // 0 - 100
  formantEvidenceScore: number; // 0 - 100
  speechSingingStructureScore: number; // 0 - 100
  harmonicInstrumentConfusionScore: number; // 0 - 100
  vibratoScore?: number; // 0 - 100
  rationale: string;
}

export interface VocalAnalysisProfile {
  centerEnergyDb: number;             // 250 Hz - 5 kHz (Mid channel focus)
  vocalBodyDb: number;                // 180 Hz - 900 Hz (Warmth & proximity)
  intelligibilityDb: number;          // 1 kHz - 4 kHz (Clarity & consonants)
  presenceDb: number;                 // 2 kHz - 5 kHz (Frontal placement)
  sibilanceDb: number;                // 5 kHz - 9 kHz (Air & 's' sounds)
  airEnergyDb: number;                // > 8 kHz (Breath & shimmer)
  lowEndEnergyDb: number;             // 30 Hz - 200 Hz (Sub & bass)
  // Sub-band Body Analysis (Sections 4 & 5)
  weight120_250Db?: number;           // 120 - 250 Hz (Weight / warmth)
  body250_500Db?: number;             // 250 - 500 Hz (Body)
  solidity500_900Db?: number;         // 500 - 900 Hz (Vocal/instrument solidity)
  // Sub-band Low-End Authority Analysis (Section 6)
  sub20_60Db?: number;                // 20 - 60 Hz (Sub-bass)
  bass60_100Db?: number;              // 60 - 100 Hz (Kick/bass fundamental)
  punch100_150Db?: number;            // 100 - 150 Hz (Transient punch)
  warmth150_250Db?: number;           // 150 - 250 Hz (Bass harmonics / warmth)
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
  vocalDetection?: VocalPresenceResult; // Autonomous vocal existence telemetry
}



export interface VocalProtectionReport {
  original: VocalAnalysisProfile;
  final: VocalAnalysisProfile;
  vocalDetection?: VocalPresenceResult;
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
  // MQS V2 Core 10 Pillars (Sum = 100)
  vocalIntegrity: number; // max 20 (Preservación de timbre, cuerpo 150-900Hz e inteligibilidad vocal)
  tonalBalance: number; // max 15 (Curva musical, sin asperezas ni resonancias)
  bodyDensity: number; // max 15 (Peso 120-250Hz, cuerpo 250-500Hz, solidez 500-900Hz)
  dynamicsTransients: number; // max 15 (Pegada de transientes, impacto de bombo/caja, microdinámica)
  lowEndAuthority: number; // max 10 (Graves y subgraves firmes, definidos, articulados y sin enmascaramiento)
  claritySeparation: number; // max 8 (Separación instrumental y descongestión de medios)
  depth: number; // max 5 (Planos espaciales frente-fondo Mid/Side)
  stereoPhase: number; // max 5 (Correlación >= 0.85, centro mono sólido)
  loudnessCapability: number; // max 5 (Capacidad de proyección de volumen limpio sin fatiga)
  fatigueDistortion: number; // max 2 (Anti-fatiga, sin picos inter-sample ni distorsión)

  // Backward-compatibility aliases
  vocalPreservation?: number; // alias for vocalIntegrity
  leadMelodicFocusIntegrity?: number; // Pillar 1 alias for vocalIntegrity when track is instrumental (max 20)
  isInstrumental?: boolean;
  lowEndControl?: number; // alias for lowEndAuthority
  depth3D?: number; // alias for depth
  loudnessTruePeak?: number; // alias for loudnessCapability
  distortionFatigue?: number; // alias for fatigueDistortion

  breakdown: string[];
  rejectionTriggers: string[];
  isApproved: boolean;
  scoreAdjustments?: {
    vocalPenalty: number;
    phasePenalty: number;
    crestPenalty: number;
    transformBenefit: number;
    totalAdjustment: number;
    rationale: string;
  };
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

export interface MasterIdentityRecord {
  finalRenderId: string;
  finalFileHash: string; // SHA-256 hex
  finalSourceId: string;
  finalCandidateId: string;
  finalSessionId: string;
  sampleRate: number;
  lengthInSamples: number;
  duration: number;
  measuredFinalLUFS: number;
  measuredFinalTruePeak: number;
  measuredFinalLRA: number;
  reopenedWavValid: boolean;
}

export interface AudioIdentity {
  sourceId: string;
  trackSessionId: string;
  iterationId: string;
  renderId: string;
  finalRenderId?: string;
  finalFileHash?: string;
  finalCandidateId?: string;
  finalSessionId?: string;
  fileHash: string; // Cryptographic SHA-256 hex of exported WAV
  sampleRate: number;
  lengthInSamples: number;
  duration: number;
  originalLUFS: number;
  masterLUFS: number;
  comparisonGainDb: number; // originalLUFS - masterLUFS
  virOriginalDb?: number; // Vocal-to-Instrumental Ratio in original mix
  virMasterDb?: number; // Vocal-to-Instrumental Ratio in reopened master
  deltaVirDb?: number; // virMasterDb - virOriginalDb (must not drop > 0.3 dB)
  reopenedFromWav: boolean;
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
  qualityVerdict?: 'APPROVED_BETTER' | 'TRANSPARENT_FALLBACK' | 'ORIGINAL_PRESERVED_NO_SUBSTANTIAL_MASTERING' | 'REJECTED';
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
  mathematicalComparison?: MathematicalComparisonReport;
  audioIdentity?: AudioIdentity;
  masterIdentity?: MasterIdentityRecord;
  reportConsistencyCheck?: {
    passed: boolean;
    violations: string[];
    verifiedHash: string;
    measuredLUFS: number;
    reportedLUFS: number;
    measuredTruePeak: number;
    reportedTruePeak: number;
    measuredLRA: number;
    reportedLRA: number;
  };
  reopenedFromWav?: boolean;
  loudnessMatchGainDb?: number;
  acousticDiagnosis?: AcousticAspectDiagnosis[];
  masteringDirection?: MasteringDirection;
  tournamentReport?: MasteringTournamentReport;
  finalMeasuredLUFS?: number;
  limiterTelemetry?: LimiterTelemetry;
  finalMasterArtifact?: FinalMasterArtifact;
  // Quality-First Adaptive Mastering V2 Telemetry
  musicalIntent?: MusicalIntentProfile;
  vocalDetection?: VocalPresenceResult;
  loudnessExploration?: LoudnessExplorationRecord;
  bodyValidation?: BodyValidationTelemetry;
  adaptiveEQDecisions?: AdaptiveEQDecision[];
}

export interface MusicalIntentProfile {
  detectedGenre: string;
  productionAesthetic: 'vintage_warm' | 'modern_pristine' | 'organic_acoustic' | 'dense_aggressive' | 'balanced_commercial';
  tonalCharacter: 'warm' | 'neutral' | 'bright';
  dynamicProfile: 'dynamic_open' | 'cohesive' | 'dense';
  vocalFocus: 'vocal_forward' | 'balanced_mix' | 'instrumental_dominant';
  lowEndCharacter: 'tight_punchy' | 'deep_subby' | 'warm_round' | 'lean_controlled';
  intendedStereoDepth: 'intimate_focused' | 'natural_wide' | 'expansive_3d';
  notes: string[];
}

export interface TestedLoudnessLevel {
  variantId?: string;
  ceilingDbTP?: number;
  levelName: string; // e.g. 'L0 (0.00 dB)', 'L1 (+0.75 dB)', 'L2 (+1.50 dB)', etc.
  gainDb: number;
  measuredLUFS: number; // LUFS-I
  truePeakDbTP: number; // dBTP
  limiterGR: number; // limiterMaxGR in dB
  limiterMaxGR?: number;
  samplesLimited?: number;
  lra: number;
  lraDelta: number;
  crestFactor: number;
  crestDelta: number;
  vocalDelta?: number; // dB delta in vocal presence relative to original at matched loudness
  leadFocusDelta?: number; // dB delta in lead melodic focus relative to original at matched loudness (when instrumental)
  bodyDelta?: number; // dB delta in low-mids/body relative to original at matched loudness
  phaseCorrelation?: number;
  distortionRisk?: 'low' | 'moderate' | 'high';
  pumpingRisk?: boolean;
  qualityScore?: number;
  approved: boolean;
  isRefinementStep?: boolean;
  rejectionReason?: string;
  rejectionReasons?: string[];
}

export interface LoudnessExplorationRecord {
  selectedVariantId?: string;
  selectedWavSha256?: string;
  naturalLUFS: number;
  adaptiveTargetLUFS?: number;
  winnerPreDeliveryLUFS?: number;
  testedLoudnessLevels: TestedLoudnessLevel[];
  selectedFinalLUFS: number;
  maximumCleanLUFS: number;
  availableCleanHeadroomDb: number;
  usedCleanHeadroomDb: number;
  limiterGR: number;
  samplesLimited?: number;
  crestDelta: number;
  lraDelta: number;
  rejectionReasonForLouderVariant?: string;
  sweetSpotNote: string;
  unusedCleanHeadroomFlag?: boolean; // Flagged when clean headroom was left unused without cause
  refinementStepsCount?: number;
}

export interface BodyValidationTelemetry {
  passed: boolean;
  lowMidWeightPreserved: boolean; // 120-250 Hz
  bodyPreserved: boolean; // 250-500 Hz
  vocalSolidityRetained: boolean; // 500-900 Hz
  thinningPatternDetected: boolean; // Anti-thinning detector
  bassAuthorityScore: number; // 0-100
  weight120_250DeltaDb?: number;
  body250_500DeltaDb?: number;
  solidity500_900DeltaDb?: number;
  broadLowMidDeltaDb?: number; // 150-500 Hz / 200-800 Hz delta
  bodyReviewTriggered?: boolean;
  bodyReviewRationale?: string;
  notes: string[];
}

export interface AdaptiveEQDecision {
  problemDetected: string;
  confidence: number; // 0 - 100
  band: string;
  frequency: number;
  q: number;
  proposedGainDb: number;
  measuredResultDb: number;
  benefitScore: number;
  status: 'accepted' | 'reverted';
  rationale: string;
}

export type LimiterState = 'BYPASS' | 'ARMED_NO_GAIN_REDUCTION' | 'ACTIVE';

export interface LimiterTelemetry {
  limiterEnabled: boolean;
  limiterCeiling: number;
  maxGainReduction: number;
  averageGainReduction: number;
  samplesLimited: number;
  finalTruePeak: number;
  state: LimiterState;
  statusText: string;
}

export type AcousticAspectKey =
  // 18 V2 Classified Dimensions
  | 'vocal'
  | 'kick'
  | 'bass'
  | 'sub'
  | 'percussion'
  | 'low_mids_body'
  | 'mid_clarity'
  | 'presence'
  | 'highs'
  | 'air'
  | 'transients'
  | 'macro_dynamics'
  | 'micro_dynamics'
  | 'stereo'
  | 'phase'
  | 'depth'
  | 'density'
  | 'loudness_headroom'
  // Compatibility aliases
  | 'voz'
  | 'bajo'
  | 'subgrave'
  | 'percusion'
  | 'medios'
  | 'presencia'
  | 'agudos'
  | 'profundidad'
  | 'separacion'
  | 'dinamica'
  | 'transientes'
  | 'estereo'
  | 'midside'
  | 'fase'
  | 'densidad'
  | 'loudness';

export type AcousticAspectStatus = 'excelente' | 'bueno' | 'mejorable' | 'problematico';

export interface AcousticAspectDiagnosis {
  aspect: AcousticAspectKey;
  label: string;
  status: AcousticAspectStatus;
  measuredValue: string;
  description: string;
  recommendation: string;
  isProtected: boolean;
}

export interface MasteringDirection {
  title: string;
  selectedGoals: string[];
  rationale: string;
  protectedAspects: string[];
}

export interface TournamentCandidate {
  id: 'candidate_a' | 'candidate_b' | 'candidate_c';
  name: string;
  type: 'transparent' | 'polished' | 'transformative';
  params: MasteringChainParams;
  integratedLUFS: number;
  truePeakDbTP: number;
  comparisonGainDb: number;
  rawScore: number;
  preRenderScore?: number;
  postRenderScore?: number;
  finalScore: number;
  approved: boolean;
  scores: {
    vocalScore: number; // max 20 (V2)
    tonalBalanceScore: number; // max 15 (V2)
    bodyDensityScore?: number; // max 15 (V2)
    transientScore: number; // max 15 (V2)
    lowEndScore: number; // max 10 (V2)
    separationScore: number; // max 8 (V2)
    depthScore: number; // max 5 (V2)
    stereoPhaseScore: number; // max 5 (V2)
    loudnessCapabilityScore?: number; // max 5 (V2)
    fatigueDistortionScore: number; // max 2 (V2)
    loudnessTpScore?: number; // compat alias
    cohesionFatigueScore?: number; // compat alias
    totalScore: number; // max 100
  };
  scoreAdjustments?: {
    vocalPenalty: number;
    phasePenalty: number;
    crestPenalty: number;
    transformBenefit: number;
    totalAdjustment: number;
    rationale: string;
  };
  deltaVirDb: number;
  phaseCorrelation: number;
  headToHeadWins: number;
  isDisqualified: boolean;
  disqualificationReason?: string;
  disqualificationReasons?: string[];
  perceptualHighlights: string[];
  loudnessExploration?: LoudnessExplorationRecord;
  bodyValidation?: BodyValidationTelemetry;
}

export interface TournamentMatchup {
  candidate1: string;
  candidate2: string;
  winner: string;
  deltaScore: number;
  rationale: string;
}

export interface MasteringTournamentReport {
  candidates: TournamentCandidate[];
  matchups: TournamentMatchup[];
  winnerCandidateId: 'candidate_a' | 'candidate_b' | 'candidate_c';
  winnerName: string;
  safetyFallbackApplied: boolean;
  safetyReason?: string;
  selfCorrectionApplied: boolean;
  selfCorrectionNotes?: string[];
  sweetSpotLoudnessNote: string;
}

export interface MathematicalComparisonReport {
  // 1. Compensación global de ganancia
  gainOffsetDb: number;
  gainCompensationLinear: number;

  // 2. Correlación entre muestras
  sampleCorrelation: number; // Pearson correlation r (p.ej. 0.999998)

  // 3. Nivel RMS y Pico del residuo (dBFS)
  residualRmsDb: number; // 20 * log10(RMS(Master_matched - Source))
  residualPeakDb: number; // 20 * log10(Peak(Master_matched - Source))
  residualMaxErrorLinear?: number; // Real max sample error |Master_matched - Source|
  residualMaxErrorDb?: number; // 20 * log10(residualMaxErrorLinear)

  // 4. Diferencias espectrales por bandas a loudness igualado
  spectralBands: {
    band: string;
    fLow: number;
    fHigh: number;
    deltaDb: number;
    passed: boolean;
  }[];
  maxSpectralDeltaDb: number;

  // 5. Diferencias de dinámica
  deltaLra: number;
  deltaCrestFactor: number;

  // 6. Diferencias de imagen estéreo
  originalMidSideRatio: number;
  masterMidSideRatio: number;
  deltaStereoWidth: number;
  originalPhaseCorrelation: number;
  masterPhaseCorrelation: number;
  deltaPhaseCorrelation: number;

  // 7. Diferencias de envolvente
  envelopeCorrelation: number;

  // 8. Acción real de cada módulo DSP (Telemetría de audio real de 3 niveles)
  dspModuleActions: {
    module: string;
    applied: boolean;
    measuredImpactDb: number;
    actionDescription: string;
    intentionDescription?: string; // Nivel 1: Intención DSP
    measuredResultDescription?: string; // Nivel 3: Resultado medido
    state?: 'BYPASS' | 'ARMED_NO_ACTION' | 'ACTIVE';
    statusLabel?: string;
    limiterState?: LimiterState;
    samplesAffected?: number;
    peakReductionOrBoostDb?: number;
    activeTimeSeconds?: number;
    confirmedInSelectedRender?: boolean;
  }[];
  limiterTelemetry?: LimiterTelemetry;

  // 9. Clasificación matemática estricta
  isOriginalPreservedWithoutMastering: boolean;
  classification:
    | 'ORIGINAL_PRESERVED_NO_SUBSTANTIAL_MASTERING'
    | 'SUBSTANTIAL_GENUINE_IMPROVEMENT'
    | 'TECHNICAL_TRANSPARENT_DELIVERY';
  classificationLabel: string;
  classificationReason: string;

  // 10. Honestidad en presentación
  hasAudibleTransformation: boolean;
  honestNote: string;
  mixNearMasterReady: boolean;
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

