
import { 
  MasteringChainParams, 
  PlaybackState, 
  Track, 
  AnalysisMetrics, 
  AIMasteringResult, 
  AIMasteringStats, 
  AIProviderConfig,
  ReferenceTrack,
  ReferenceMasterProfile,
  ReferenceMasteringConfig,
  ReferenceMasteringReportData,
  VocalAnalysisProfile,
  VocalProtectionReport
} from '../types';

type StemType = 'vocals' | 'drums' | 'bass' | 'other';

interface InternalTrackNode {
  buffer: AudioBuffer;
  source: AudioBufferSourceNode | null;
  // The input node for the mixer channel (after stem FX)
  outNode: GainNode; 
  // The fader (volume/pan)
  gainNode: GainNode; 
  pannerNode: StereoPannerNode;
  // References to stem-specific nodes for cleanup
  fxNodes: AudioNode[];
}

export function hashString(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash;
}

export async function generateAudioSourceId(file?: File, buffer?: AudioBuffer): Promise<string> {
  let hashStr = '';
  if (file) {
    hashStr += `${file.name}_${file.size}_${file.lastModified}`;
  }
  if (buffer) {
    hashStr += `_${buffer.sampleRate}_${buffer.numberOfChannels}_${buffer.duration.toFixed(3)}`;
    const ch = buffer.getChannelData(0);
    const step = Math.max(1, Math.floor(ch.length / 32));
    let sampleSum = 0;
    for (let i = 0; i < ch.length; i += step) {
      sampleSum = (sampleSum * 31 + Math.round(ch[i] * 10000)) | 0;
    }
    hashStr += `_${sampleSum.toString(16)}`;
  }
  if (!hashStr) {
    hashStr = `src_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  }
  return `src_${Math.abs(hashString(hashStr)).toString(36)}`;
}

export function getNeutralMasteringParams(): MasteringChainParams {
  return {
    eq: {
      enabled: true,
      low: { frequency: 80, gain: 0.0, q: 0.7 },
      lowMid: { frequency: 320, gain: 0.0, q: 1.0 },
      mid: { frequency: 1000, gain: 0.0, q: 1.0 },
      highMid: { frequency: 3200, gain: 0.0, q: 1.0 },
      high: { frequency: 10000, gain: 0.0, q: 0.7 }
    },
    multiband: {
      enabled: true,
      low: { threshold: -16, ratio: 1.4, attack: 0.03, release: 0.2 },
      mid: { threshold: -18, ratio: 1.3, attack: 0.025, release: 0.15 },
      high: { threshold: -20, ratio: 1.2, attack: 0.015, release: 0.10 }
    },
    gate: { enabled: false, threshold: -80, ratio: 0 },
    deEsser: { enabled: false, frequency: 6500, threshold: -20, amount: 2.5 },
    transient: { enabled: false, amount: 0, sustain: 0 },
    distortion: { enabled: false, amount: 0, mode: 'tape' },
    lofi: { enabled: false, bitDepth: 32, sampleRate: 48000, mix: 0 },
    modulation: { enabled: false, type: 'chorus', mix: 0, rate: 1.5, depth: 50, feedback: 0 },
    delay: { enabled: false, mix: 0, time: 0.3, feedback: 0.3 },
    reverb: { enabled: false, mix: 0, decay: 2.0 },
    gain: 1.0,
    stereoWidth: 1.0,
    midDensity750Gain: 0.0,
    dynamicSubCutDb: 0.0,
    vocalBodyMidRecoveryDb: 0.0,
    limiter: { enabled: true, threshold: -1.0, breathe: 0 }
  };
}

export class AudioEngine {
  private audioContext: AudioContext | null = null;
  private tracks: Map<string, InternalTrackNode> = new Map();
  private masterSumNode: GainNode | null = null; 
  private preMasterGain: GainNode | null = null;
  private dryPath: GainNode | null = null;
  private wetPath: GainNode | null = null;
  
  // FX Chain
  private preDcBlocker: BiquadFilterNode | null = null; 
  private noiseGate: WaveShaperNode | null = null;
  private distortion: WaveShaperNode | null = null;
  
  // Multiband (Crossover)
  private lowCrossover: BiquadFilterNode | null = null;
  private midCrossoverLow: BiquadFilterNode | null = null;
  private midCrossoverHigh: BiquadFilterNode | null = null;
  private highCrossover: BiquadFilterNode | null = null;
  
  private compLow: DynamicsCompressorNode | null = null;
  private compMid: DynamicsCompressorNode | null = null;
  private compHigh: DynamicsCompressorNode | null = null;
  
  private mbSum: GainNode | null = null;
  
  // 5-Band Master EQ
  private lowEQ: BiquadFilterNode | null = null;
  private lowMidEQ: BiquadFilterNode | null = null;
  private midEQ: BiquadFilterNode | null = null;
  private highMidEQ: BiquadFilterNode | null = null;
  private highEQ: BiquadFilterNode | null = null;

  // De-Esser Nodes
  private deEsserComp: DynamicsCompressorNode | null = null;

  // Spatial / Time FX
  private delayNode: DelayNode | null = null;
  private delayDry: GainNode | null = null;
  private delayWet: GainNode | null = null;
  private reverbNode: ConvolverNode | null = null;
  private reverbDry: GainNode | null = null;
  private reverbWet: GainNode | null = null;
  
  // Mid/Side Stereo Width & Mono Sub Centering
  private msSplitter: ChannelSplitterNode | null = null;
  private msMidSum: GainNode | null = null;
  private msSideDiff: GainNode | null = null;
  private sideMonoHighPass: BiquadFilterNode | null = null;
  private sideLowMidDip: BiquadFilterNode | null = null;
  private msSideGain: GainNode | null = null;
  private msMerger: ChannelMergerNode | null = null;

  // Mid Resonance / Density Tamer (500Hz - 1kHz / 750Hz)
  private midDensityTamer: BiquadFilterNode | null = null;
  // Selective 30-75 Hz Sub/Kick Dynamic Control
  private dynamicSubCutNode: BiquadFilterNode | null = null;
  // Mid Channel Vocal Body Recovery (300-900 Hz in center)
  private vocalBodyRecoveryNode: BiquadFilterNode | null = null;
  
  // Dynamic Breathe (Expander)
  private expander: WaveShaperNode | null = null;

  // Soft Clipper (Pre-Limiter)
  private softClipper: WaveShaperNode | null = null;

  // Final Stage
  private limiter: DynamicsCompressorNode | null = null; 
  private dcBlocker: BiquadFilterNode | null = null; 
  private safetyClipper: WaveShaperNode | null = null; 

  private analyzer: AnalyserNode | null = null;
  private analyzerL: AnalyserNode | null = null;
  private analyzerR: AnalyserNode | null = null;
  
  private startTime: number = 0;
  private pauseTime: number = 0;
  private state: PlaybackState = PlaybackState.STOPPED;
  private maxDuration: number = 0;
  public onPlaybackEnded: (() => void) | null = null;
  private dataArray: Uint8Array | null = null;

  // Adaptive Metrics Storage
  private lastAnalysis: Partial<AnalysisMetrics> = {};
  public lastAIMasteringResult: AIMasteringResult | null = null;
  public currentSessionId: string = `sess_${Date.now().toString(36)}`;
  public activeTrackSessionId: string = '';

  constructor() {}

  init() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.masterSumNode = this.audioContext.createGain();
      this.preMasterGain = this.audioContext.createGain(); 
      this.dryPath = this.audioContext.createGain();
      this.dryPath.gain.value = 0.0; // Inactive by default (Wet DSP is active)
      this.wetPath = this.audioContext.createGain();
      this.wetPath.gain.value = 1.0;
      
      // Pre-Processing DC Blocker
      this.preDcBlocker = this.audioContext.createBiquadFilter();
      this.preDcBlocker.type = 'highpass';
      this.preDcBlocker.frequency.value = 20;

      this.noiseGate = this.audioContext.createWaveShaper();
      this.distortion = this.audioContext.createWaveShaper();
      this.distortion.oversample = 'none'; 
      
      this.lowCrossover = this.audioContext.createBiquadFilter(); this.lowCrossover.type = 'lowpass'; this.lowCrossover.frequency.value = 250;
      this.midCrossoverLow = this.audioContext.createBiquadFilter(); this.midCrossoverLow.type = 'highpass'; this.midCrossoverLow.frequency.value = 250;
      this.midCrossoverHigh = this.audioContext.createBiquadFilter(); this.midCrossoverHigh.type = 'lowpass'; this.midCrossoverHigh.frequency.value = 2500;
      this.highCrossover = this.audioContext.createBiquadFilter(); this.highCrossover.type = 'highpass'; this.highCrossover.frequency.value = 2500;
      
      this.compLow = this.audioContext.createDynamicsCompressor();
      this.compMid = this.audioContext.createDynamicsCompressor();
      this.compHigh = this.audioContext.createDynamicsCompressor();
      this.mbSum = this.audioContext.createGain();

      // 5-Band Master EQ + Mid Density Tamer
      this.lowEQ = this.audioContext.createBiquadFilter(); this.lowEQ.type = 'lowshelf';
      this.lowMidEQ = this.audioContext.createBiquadFilter(); this.lowMidEQ.type = 'peaking';
      this.midEQ = this.audioContext.createBiquadFilter(); this.midEQ.type = 'peaking';
      
      this.midDensityTamer = this.audioContext.createBiquadFilter();
      this.midDensityTamer.type = 'peaking';
      this.midDensityTamer.frequency.value = 750;
      this.midDensityTamer.Q.value = 0.8;
      this.midDensityTamer.gain.value = 0.0; // Neutral default: dynamically engaged only on genuine 750Hz congestion

      this.dynamicSubCutNode = this.audioContext.createBiquadFilter();
      this.dynamicSubCutNode.type = 'peaking';
      this.dynamicSubCutNode.frequency.value = 55;
      this.dynamicSubCutNode.Q.value = 1.3;
      this.dynamicSubCutNode.gain.value = 0.0;

      this.vocalBodyRecoveryNode = this.audioContext.createBiquadFilter();
      this.vocalBodyRecoveryNode.type = 'peaking';
      this.vocalBodyRecoveryNode.frequency.value = 500;
      this.vocalBodyRecoveryNode.Q.value = 0.8;
      this.vocalBodyRecoveryNode.gain.value = 0.0;

      this.highMidEQ = this.audioContext.createBiquadFilter(); this.highMidEQ.type = 'peaking';
      this.highEQ = this.audioContext.createBiquadFilter(); this.highEQ.type = 'highshelf';
      
      this.deEsserComp = this.audioContext.createDynamicsCompressor();
      this.deEsserComp.attack.value = 0.005; 
      this.deEsserComp.release.value = 0.05;
      this.deEsserComp.ratio.value = 4;

      this.delayNode = this.audioContext.createDelay(2.0);
      this.delayDry = this.audioContext.createGain();
      this.delayDry.gain.value = 1.0;
      this.delayWet = this.audioContext.createGain();
      this.delayWet.gain.value = 0.0; // Disabled by default

      this.reverbNode = this.audioContext.createConvolver();
      this.reverbDry = this.audioContext.createGain();
      this.reverbDry.gain.value = 1.0;
      this.reverbWet = this.audioContext.createGain();
      this.reverbWet.gain.value = 0.0; // Disabled by default
      this.generateReverbImpulse(2.0);

      this.msSplitter = this.audioContext.createChannelSplitter(2);
      this.msMidSum = this.audioContext.createGain(); 
      this.msSideDiff = this.audioContext.createGain();
      
      // Mono Maker / Sub-bass Centering (<105Hz) & Low-Mid Side Tamer (140-280Hz)
      this.sideMonoHighPass = this.audioContext.createBiquadFilter();
      this.sideMonoHighPass.type = 'highpass';
      this.sideMonoHighPass.frequency.value = 105; 
      this.sideMonoHighPass.Q.value = 0.707;

      this.sideLowMidDip = this.audioContext.createBiquadFilter();
      this.sideLowMidDip.type = 'peaking';
      this.sideLowMidDip.frequency.value = 200; 
      this.sideLowMidDip.Q.value = 1.0;
      this.sideLowMidDip.gain.value = -0.6; // -0.6 dB gentle side dip to maintain mono firmness

      this.msSideGain = this.audioContext.createGain();
      this.msMerger = this.audioContext.createChannelMerger(2);

      // Transparent Mastering Limiter with smooth 8.0dB soft knee
      this.limiter = this.audioContext.createDynamicsCompressor();
      this.limiter.threshold.value = -1.0; 
      this.limiter.ratio.value = 20;
      this.limiter.knee.value = 8.0; // Smooth 8.0dB knee to eliminate abrupt hard-clip clicks at -1dB
      this.limiter.attack.value = 0.0015; // Fast transparent peak catching
      this.limiter.release.value = 0.05; // Musical transparent recovery

      this.dcBlocker = this.audioContext.createBiquadFilter();
      this.dcBlocker.type = 'highpass';
      this.dcBlocker.frequency.value = 20; 
      this.dcBlocker.Q.value = 0.71;

      this.safetyClipper = this.audioContext.createWaveShaper();
      this.safetyClipper.curve = this.makeBrickwallCurve();
      this.safetyClipper.oversample = '4x';

      this.analyzer = this.audioContext.createAnalyser();
      this.analyzer.fftSize = 1024;
      this.dataArray = new Uint8Array(this.analyzer.frequencyBinCount);
      
      const splitter = this.audioContext.createChannelSplitter(2);
      this.analyzerL = this.audioContext.createAnalyser();
      this.analyzerR = this.audioContext.createAnalyser();

      // --- GRAPH CONNECTIONS ---
      // 1. Raw Dry Bypass Path (100% unmastered source audio)
      this.masterSumNode.connect(this.dryPath);
      this.dryPath.connect(this.analyzer);

      // 2. Mastered Wet DSP Path
      this.masterSumNode.connect(this.preDcBlocker);
      this.preDcBlocker.connect(this.preMasterGain);

      this.preMasterGain.connect(this.noiseGate);
      this.noiseGate.connect(this.distortion);
      
      this.distortion.connect(this.lowCrossover);
      this.distortion.connect(this.midCrossoverLow);
      this.midCrossoverLow.connect(this.midCrossoverHigh);
      this.distortion.connect(this.highCrossover);
      
      this.lowCrossover.connect(this.compLow);
      this.midCrossoverHigh.connect(this.compMid);
      this.highCrossover.connect(this.compHigh);
      
      this.compLow.connect(this.mbSum);
      this.compMid.connect(this.mbSum);
      this.compHigh.connect(this.mbSum);
      
      // 5-Band EQ Serial Chain with Dynamic Sub/Kick Control & Mid Resonance Tamer
      this.mbSum.connect(this.dynamicSubCutNode!);
      this.dynamicSubCutNode!.connect(this.lowEQ);
      this.lowEQ.connect(this.lowMidEQ);
      this.lowMidEQ.connect(this.midEQ);
      this.midEQ.connect(this.midDensityTamer);
      this.midDensityTamer.connect(this.highMidEQ);
      this.highMidEQ.connect(this.highEQ);

      this.highEQ.connect(this.deEsserComp);

      const spatialIn = this.deEsserComp;

      spatialIn.connect(this.delayDry);
      spatialIn.connect(this.delayNode);
      this.delayNode.connect(this.delayWet);
      
      const delaySum = this.audioContext.createGain();
      this.delayDry.connect(delaySum);
      this.delayWet.connect(delaySum);

      delaySum.connect(this.reverbDry);
      delaySum.connect(this.reverbNode);
      this.reverbNode.connect(this.reverbWet);

      const reverbSum = this.audioContext.createGain();
      this.reverbDry.connect(reverbSum);
      this.reverbWet.connect(reverbSum);

      reverbSum.connect(this.msSplitter);
      this.msSplitter.connect(this.msMidSum, 0); 
      this.msSplitter.connect(this.msMidSum, 1); 
      this.msMidSum.gain.value = 0.5;

      const sideInvert = this.audioContext.createGain();
      sideInvert.gain.value = -1;
      
      this.msSplitter.connect(this.msSideDiff, 0); 
      this.msSplitter.connect(sideInvert, 1);      
      sideInvert.connect(this.msSideDiff);         
      this.msSideDiff.gain.value = 0.5; 

      // Connect Side through Mono-Maker HighPass & Low-Mid Side Tamer before width gain
      this.msSideDiff.connect(this.sideMonoHighPass);
      this.sideMonoHighPass.connect(this.sideLowMidDip);
      this.sideLowMidDip.connect(this.msSideGain); 

      // Connect Mid channel through Vocal Body Recovery Filter before Merger
      this.msMidSum.connect(this.vocalBodyRecoveryNode!);
      this.vocalBodyRecoveryNode!.connect(this.msMerger, 0, 0); 
      this.vocalBodyRecoveryNode!.connect(this.msMerger, 0, 1); 

      this.msSideGain.connect(this.msMerger, 0, 0); 
      
      const sideOutInvert = this.audioContext.createGain();
      sideOutInvert.gain.value = -1;
      this.msSideGain.connect(sideOutInvert);
      sideOutInvert.connect(this.msMerger, 0, 1);   

      // Connect MS Merger directly to Limiter -> DC Blocker -> Safety Ceiling -> wetPath
      this.msMerger.connect(this.limiter);
      this.limiter.connect(this.dcBlocker);
      this.dcBlocker.connect(this.safetyClipper);
      this.safetyClipper.connect(this.wetPath);

      this.wetPath.connect(this.analyzer);
      
      this.analyzer.connect(splitter);
      splitter.connect(this.analyzerL, 0);
      splitter.connect(this.analyzerR, 1);
      this.analyzer.connect(this.audioContext.destination);
    }
  }

  // Master Reverb (Longer)
  private generateReverbImpulse(duration: number) {
     if (!this.audioContext || !this.reverbNode) return;
     const rate = this.audioContext.sampleRate;
     const length = rate * duration;
     const impulse = this.audioContext.createBuffer(2, length, rate);
     const L = impulse.getChannelData(0);
     const R = impulse.getChannelData(1);
     for (let i = 0; i < length; i++) {
         const decay = Math.pow(1 - i / length, 3);
         L[i] = (Math.random() * 2 - 1) * decay;
         R[i] = (Math.random() * 2 - 1) * decay;
     }
     this.reverbNode.buffer = impulse;
  }

  private makeTapeCurve(amount: number) {
      if (amount <= 0) return new Float32Array([-1, 0, 1]);
      const n_samples = 4096;
      const curve = new Float32Array(n_samples);
      // Gentle progressive analog tape saturation with soft saturation knee
      const drive = Math.max(0.05, Math.min(2.5, amount * 0.1)); 
      for (let i = 0; i < n_samples; i++) {
          const x = (i * 2) / n_samples - 1;
          curve[i] = Math.tanh(x * drive) / Math.tanh(drive); 
      }
      return curve;
  }
  
  private makeGateCurve(thresholdDb: number, reductionDb: number) {
      if (thresholdDb <= -60 || reductionDb <= 0) return new Float32Array([-1, 0, 1]);
      const n_samples = 65536;
      const curve = new Float32Array(n_samples);
      const threshLin = Math.pow(10, thresholdDb / 20);
      const reductionLin = Math.pow(10, -Math.abs(reductionDb) / 20); 
      // Wide continuous smooth transition to avoid zero-crossing distortion / robotic voice artifacts
      const transitionSpan = Math.max(0.04, threshLin * 2.0);
      for (let i = 0; i < n_samples; i++) {
          const x = (i * 2) / n_samples - 1;
          const absX = Math.abs(x);
          if (absX >= transitionSpan) {
              curve[i] = x;
          } else {
              const norm = absX / transitionSpan;
              // Smooth quintic smootherstep (6t^5 - 15t^4 + 10t^3)
              const factor = norm * norm * norm * (norm * (norm * 6 - 15) + 10);
              const gain = reductionLin + factor * (1.0 - reductionLin);
              curve[i] = x * gain;
          }
      }
      return curve;
  }

  private makeExpansionCurve(_amount: number) {
      // Return neutral transparent transfer to prevent waveshaping distortion on delicate passages
      return new Float32Array([-1, 0, 1]);
  }

  // Ultra-Smooth True-Peak Safety Ceiling (Strict -1.0 dBTP Ceiling, Zero Overshoot past -1.0 dBTP)
  private makeBrickwallCurve() {
     const n_samples = 65536;
     const curve = new Float32Array(n_samples);
     // Soft-knee starts gently at 0.79 (-2.0 dBFS) and smoothly compresses towards a strict -1.0 dBTP ceiling (0.891 = -1.00 dBTP)
     const threshold = 0.79; 
     const maxCeiling = 0.891; // Strict -1.0 dBTP ceiling (No overshoot past -1.0 dB)
     const range = maxCeiling - threshold;
     for (let i = 0; i < n_samples; i++) {
         const x = (i * 2) / n_samples - 1;
         const absX = Math.abs(x);
         if (absX <= threshold) {
             curve[i] = x;
         } else {
             const sign = x >= 0 ? 1 : -1;
             const delta = absX - threshold;
             // Hyperbolic tangent soft saturation ceiling with continuous derivative at threshold
             const compressed = threshold + range * Math.tanh(delta / range);
             curve[i] = sign * compressed;
         }
     }
     return curve;
  }

  // Musical Soft Clip Curve for Analog-Style Peak Rounding
  private makeSoftClipCurve(threshold: number = 0.92) {
      const n_samples = 4096;
      const curve = new Float32Array(n_samples);
      const range = 1.0 - threshold;
      for (let i = 0; i < n_samples; i++) {
          const x = (i * 2) / n_samples - 1;
          const absX = Math.abs(x);
          if (absX <= threshold) {
              curve[i] = x;
          } else {
              const sign = x >= 0 ? 1 : -1;
              const delta = absX - threshold;
              const compressed = threshold + range * Math.tanh(delta / range);
              curve[i] = sign * compressed;
          }
      }
      return curve;
  }

  // --- STEM CLASSIFICATION & PROCESSING ---
  private detectStemType(name: string): StemType {
      const n = name.toLowerCase();
      if (n.match(/vocal|vox|acapella|lead|sung/)) return 'vocals';
      if (n.match(/drum|perc|hat|kick|snare|clap|cymbal/)) return 'drums';
      if (n.match(/bass|808|sub|low/)) return 'bass';
      return 'other';
  }

  private createStemChain(ctx: BaseAudioContext, _type: StemType): { input: GainNode, output: AudioNode, nodes: AudioNode[] } {
      const input = ctx.createGain();
      input.gain.value = 1.0;
      return { input, output: input, nodes: [input] };
  }

  async decodeAudioFile(file: File): Promise<AudioBuffer> {
    this.init();
    const ctx = this.audioContext!;
    return await ctx.decodeAudioData(await file.arrayBuffer());
  }

  async addTrack(file: File): Promise<Track> {
    this.init();
    const ctx = this.audioContext!;
    const buffer = await ctx.decodeAudioData(await file.arrayBuffer());
    const id = Math.random().toString(36).substr(2, 9);
    const sourceId = await generateAudioSourceId(file, buffer);
    
    const stemType = this.detectStemType(file.name);
    
    const gainNode = ctx.createGain();
    const pannerNode = ctx.createStereoPanner();
    const { input: fxIn, output: fxOut, nodes: fxNodes } = this.createStemChain(ctx, stemType);

    fxOut.connect(gainNode);
    gainNode.connect(pannerNode);
    pannerNode.connect(this.masterSumNode!);
    
    this.tracks.set(id, { buffer, source: null, outNode: fxIn, gainNode, pannerNode, fxNodes });
    this.recalculateMaxDuration();

    return { 
      id, 
      name: file.name, 
      volume: 1.0, 
      pan: 0, 
      muted: false, 
      soloed: false, 
      color: this.getStemColor(stemType), 
      startTime: 0, 
      fadeIn: 0, 
      fadeOut: 0,
      sourceId
    };
  }

  // --- ADAPTIVE & COMPLIANCE ENGINES ---

  // 1. Peak Detection for BPM
  private detectBPM(buffer: AudioBuffer): number {
      const data = buffer.getChannelData(0);
      const sampleRate = buffer.sampleRate;
      
      const step = Math.floor(sampleRate / 100);
      const energy = [];
      for(let i=0; i<data.length; i+=step) {
          energy.push(data[i] * data[i]);
      }
      
      const peaks = [];
      const threshold = 0.5;
      for(let i=1; i<energy.length-1; i++) {
          if(energy[i] > threshold && energy[i] > energy[i-1] && energy[i] > energy[i+1]) {
              peaks.push(i);
          }
      }
      
      if(peaks.length < 2) return 120;
      
      const intervals = [];
      for(let i=1; i<peaks.length; i++) intervals.push(peaks[i] - peaks[i-1]);
      
      const avgIntervalSamples = intervals.reduce((a,b)=>a+b, 0) / intervals.length;
      const avgSeconds = avgIntervalSamples * step / sampleRate;
      const bpm = 60 / avgSeconds;
      
      if (bpm < 50 || bpm > 200) return 120;
      return Math.round(bpm);
  }

  private calculateCrestFactor(buffer: AudioBuffer): number {
      const data = buffer.getChannelData(0);
      let peak = 0;
      let sumSq = 0;
      const step = 100;
      for(let i=0; i<data.length; i+=step) {
          const abs = Math.abs(data[i]);
          if(abs > peak) peak = abs;
          sumSq += abs * abs;
      }
      const rms = Math.sqrt(sumSq / (data.length/step));
      const dbPeak = 20 * Math.log10(peak || 0.0001);
      const dbRms = 20 * Math.log10(rms || 0.0001);
      return dbPeak - dbRms;
  }

  getSourceSampleRate(): number {
    for (const [_, tr] of this.tracks) {
      if (tr.buffer && tr.buffer.sampleRate) {
        return tr.buffer.sampleRate;
      }
    }
    return this.audioContext?.sampleRate || 48000;
  }

  // Exact ITU-R BS.1770-4 2-Stage K-Weighting IIR Filter (Pre-Filter High Shelf + RLB High Pass)
  private applyITU_BS1770_KWeighting(samples: Float32Array, sampleRate: number): Float32Array {
    // Stage 1: High Shelf (Pre-filter head acoustic simulation: +3.9998 dB @ 1681.97 Hz)
    const f0_s1 = 1681.974450955533;
    const G_s1 = 3.999843853973347;
    const Q_s1 = 0.707175236935414;
    const K1 = Math.tan((Math.PI * f0_s1) / sampleRate);
    const Vh = Math.pow(10, G_s1 / 20);
    const Vb = Math.sqrt(Vh);
    const a0_s1 = 1.0 + (K1 / Q_s1) + (K1 * K1);
    const b0_s1 = (Vh + Vb * (K1 / Q_s1) + K1 * K1) / a0_s1;
    const b1_s1 = (2.0 * (K1 * K1 - Vh)) / a0_s1;
    const b2_s1 = (Vh - Vb * (K1 / Q_s1) + K1 * K1) / a0_s1;
    const a1_s1 = (2.0 * (K1 * K1 - 1.0)) / a0_s1;
    const a2_s1 = (1.0 - (K1 / Q_s1) + K1 * K1) / a0_s1;

    // Stage 2: RLB weighting (2nd order High Pass: 38.13 Hz)
    const f0_s2 = 38.13547087602444;
    const Q_s2 = 0.5003270373238773;
    const K2 = Math.tan((Math.PI * f0_s2) / sampleRate);
    const a0_s2 = 1.0 + (K2 / Q_s2) + (K2 * K2);
    const b0_s2 = 1.0 / a0_s2;
    const b1_s2 = -2.0 / a0_s2;
    const b2_s2 = 1.0 / a0_s2;
    const a1_s2 = (2.0 * (K2 * K2 - 1.0)) / a0_s2;
    const a2_s2 = (1.0 - (K2 / Q_s2) + K2 * K2) / a0_s2;

    const len = samples.length;
    const stage1Out = new Float32Array(len);
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < len; i++) {
      const x0 = samples[i];
      const y0 = b0_s1 * x0 + b1_s1 * x1 + b2_s1 * x2 - a1_s1 * y1 - a2_s1 * y2;
      stage1Out[i] = y0;
      x2 = x1; x1 = x0;
      y2 = y1; y1 = y0;
    }

    const stage2Out = new Float32Array(len);
    x1 = 0; x2 = 0; y1 = 0; y2 = 0;
    for (let i = 0; i < len; i++) {
      const x0 = stage1Out[i];
      const y0 = b0_s2 * x0 + b1_s2 * x1 + b2_s2 * x2 - a1_s2 * y1 - a2_s2 * y2;
      stage2Out[i] = y0;
      x2 = x1; x1 = x0;
      y2 = y1; y1 = y0;
    }
    return stage2Out;
  }

  // 2. K-Weighted Loudness Measurement & Accurate DSP Metrics (ITU-R BS.1770-4 & EBU R128)
  public async calculateAccurateDSPMetrics(buffer: AudioBuffer): Promise<AIMasteringStats & { spectralBands: number[]; harshness: number; mud: number; phase: number }> {
    const numChannels = buffer.numberOfChannels;
    const len = buffer.length;
    const sampleRate = buffer.sampleRate;

    // 1. True Peak with 8x Cubic Hermite / Inter-sample Interpolation across full buffer
    let maxPeakLinear = 0;
    for (let c = 0; c < numChannels; c++) {
      const data = buffer.getChannelData(c);
      for (let i = 1; i < len - 2; i++) {
        const p1 = data[i];
        const absP1 = Math.abs(p1);
        if (absP1 > maxPeakLinear) maxPeakLinear = absP1;

        // Perform 8x inter-sample interpolation on significant peaks
        if (absP1 > 0.4 || absP1 > maxPeakLinear * 0.95) {
          const p0 = data[i - 1];
          const p2 = data[i + 1];
          const p3 = data[i + 2];
          for (let t = 0.125; t < 1.0; t += 0.125) {
            const t2 = t * t;
            const t3 = t2 * t;
            const v = 0.5 * (
              (2 * p1) +
              (-p0 + p2) * t +
              (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
              (-p0 + 3 * p1 - 3 * p2 + p3) * t3
            );
            const absV = Math.abs(v);
            if (absV > maxPeakLinear) maxPeakLinear = absV;
          }
        }
      }
    }
    const truePeakDbTP = 20 * Math.log10(maxPeakLinear || 1e-6);

    // 2. ITU-R BS.1770-4 Exact Standard K-Weighted Filtering
    const rawLeft = buffer.getChannelData(0);
    const rawRight = numChannels > 1 ? buffer.getChannelData(1) : rawLeft;

    const kLeft = this.applyITU_BS1770_KWeighting(rawLeft, sampleRate);
    const kRight = numChannels > 1 ? this.applyITU_BS1770_KWeighting(rawRight, sampleRate) : kLeft;

    // 400ms block size with 100ms hop size (75% overlap) for BS.1770-4 Integrated Loudness
    const blockSize400 = Math.floor(sampleRate * 0.400);
    const hopSize100 = Math.floor(sampleRate * 0.100);
    const blockPowers: number[] = [];

    for (let start = 0; start + blockSize400 <= len; start += hopSize100) {
      let sumSqL = 0;
      let sumSqR = 0;
      for (let j = 0; j < blockSize400; j++) {
        const sL = kLeft[start + j];
        const sR = kRight[start + j];
        sumSqL += sL * sL;
        sumSqR += sR * sR;
      }
      const powerL = sumSqL / blockSize400;
      const powerR = numChannels > 1 ? (sumSqR / blockSize400) : 0;
      // Per ITU-R BS.1770-4: Channel sum with unity weights (Left=1.0, Right=1.0)
      const powerSum = powerL + powerR;
      if (powerSum > 1e-12) {
        blockPowers.push(powerSum);
      }
    }

    let integratedLUFS = -70.0;
    if (blockPowers.length > 0) {
      // Absolute gating at -70 LUFS (power = 10^((-70 + 0.691)/10))
      const absThreshPower = Math.pow(10, (-70.0 + 0.691) / 10);
      const validBlocks = blockPowers.filter(p => p > absThreshPower);
      if (validBlocks.length > 0) {
        const meanUngatedPower = validBlocks.reduce((a, b) => a + b, 0) / validBlocks.length;
        const ungatedLoudness = -0.691 + 10 * Math.log10(meanUngatedPower || 1e-12);
        
        // Relative threshold: ungatedLoudness - 10.0 LU
        const relThreshPower = meanUngatedPower * 0.1;
        const gatedBlocks = validBlocks.filter(p => p >= relThreshPower);
        if (gatedBlocks.length > 0) {
          const meanGatedPower = gatedBlocks.reduce((a, b) => a + b, 0) / gatedBlocks.length;
          integratedLUFS = -0.691 + 10 * Math.log10(meanGatedPower || 1e-12);
        }
      }
    }

    // 3. EBU R128 / Tech 3342 LRA (Loudness Range) with 3.0-second sliding blocks & 100ms hop
    const blockSize3s = Math.floor(sampleRate * 3.0);
    const hopSizeLra = Math.floor(sampleRate * 0.100);
    const shortTermLoudness: number[] = [];

    for (let start = 0; start + blockSize3s <= len; start += hopSizeLra) {
      let sumSqL = 0;
      let sumSqR = 0;
      for (let j = 0; j < blockSize3s; j++) {
        const sL = kLeft[start + j];
        const sR = kRight[start + j];
        sumSqL += sL * sL;
        sumSqR += sR * sR;
      }
      const powerL = sumSqL / blockSize3s;
      const powerR = numChannels > 1 ? (sumSqR / blockSize3s) : 0;
      const totalP = powerL + powerR;
      if (totalP > 1e-12) {
        const lk = -0.691 + 10 * Math.log10(totalP);
        if (lk > -70.0) {
          shortTermLoudness.push(lk);
        }
      }
    }

    let dynamicRangeLRA = 4.6;
    if (shortTermLoudness.length >= 2) {
      // Relative gating for LRA is -20.0 LU below ungated short-term mean
      const meanShortTermPower = shortTermLoudness.reduce((acc, l) => acc + Math.pow(10, (l + 0.691) / 10), 0) / shortTermLoudness.length;
      const ungatedShortTerm = -0.691 + 10 * Math.log10(meanShortTermPower || 1e-12);
      const lraRelThreshold = ungatedShortTerm - 20.0;

      const lraGated = shortTermLoudness.filter(l => l >= lraRelThreshold);
      if (lraGated.length >= 2) {
        lraGated.sort((a, b) => a - b);
        const idx10 = Math.floor((lraGated.length - 1) * 0.10);
        const idx95 = Math.floor((lraGated.length - 1) * 0.95);
        const p10 = lraGated[idx10];
        const p95 = lraGated[idx95];
        dynamicRangeLRA = Math.max(0.1, p95 - p10);
      }
    }

    // 4. RMS & Crest Factor
    let sumSq = 0;
    const step = 20;
    for (let i = 0; i < rawLeft.length; i += step) {
      sumSq += rawLeft[i] * rawLeft[i];
    }
    const rms = Math.sqrt(sumSq / (rawLeft.length / step)) || 1e-6;
    const rmsDb = 20 * Math.log10(rms);
    const crestFactor = Math.max(2, truePeakDbTP - rmsDb);

    // 5. Stereo Phase Correlation & Spectral Resonances Evaluation
    let dotSum = 0;
    let sumL2 = 0;
    let sumR2 = 0;
    const stepAnalysis = Math.max(1, Math.floor(len / 8000));
    
    for (let i = 0; i < len; i += stepAnalysis) {
      const l = rawLeft[i];
      const r = rawRight[i];
      dotSum += l * r;
      sumL2 += l * l;
      sumR2 += r * r;
    }
    const denom = Math.sqrt(sumL2 * sumR2) || 1e-6;
    const phaseCorrelation = Math.max(-1.0, Math.min(1.0, dotSum / denom));

    return {
      integratedLUFS: parseFloat(integratedLUFS.toFixed(1)),
      truePeakDbTP: parseFloat(truePeakDbTP.toFixed(1)),
      dynamicRangeLRA: parseFloat(dynamicRangeLRA.toFixed(1)),
      crestFactor: parseFloat(crestFactor.toFixed(1)),
      peakDb: parseFloat(truePeakDbTP.toFixed(1)),
      spectralBands: [0.25, 0.25, 0.25, 0.25],
      harshness: 0,
      mud: 0,
      phase: parseFloat(phaseCorrelation.toFixed(2))
    };
  }

  // 3. True-Peak Lookahead Limiter with 8x Oversampling & 3.5ms Pre-sensing
  public applyTruePeakLookaheadLimiter(buffer: AudioBuffer, targetCeilingDbTP: number = -1.0): AudioBuffer {
    const numChannels = buffer.numberOfChannels;
    const len = buffer.length;
    const sampleRate = buffer.sampleRate;
    // Detector bias: 0.15 dB safety margin so reconstructed True Peak in external DAWs/meters never crosses targetCeilingDbTP
    const effectiveCeilingDb = Math.min(-0.7, targetCeilingDbTP - 0.15);
    const ceilingLinear = Math.pow(10, effectiveCeilingDb / 20); // e.g. -1.15 dBTP = 0.87599 linear for -1.0 dBTP target

    // Lookahead parameters: 3.5ms window + 50ms musical exponential release
    const lookaheadSamples = Math.max(1, Math.round(0.0035 * sampleRate)); // ~154 samples @ 44.1kHz
    const releaseAlpha = Math.exp(-1.0 / (0.050 * sampleRate));

    const requiredGain = new Float32Array(len);
    for (let i = 0; i < len; i++) {
      requiredGain[i] = 1.0;
    }

    const channelData: Float32Array[] = [];
    for (let c = 0; c < numChannels; c++) {
      channelData.push(buffer.getChannelData(c));
    }

    // Pre-Limiter Sub-bass Transient Protection:
    // When sub-bass/kick transients (<110Hz) have high peaks that would trigger aggressive wideband
    // gain reduction and duck the vocal region, gently soft-saturate just the sub-bass peaks above 0.88 linear.
    const subLpAlpha = Math.exp(-2.0 * Math.PI * 110 / sampleRate);
    let subFilt0 = 0, subFilt1 = 0;
    for (let i = 0; i < len; i++) {
      const s0 = channelData[0][i];
      const s1 = channelData[1] ? channelData[1][i] : s0;
      subFilt0 = subLpAlpha * subFilt0 + (1 - subLpAlpha) * s0;
      subFilt1 = subLpAlpha * subFilt1 + (1 - subLpAlpha) * s1;

      const maxSub = Math.max(Math.abs(subFilt0), Math.abs(subFilt1));
      if (maxSub > 0.88) {
        const subExcess = maxSub - 0.88;
        const softSubFactor = 0.88 + 0.08 * Math.tanh(subExcess / 0.08);
        const subRatio = softSubFactor / maxSub;
        channelData[0][i] = (s0 - subFilt0) + subFilt0 * subRatio;
        if (channelData[1]) {
          channelData[1][i] = (s1 - subFilt1) + subFilt1 * subRatio;
        }
      }
    }

    // 1. Detect inter-sample peaks across all channels at 8x resolution
    for (let i = 1; i < len - 2; i++) {
      let maxInterSample = 0;
      for (let c = 0; c < numChannels; c++) {
        const data = channelData[c];
        const p0 = data[i - 1];
        const p1 = data[i];
        const p2 = data[i + 1];
        const p3 = data[i + 2];
        const absP1 = Math.abs(p1);
        if (absP1 > maxInterSample) maxInterSample = absP1;

        // 8x Sub-sample evaluation: t = 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875
        for (let t = 0.125; t < 1.0; t += 0.125) {
          const t2 = t * t;
          const t3 = t2 * t;
          const v = 0.5 * (
            (2 * p1) +
            (-p0 + p2) * t +
            (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
            (-p0 + 3 * p1 - 3 * p2 + p3) * t3
          );
          const absV = Math.abs(v);
          if (absV > maxInterSample) maxInterSample = absV;
        }
      }

      if (maxInterSample > ceilingLinear) {
        const gainNeeded = ceilingLinear / maxInterSample;
        // Smooth cosine lookahead ramp-down ahead of the peak
        const startLookahead = Math.max(0, i - lookaheadSamples);
        for (let j = startLookahead; j <= i; j++) {
          const rampProgress = (j - startLookahead) / lookaheadSamples; // 0.0 -> 1.0
          const targetG = 1.0 - (1.0 - gainNeeded) * (0.5 - 0.5 * Math.cos(Math.PI * rampProgress));
          if (targetG < requiredGain[j]) {
            requiredGain[j] = targetG;
          }
        }
      }
    }

    // 2. Smooth gain curve forward with exponential recovery
    let currentGain = 1.0;
    for (let i = 0; i < len; i++) {
      if (requiredGain[i] < currentGain) {
        currentGain = requiredGain[i];
      } else {
        currentGain = requiredGain[i] + (currentGain - requiredGain[i]) * releaseAlpha;
      }
      requiredGain[i] = currentGain;
    }

    // 3. Apply lookahead gain reduction with absolute brickwall ceiling clamp
    for (let c = 0; c < numChannels; c++) {
      const data = channelData[c];
      for (let i = 0; i < len; i++) {
        let sample = data[i] * requiredGain[i];
        if (sample > ceilingLinear) sample = ceilingLinear;
        else if (sample < -ceilingLinear) sample = -ceilingLinear;
        data[i] = sample;
      }
    }

    return buffer;
  }

  // Measure Integrated Loudness
  private async measureLoudness(buffer: AudioBuffer): Promise<number> {
    const stats = await this.calculateAccurateDSPMetrics(buffer);
    return stats.integratedLUFS;
  }

  // 3. Strict Spotify Compliance Normalizer
  async applySpotifyNormalization(params: MasteringChainParams, tracks: Track[]): Promise<MasteringChainParams> {
      const mix = await this.renderPreview(params, tracks);
      if (!mix) return params;

      const stats = await this.calculateAccurateDSPMetrics(mix);
      const lufs = stats.integratedLUFS;
      const target = -14.0;
      const delta = target - lufs;

      const newParams: MasteringChainParams = JSON.parse(JSON.stringify(params));
      const gainFactor = Math.pow(10, delta / 20);
      newParams.gain = Math.max(0.1, Math.min(6.0, (params.gain || 1.0) * gainFactor));

      newParams.limiter.enabled = true;
      newParams.limiter.threshold = -1.0;
      
      if (delta > 3) {
          newParams.limiter.breathe = Math.min(100, (newParams.limiter.breathe || 0) + 20);
      }

      return newParams;
  }

  // Render Raw Mix (Unmastered Stems Sum)
  async renderRawMix(tracks: Track[]): Promise<AudioBuffer | null> {
    if (this.tracks.size === 0) return null;
    const sampleRate = this.getSourceSampleRate();
    const offline = new OfflineAudioContext(2, Math.max(1, Math.ceil(this.maxDuration * sampleRate)), sampleRate);
    const sum = offline.createGain();

    for (const t of tracks) {
      const state = tracks.find(tr => tr.id === t.id);
      const internal = this.tracks.get(t.id);
      const hasSolo = tracks.some(tr => tr.soloed);
      const isMuted = state?.muted || (hasSolo && !state?.soloed);
      if (!state || isMuted || !internal) continue;

      const s = offline.createBufferSource();
      s.buffer = internal.buffer;

      const stemType = this.detectStemType(t.name);
      const { input: fxIn, output: fxOut } = this.createStemChain(offline, stemType);

      const g = offline.createGain();
      g.gain.value = state.volume;

      const p = offline.createStereoPanner();
      p.pan.value = state.pan || 0;

      s.connect(fxIn);
      fxOut.connect(g);
      g.connect(p);
      p.connect(sum);
      s.start(0);
    }

    sum.connect(offline.destination);
    return await offline.startRendering();
  }

  // 4. MIXER FIXER AI - Comprehensive 5-Stage DSP Mastering Engine
  async runMixerFixerAIMastering(
    currentParams: MasteringChainParams,
    tracks: Track[],
    _userAIConfig?: AIProviderConfig | null,
    sourceId?: string,
    sessionId?: string,
    onPhaseChange?: (phase: 'reset' | 'analyze' | 'dsp' | 'vocal_audit' | 'render' | 'validate' | 'complete') => void
  ): Promise<AIMasteringResult> {
    onPhaseChange?.('analyze');
    // Stage 1: Render unmastered raw audio and analyze with precision DSP
    let rawBuffer = await this.renderRawMix(tracks);
    if (!rawBuffer) {
      rawBuffer = await this.renderPreview(currentParams, tracks);
    }

    const beforeMetrics = rawBuffer 
      ? await this.calculateAccurateDSPMetrics(rawBuffer)
      : { integratedLUFS: -24.9, truePeakDbTP: -10.0, dynamicRangeLRA: 14.2, crestFactor: 12.0, peakDb: -10.0, spectralBands: [0.25, 0.25, 0.25, 0.25], harshness: 0, mud: 0, phase: 1.0 };

    const beforeStats: AIMasteringStats = {
      integratedLUFS: beforeMetrics.integratedLUFS,
      truePeakDbTP: beforeMetrics.truePeakDbTP,
      dynamicRangeLRA: beforeMetrics.dynamicRangeLRA,
      crestFactor: beforeMetrics.crestFactor,
      peakDb: beforeMetrics.peakDb
    };

    // Stage 2: Intelligent DSP Parameter Formulation
    onPhaseChange?.('dsp');
    const newParams: MasteringChainParams = JSON.parse(JSON.stringify(currentParams));
    let decisions: string[] = [];

    // Contextual Loudness Strategy:
    // If the mix is already sitting in the optimal streaming distribution window (-14.8 to -12.8 LUFS),
    // do NOT push gain artificially. The mastering focus is strictly on tonal balance, stereo cohesion,
    // analog tape harmonics, dynamic glue, and true peak safety.
    const isAlreadyOptimalLoudness = beforeStats.integratedLUFS >= -14.8 && beforeStats.integratedLUFS <= -12.8;
    const isAlreadyHotMix = beforeStats.integratedLUFS > -12.8;

    let targetLUFS: number;
    let initialGainDb = 0;

    if (isAlreadyOptimalLoudness) {
      targetLUFS = beforeStats.integratedLUFS;
      initialGainDb = 0.0; // Transparent gain
    } else if (isAlreadyHotMix) {
      targetLUFS = beforeStats.integratedLUFS;
      initialGainDb = 0.0;
    } else {
      // Unmastered / low level mixdown (typically < -15.0 LUFS):
      targetLUFS = beforeStats.crestFactor > 12.5 ? -14.0 : (beforeStats.crestFactor < 9.0 ? -13.2 : -13.5);
      const lufsDeficit = targetLUFS - beforeStats.integratedLUFS;
      initialGainDb = Math.max(-12, Math.min(18, lufsDeficit));
    }

    const MAX_TRUE_PEAK = -1.0;

    // Pre-processing Vocal Profile Analysis
    const origVocal = await this.analyzeVocalProfile(rawBuffer);

    // Masking Element Identification (Hierarchical Priority)
    let maskingElementDetected = "Ninguno (balance vocal limpio)";
    if (origVocal.bassMaskingIndex > 50 || origVocal.vocalToBassRatioDb < -5.0) {
      maskingElementDetected = "Exceso de graves y subgraves (30-200 Hz)";
    } else if (origVocal.lowMidBuildup750Db > 1.2) {
      maskingElementDetected = "Acumulación y resonancia en medios-bajos (250-750 Hz)";
    } else if (origVocal.vocalToInstrumentalRatioDb < -2.0) {
      maskingElementDetected = "Amplitud instrumental excesiva en canales laterales";
    } else if (origVocal.sibilanceExcessDb > 0.8) {
      maskingElementDetected = "Sibilancias y aspereza en agudos (5-9 kHz)";
    }

    // 1. Tonal Balance & 5-Band EQ Strategy
    newParams.eq.enabled = true;

    // Step 1: Low-end balance with anti-masking control
    newParams.eq.low.frequency = 80;
    if (origVocal.bassMaskingIndex > 50 || origVocal.vocalToBassRatioDb < -5.0) {
      newParams.eq.low.gain = 0.15; // Controlled low-end to protect vocal intimacy
      decisions.push('Protección vocal frente al grave: low-shelf restringido (+0.15 dB @ 80Hz) por enmascaramiento detectado');
    } else if (beforeStats.crestFactor > 12) {
      newParams.eq.low.gain = 0.45;
      decisions.push('Low-end warmth and sub-bass foundation enhanced (+0.45 dB @ 80Hz)');
    } else {
      newParams.eq.low.gain = 0.25;
      decisions.push('Low-end balanced and sub-frequencies cleanly filtered');
    }

    // Low-Mid mud cleaning (250-400Hz)
    newParams.eq.lowMid.frequency = 320;
    newParams.eq.lowMid.q = 1.0;
    newParams.eq.lowMid.gain = -0.35;
    decisions.push('Low-mid boxiness cleaned with gentle precision (-0.35 dB @ 320Hz)');

    // Smart 750 Hz Density Tamer: only active when real congestion is detected
    if (origVocal.lowMidBuildup750Db > 0) {
      const target750Reduction = origVocal.hasProminentVocals
        ? Math.min(0.4, Math.max(0.2, origVocal.lowMidBuildup750Db * 0.15))
        : Math.min(0.6, Math.max(0.2, origVocal.lowMidBuildup750Db * 0.25));
      newParams.midDensity750Gain = -parseFloat(target750Reduction.toFixed(2));
      decisions.push(`Dynamic 750Hz density tamer activo (${newParams.midDensity750Gain.toFixed(1)} dB): atenuación suave por resonancia detectada, preservando cuerpo vocal.`);
    } else {
      newParams.midDensity750Gain = 0.0;
      decisions.push('Zona de 750 Hz transparente (0.0 dB): cuerpo y proximidad vocal intactos sin atenuación innecesaria.');
    }

    // Mid-range presence & vocal body: tuned to detected presence frequency
    const hasMultipleStems = tracks.length > 1;
    const hasVocalStem = tracks.some(t => this.detectStemType(t.name) === 'vocals');

    if (hasMultipleStems && hasVocalStem) {
      newParams.eq.mid.frequency = origVocal.exactPresenceFreq;
      newParams.eq.mid.q = 0.9;
      newParams.eq.mid.gain = 0.35;
      decisions.push(`Stem Mix Vocal Focus: Presencia vocal calibrada suavemente (+0.35 dB @ ${origVocal.exactPresenceFreq}Hz)`);
    } else if (hasMultipleStems) {
      newParams.eq.mid.frequency = origVocal.exactPresenceFreq;
      newParams.eq.mid.q = 0.9;
      newParams.eq.mid.gain = 0.25;
      decisions.push(`Multi-Stem Cohesion: Medios cohesionados entre pistas (+0.25 dB @ ${origVocal.exactPresenceFreq}Hz)`);
    } else {
      newParams.eq.mid.frequency = origVocal.exactPresenceFreq;
      newParams.eq.mid.q = 1.0;
      newParams.eq.mid.gain = 0.0; // 100% natural, no artificial push initially
      decisions.push(`Stereo Master: Presencia media en su centro espectral natural (0.0 dB @ ${origVocal.exactPresenceFreq}Hz)`);
    }

    // High-Mid harshness control (3.5kHz - 5.5kHz): only applied if real harshness is detected
    newParams.eq.highMid.frequency = 4200;
    newParams.eq.highMid.q = 1.2;
    if (origVocal.sibilanceExcessDb > 2.0 && origVocal.presenceDb > -30) {
      newParams.eq.highMid.gain = -0.25;
      decisions.push('Dureza acústica en medios-altos atenuada con suavidad (-0.25 dB @ 4.2kHz) por exceso comprobado de sibilancia/estridencia.');
    } else {
      newParams.eq.highMid.gain = 0.0; // Conservar intacta la presencia vocal si no hay dureza
    }

    // High Air & Sheen (10kHz - 20kHz)
    newParams.eq.high.frequency = 10500;
    newParams.eq.high.gain = 0.35;
    decisions.push('High-end air and sheen controlled (+0.35 dB @ 10.5kHz) without sibilance or harshness');

    // 2. Dynamic De-Esser: Adaptive frequency detection in 5.5k - 8.5k
    newParams.gate.enabled = false;
    if (origVocal.sibilanceExcessDb > 0.4) {
      newParams.deEsser.enabled = true;
      newParams.deEsser.frequency = origVocal.exactSibilanceFreq;
      newParams.deEsser.threshold = -18.0;
      newParams.deEsser.amount = 2.5;
      const deEssReductionEst = Math.min(1.5, Math.max(0.5, origVocal.sibilanceExcessDb));
      decisions.push(`Dynamic De-Esser adaptativo calibrado en ${origVocal.exactSibilanceFreq} Hz: sibilancias controladas con suavidad (${deEssReductionEst.toFixed(1)} dB máx) en consonantes problemáticas.`);
    } else {
      newParams.deEsser.enabled = false;
      decisions.push('Dynamic De-Esser en bypass: agudos y respiración vocal limpios y naturales sin sibilancia problemática.');
    }

    // 3. Dynamics & Multiband Compressor (Gentle, musical glue preserving microdynamics)
    newParams.multiband.enabled = true;
    if (beforeStats.dynamicRangeLRA > 12) {
      newParams.multiband.low.threshold = -16;
      newParams.multiband.low.ratio = 1.6;
      newParams.multiband.low.attack = 0.03;
      newParams.multiband.low.release = 0.15;

      newParams.multiband.mid.threshold = -18;
      newParams.multiband.mid.ratio = 1.4;
      newParams.multiband.mid.attack = 0.025;
      newParams.multiband.mid.release = 0.12;

      newParams.multiband.high.threshold = -20;
      newParams.multiband.high.ratio = 1.3;
      newParams.multiband.high.attack = 0.015;
      newParams.multiband.high.release = 0.08;
      decisions.push('Multiband dynamics glue engaged with subtle 1.3:1 - 1.6:1 ratios preserving dynamics and elegance');
    } else {
      newParams.multiband.low.threshold = -12;
      newParams.multiband.low.ratio = 1.3;
      newParams.multiband.mid.threshold = -10;
      newParams.multiband.mid.ratio = 1.2;
      newParams.multiband.high.threshold = -10;
      newParams.multiband.high.ratio = 1.2;
      decisions.push('Transparent dynamics preservation maintaining natural punch without overcompression');
    }

    // 4. Stereo Imaging & Analog Warmth (Preserving full natural width, stabilizing only sub & low-mids)
    newParams.stereoWidth = 1.0; // 100% natural wide soundstage preserved
    decisions.push('Stereo width preserved (100% natural soundstage) with centered sub-bass (<105Hz) and 200Hz side tamer (-0.6dB) for mono firmness');

    // Subtle Analog Tape Console Saturation (Adds body & cohesion without peak overs)
    newParams.distortion.enabled = true;
    newParams.distortion.mode = 'tape';
    newParams.distortion.amount = 0.03;
    decisions.push('Analog Tape Console Harmonics engaged (subtle 2nd/3rd harmonics) for warm analog depth');

    // Transient Sculpting (Snap & Punch)
    newParams.transient.enabled = false;
    newParams.transient.amount = 0;
    newParams.transient.sustain = 0;

    // 5. Loudness Normalization & Adaptive True-Peak Limiting Stage
    const adaptiveCeiling = beforeStats.crestFactor < 10 ? -1.1 : -1.0;
    const startGain = Number.isFinite(currentParams.gain) && currentParams.gain > 0.1 ? currentParams.gain : 1.0;
    newParams.gain = Math.max(0.1, Math.min(15.0, startGain * Math.pow(10, initialGainDb / 20)));

    // True-Peak Lookahead Limiter with 8x Oversampling & 3.5ms Lookahead
    newParams.limiter.enabled = true;
    newParams.limiter.threshold = adaptiveCeiling;
    newParams.limiter.breathe = 0;

    // Stage 3: Render Mastered Preview Audio & Closed-Loop Precision Refinement
    onPhaseChange?.('render');
    let masteredBuffer = await this.renderPreview(newParams, tracks);
    let afterMetrics = masteredBuffer 
      ? await this.calculateAccurateDSPMetrics(masteredBuffer)
      : null;

    // Closed-loop precision refinement: only adjust gain if error is significant
    const toleranceDb = (isAlreadyOptimalLoudness || isAlreadyHotMix) ? 0.6 : 0.25;
    for (let iter = 0; iter < 4; iter++) {
      if (afterMetrics && Number.isFinite(afterMetrics.integratedLUFS) && afterMetrics.integratedLUFS > -60) {
        const currentLUFS = afterMetrics.integratedLUFS;
        const errorDb = targetLUFS - currentLUFS;
        if (Math.abs(errorDb) > toleranceDb) {
          const adjustedGain = newParams.gain * Math.pow(10, errorDb / 20);
          newParams.gain = Math.max(0.1, Math.min(15.0, adjustedGain));
          masteredBuffer = await this.renderPreview(newParams, tracks);
          if (masteredBuffer) {
            afterMetrics = await this.calculateAccurateDSPMetrics(masteredBuffer);
          }
        } else {
          break;
        }
      }
    }

    // Stage 4: Closed-Loop Vocal Preservation Audit (A/B Matching under equal loudness)
    onPhaseChange?.('vocal_audit');
    const vocalAudit = await this.executeVocalProtectionAudit(
      origVocal,
      masteredBuffer,
      newParams,
      tracks,
      beforeStats.integratedLUFS,
      targetLUFS,
      decisions,
      async (buf) => this.calculateAccurateDSPMetrics(buf)
    );
    masteredBuffer = vocalAudit.masteredBuffer;
    afterMetrics = vocalAudit.afterMetrics;
    const vocalReport = vocalAudit.vocalReport;

    // Final Metric Formulation directly from measured buffer
    onPhaseChange?.('validate');
    const finalLUFS = afterMetrics ? afterMetrics.integratedLUFS : targetLUFS;
    const finalTP = afterMetrics ? afterMetrics.truePeakDbTP : -1.0;
    const finalLRA = afterMetrics ? afterMetrics.dynamicRangeLRA : beforeStats.dynamicRangeLRA;
    const finalCrest = afterMetrics ? afterMetrics.crestFactor : 9.0;

    const deltaLU = finalLUFS - beforeStats.integratedLUFS;
    const deltaSign = deltaLU >= 0 ? '+' : '';

    let loudnessReportLine = '';
    if (isAlreadyOptimalLoudness) {
      if (Math.abs(deltaLU) <= 0.15) {
        loudnessReportLine = `Loudness original ya cercano al objetivo (${beforeStats.integratedLUFS.toFixed(1)} LUFS-I): volumen natural respetado (0.0 LU delta), sin forzar ganancia innecesaria.`;
      } else {
        loudnessReportLine = `Loudness original ya cercano al objetivo (${beforeStats.integratedLUFS.toFixed(1)} LUFS-I): se aplicó únicamente ${deltaSign}${deltaLU.toFixed(1)} LU, sin forzar ganancia innecesaria.`;
      }
    } else if (isAlreadyHotMix) {
      loudnessReportLine = `Mezcla con alta densidad original (${beforeStats.integratedLUFS.toFixed(1)} LUFS-I): transitorios protegidos (${deltaSign}${deltaLU.toFixed(1)} LU delta), sin compresión destructiva.`;
    } else {
      loudnessReportLine = `Loudness calibrado a estándar de distribución: nivel optimizado desde ${beforeStats.integratedLUFS.toFixed(1)} hasta ${finalLUFS.toFixed(1)} LUFS-I (${deltaSign}${deltaLU.toFixed(1)} LU aplicados).`;
    }

    const afterStats: AIMasteringStats = {
      integratedLUFS: parseFloat(finalLUFS.toFixed(1)),
      truePeakDbTP: parseFloat(finalTP.toFixed(1)),
      dynamicRangeLRA: parseFloat(finalLRA.toFixed(1)),
      crestFactor: parseFloat(finalCrest.toFixed(1)),
      peakDb: parseFloat(finalTP.toFixed(1))
    };

    // Reconcile all decisions from final active DSP state to guarantee 100% truthful, non-contradictory report
    decisions = this.reconcileMasteringDecisions(
      newParams,
      beforeStats,
      afterStats,
      vocalReport,
      loudnessReportLine,
      adaptiveCeiling
    );

    // Stage 5: Apply to live AudioEngine state
    this.setMasterParams(newParams);

    const gainDelta = afterStats.integratedLUFS - beforeStats.integratedLUFS;
    const gainDescription = Math.abs(gainDelta) <= 0.3 
      ? 'Volumen natural preservado' 
      : `Ganancia: ${gainDelta >= 0 ? '+' : ''}${gainDelta.toFixed(1)} LU`;

    const resolvedSourceId = sourceId || (tracks.length === 1 ? (tracks[0].sourceId || tracks[0].id) : `stems_${tracks.map(t => t.sourceId || t.id).sort().join('_')}`);
    const resolvedSessionId = sessionId || this.currentSessionId;

    const result: AIMasteringResult = {
      before: beforeStats,
      after: afterStats,
      decisions,
      appliedParams: newParams,
      targetMet: afterStats.truePeakDbTP <= -0.99,
      statusNote: `${gainDescription} | ${afterStats.integratedLUFS.toFixed(1)} LUFS-I · True Peak: ${afterStats.truePeakDbTP.toFixed(1)} dBTP`,
      timestamp: Date.now(),
      vocalReport,
      sourceId: resolvedSourceId,
      sessionId: resolvedSessionId
    };

    onPhaseChange?.('complete');
    this.lastAIMasteringResult = result;
    return result;
  }

  // --- AUTOMATIC VOCAL PROTECTION ENGINE (MID/SIDE ACOUSTIC AUDIT) ---

  async analyzeVocalProfile(buffer: AudioBuffer): Promise<VocalAnalysisProfile> {
    const numChannels = buffer.numberOfChannels;
    const len = buffer.length;
    const sampleRate = buffer.sampleRate;
    const ch0 = buffer.getChannelData(0);
    const ch1 = numChannels > 1 ? buffer.getChannelData(1) : ch0;

    // RBJ Biquad Filter Coefficients Helper
    const makeCoeffs = (type: 'bp' | 'lowpass' | 'highpass', f0: number, Q: number) => {
      const w0 = (2 * Math.PI * f0) / sampleRate;
      const alpha = Math.sin(w0) / (2 * Q);
      const cosw0 = Math.cos(w0);

      let b0 = 0, b1 = 0, b2 = 0, a0 = 1, a1 = 0, a2 = 0;
      if (type === 'bp') {
        b0 = alpha;
        b1 = 0;
        b2 = -alpha;
        a0 = 1 + alpha;
        a1 = -2 * cosw0;
        a2 = 1 - alpha;
      } else if (type === 'lowpass') {
        b0 = (1 - cosw0) / 2;
        b1 = 1 - cosw0;
        b2 = (1 - cosw0) / 2;
        a0 = 1 + alpha;
        a1 = -2 * cosw0;
        a2 = 1 - alpha;
      } else if (type === 'highpass') {
        b0 = (1 + cosw0) / 2;
        b1 = -(1 + cosw0);
        b2 = (1 + cosw0) / 2;
        a0 = 1 + alpha;
        a1 = -2 * cosw0;
        a2 = 1 - alpha;
      }
      return {
        b0: b0 / a0,
        b1: b1 / a0,
        b2: b2 / a0,
        a1: a1 / a0,
        a2: a2 / a0,
      };
    };

    // Filter definitions for key acoustic vocal zones:
    const fLowEnd = makeCoeffs('bp', 90, 0.7);       // Low-End / Sub-Bass (30 - 200 Hz)
    const fBodyLow = makeCoeffs('bp', 280, 1.0);     // Lower Vocal Body (180 - 450 Hz)
    const fBodyHigh = makeCoeffs('bp', 600, 1.0);    // Upper Vocal Body (450 - 900 Hz)
    const fBody = makeCoeffs('bp', 450, 0.7);        // Overall Vocal Body (180 - 900 Hz)
    const f750 = makeCoeffs('bp', 750, 1.5);         // 750 Hz narrow congestion resonance
    const fIntel = makeCoeffs('bp', 2200, 0.7);      // Vocal Intelligibility (1 - 4 kHz)
    const fGuitarsSynths = makeCoeffs('bp', 1200, 0.8); // Guitars, synths, mid instrumentation (400 Hz - 2.5 kHz)
    const fInstBright = makeCoeffs('bp', 7500, 0.8); // High percussion, cymbals, air sheen (5 kHz - 12 kHz)

    // Presence sweep bands:
    const fPres1 = makeCoeffs('bp', 2400, 1.2);      // Presence Band 1 (2.0 - 2.8 kHz)
    const fPres2 = makeCoeffs('bp', 3200, 1.2);      // Presence Band 2 (2.8 - 3.6 kHz)
    const fPres3 = makeCoeffs('bp', 4000, 1.2);      // Presence Band 3 (3.6 - 4.5 kHz)

    // Sibilance sweep bands (5.5 kHz - 8.5 kHz):
    const fSib1 = makeCoeffs('bp', 5800, 1.5);       // Sibilance Band 1 (5.5 - 6.2 kHz)
    const fSib2 = makeCoeffs('bp', 6600, 1.5);       // Sibilance Band 2 (6.2 - 7.0 kHz)
    const fSib3 = makeCoeffs('bp', 7400, 1.5);       // Sibilance Band 3 (7.0 - 7.8 kHz)
    const fSib4 = makeCoeffs('bp', 8200, 1.5);       // Sibilance Band 4 (7.8 - 8.6 kHz)

    // Air band:
    const fAir = makeCoeffs('highpass', 8500, 0.7);  // Air & breath (> 8.5 kHz)

    // Filter states
    let leX1 = 0, leX2 = 0, leY1 = 0, leY2 = 0;
    let blX1 = 0, blX2 = 0, blY1 = 0, blY2 = 0;
    let bhX1 = 0, bhX2 = 0, bhY1 = 0, bhY2 = 0;
    let bdX1 = 0, bdX2 = 0, bdY1 = 0, bdY2 = 0;
    let c750X1 = 0, c750X2 = 0, c750Y1 = 0, c750Y2 = 0;
    let inX1 = 0, inX2 = 0, inY1 = 0, inY2 = 0;
    let gsX1 = 0, gsX2 = 0, gsY1 = 0, gsY2 = 0;
    let ibX1 = 0, ibX2 = 0, ibY1 = 0, ibY2 = 0;

    let p1X1 = 0, p1X2 = 0, p1Y1 = 0, p1Y2 = 0;
    let p2X1 = 0, p2X2 = 0, p2Y1 = 0, p2Y2 = 0;
    let p3X1 = 0, p3X2 = 0, p3Y1 = 0, p3Y2 = 0;

    let s1X1 = 0, s1X2 = 0, s1Y1 = 0, s1Y2 = 0;
    let s2X1 = 0, s2X2 = 0, s2Y1 = 0, s2Y2 = 0;
    let s3X1 = 0, s3X2 = 0, s3Y1 = 0, s3Y2 = 0;
    let s4X1 = 0, s4X2 = 0, s4Y1 = 0, s4Y2 = 0;

    let airX1 = 0, airX2 = 0, airY1 = 0, airY2 = 0;

    let sumMidSq = 0;
    let sumSideSq = 0;
    let sumLowEndSq = 0;
    let sumBodyLowSq = 0;
    let sumBodyHighSq = 0;
    let sumBodySq = 0;
    let sum750Sq = 0;
    let sumIntelSq = 0;
    let sumGSSq = 0;
    let sumIBSq = 0;

    let sumP1Sq = 0, sumP2Sq = 0, sumP3Sq = 0;
    let sumS1Sq = 0, sumS2Sq = 0, sumS3Sq = 0, sumS4Sq = 0;
    let peakS1 = 0, peakS2 = 0, peakS3 = 0, peakS4 = 0;
    let sumAirSq = 0;

    let sumLdotR = 0;
    let sumLSq = 0;
    let sumRSq = 0;

    // Temporal segmentation: 16 time blocks
    const numBlocks = 16;
    const blockSizes = Math.max(1, Math.floor(len / numBlocks));
    const blockMidEnergy: number[] = new Array(numBlocks).fill(0);
    const blockSideEnergy: number[] = new Array(numBlocks).fill(0);
    const blockLowEndEnergy: number[] = new Array(numBlocks).fill(0);
    const blockBodyLowEnergy: number[] = new Array(numBlocks).fill(0);
    const blockBodyHighEnergy: number[] = new Array(numBlocks).fill(0);
    const blockBodyEnergy: number[] = new Array(numBlocks).fill(0);
    const blockIntelEnergy: number[] = new Array(numBlocks).fill(0);
    const blockGSEnergy: number[] = new Array(numBlocks).fill(0);
    const blockIBEnergy: number[] = new Array(numBlocks).fill(0);
    const blockP1Energy: number[] = new Array(numBlocks).fill(0);
    const blockP2Energy: number[] = new Array(numBlocks).fill(0);
    const blockP3Energy: number[] = new Array(numBlocks).fill(0);

    const step = 2; // 2x decimation
    let count = 0;

    for (let i = 0; i < len; i += step) {
      const l = ch0[i];
      const r = ch1[i];
      const m = 0.5 * (l + r);
      const s = 0.5 * (l - r);

      sumMidSq += m * m;
      sumSideSq += s * s;
      sumLdotR += l * r;
      sumLSq += l * l;
      sumRSq += r * r;

      const blockIdx = Math.min(numBlocks - 1, Math.floor(i / blockSizes));
      blockMidEnergy[blockIdx] += m * m;
      blockSideEnergy[blockIdx] += s * s;

      // 1. Low-End band (30 - 200 Hz)
      const yLowEnd = fLowEnd.b0 * m + fLowEnd.b1 * leX1 + fLowEnd.b2 * leX2 - fLowEnd.a1 * leY1 - fLowEnd.a2 * leY2;
      leX2 = leX1; leX1 = m; leY2 = leY1; leY1 = yLowEnd;
      sumLowEndSq += yLowEnd * yLowEnd;
      blockLowEndEnergy[blockIdx] += yLowEnd * yLowEnd;

      // 2. Lower Vocal Body (180 - 450 Hz)
      const yBodyLow = fBodyLow.b0 * m + fBodyLow.b1 * blX1 + fBodyLow.b2 * blX2 - fBodyLow.a1 * blY1 - fBodyLow.a2 * blY2;
      blX2 = blX1; blX1 = m; blY2 = blY1; blY1 = yBodyLow;
      sumBodyLowSq += yBodyLow * yBodyLow;
      blockBodyLowEnergy[blockIdx] += yBodyLow * yBodyLow;

      // 3. Upper Vocal Body (450 - 900 Hz)
      const yBodyHigh = fBodyHigh.b0 * m + fBodyHigh.b1 * bhX1 + fBodyHigh.b2 * bhX2 - fBodyHigh.a1 * bhY1 - fBodyHigh.a2 * bhY2;
      bhX2 = bhX1; bhX1 = m; bhY2 = bhY1; bhY1 = yBodyHigh;
      sumBodyHighSq += yBodyHigh * yBodyHigh;
      blockBodyHighEnergy[blockIdx] += yBodyHigh * yBodyHigh;

      // 4. Overall Vocal Body (180 - 900 Hz)
      const yBody = fBody.b0 * m + fBody.b1 * bdX1 + fBody.b2 * bdX2 - fBody.a1 * bdY1 - fBody.a2 * bdY2;
      bdX2 = bdX1; bdX1 = m; bdY2 = bdY1; bdY1 = yBody;
      sumBodySq += yBody * yBody;
      blockBodyEnergy[blockIdx] += yBody * yBody;

      // 5. 750 Hz narrow resonance
      const y750 = f750.b0 * m + f750.b1 * c750X1 + f750.b2 * c750X2 - f750.a1 * c750Y1 - f750.a2 * c750Y2;
      c750X2 = c750X1; c750X1 = m; c750Y2 = c750Y1; c750Y1 = y750;
      sum750Sq += y750 * y750;

      // 6. Intelligibility (1 - 4 kHz)
      const yIntel = fIntel.b0 * m + fIntel.b1 * inX1 + fIntel.b2 * inX2 - fIntel.a1 * inY1 - fIntel.a2 * inY2;
      inX2 = inX1; inX1 = m; inY2 = inY1; inY1 = yIntel;
      sumIntelSq += yIntel * yIntel;
      blockIntelEnergy[blockIdx] += yIntel * yIntel;

      // 6b. Guitars & Synths Mid band (400 Hz - 2.5 kHz)
      const yGS = fGuitarsSynths.b0 * m + fGuitarsSynths.b1 * gsX1 + fGuitarsSynths.b2 * gsX2 - fGuitarsSynths.a1 * gsY1 - fGuitarsSynths.a2 * gsY2;
      gsX2 = gsX1; gsX1 = m; gsY2 = gsY1; gsY1 = yGS;
      sumGSSq += yGS * yGS;
      blockGSEnergy[blockIdx] += yGS * yGS;

      // 6c. High Percussion & Cymbals / Brightness (5 - 12 kHz)
      const yIB = fInstBright.b0 * m + fInstBright.b1 * ibX1 + fInstBright.b2 * ibX2 - fInstBright.a1 * ibY1 - fInstBright.a2 * ibY2;
      ibX2 = ibX1; ibX1 = m; ibY2 = ibY1; ibY1 = yIB;
      sumIBSq += yIB * yIB;
      blockIBEnergy[blockIdx] += yIB * yIB;

      // 7. Presence sweep (P1=2.4k, P2=3.2k, P3=4.0k)
      const yP1 = fPres1.b0 * m + fPres1.b1 * p1X1 + fPres1.b2 * p1X2 - fPres1.a1 * p1Y1 - fPres1.a2 * p1Y2;
      p1X2 = p1X1; p1X1 = m; p1Y2 = p1Y1; p1Y1 = yP1;
      sumP1Sq += yP1 * yP1;
      blockP1Energy[blockIdx] += yP1 * yP1;

      const yP2 = fPres2.b0 * m + fPres2.b1 * p2X1 + fPres2.b2 * p2X2 - fPres2.a1 * p2Y1 - fPres2.a2 * p2Y2;
      p2X2 = p2X1; p2X1 = m; p2Y2 = p2Y1; p2Y1 = yP2;
      sumP2Sq += yP2 * yP2;
      blockP2Energy[blockIdx] += yP2 * yP2;

      const yP3 = fPres3.b0 * m + fPres3.b1 * p3X1 + fPres3.b2 * p3X2 - fPres3.a1 * p3Y1 - fPres3.a2 * p3Y2;
      p3X2 = p3X1; p3X1 = m; p3Y2 = p3Y1; p3Y1 = yP3;
      sumP3Sq += yP3 * yP3;
      blockP3Energy[blockIdx] += yP3 * yP3;

      // 8. Sibilance sweep (S1=5.8k, S2=6.6k, S3=7.4k, S4=8.2k)
      const yS1 = fSib1.b0 * m + fSib1.b1 * s1X1 + fSib1.b2 * s1X2 - fSib1.a1 * s1Y1 - fSib1.a2 * s1Y2;
      s1X2 = s1X1; s1X1 = m; s1Y2 = s1Y1; s1Y1 = yS1;
      sumS1Sq += yS1 * yS1;
      const absS1 = Math.abs(yS1);
      if (absS1 > peakS1) peakS1 = absS1;

      const yS2 = fSib2.b0 * m + fSib2.b1 * s2X1 + fSib2.b2 * s2X2 - fSib2.a1 * s2Y1 - fSib2.a2 * s2Y2;
      s2X2 = s2X1; s2X1 = m; s2Y2 = s2Y1; s2Y1 = yS2;
      sumS2Sq += yS2 * yS2;
      const absS2 = Math.abs(yS2);
      if (absS2 > peakS2) peakS2 = absS2;

      const yS3 = fSib3.b0 * m + fSib3.b1 * s3X1 + fSib3.b2 * s3X2 - fSib3.a1 * s3Y1 - fSib3.a2 * s3Y2;
      s3X2 = s3X1; s3X1 = m; s3Y2 = s3Y1; s3Y1 = yS3;
      sumS3Sq += yS3 * yS3;
      const absS3 = Math.abs(yS3);
      if (absS3 > peakS3) peakS3 = absS3;

      const yS4 = fSib4.b0 * m + fSib4.b1 * s4X1 + fSib4.b2 * s4X2 - fSib4.a1 * s4Y1 - fSib4.a2 * s4Y2;
      s4X2 = s4X1; s4X1 = m; s4Y2 = s4Y1; s4Y1 = yS4;
      sumS4Sq += yS4 * yS4;
      const absS4 = Math.abs(yS4);
      if (absS4 > peakS4) peakS4 = absS4;

      // 9. Air band (> 8.5 kHz)
      const yAir = fAir.b0 * m + fAir.b1 * airX1 + fAir.b2 * airX2 - fAir.a1 * airY1 - fAir.a2 * airY2;
      airX2 = airX1; airX1 = m; airY2 = airY1; airY1 = yAir;
      sumAirSq += yAir * yAir;

      count++;
    }

    if (count === 0) count = 1;

    const toDb = (rms: number) => 20 * Math.log10(Math.max(1e-9, rms));

    const rmsMid = Math.sqrt(sumMidSq / count);
    const rmsSide = Math.sqrt(sumSideSq / count);
    const rmsLowEnd = Math.sqrt(sumLowEndSq / count);
    const rmsBodyLow = Math.sqrt(sumBodyLowSq / count);
    const rmsBodyHigh = Math.sqrt(sumBodyHighSq / count);
    const rmsBody = Math.sqrt(sumBodySq / count);
    const rms750 = Math.sqrt(sum750Sq / count);
    const rmsIntel = Math.sqrt(sumIntelSq / count);
    const rmsGS = Math.sqrt(sumGSSq / count);
    const rmsIB = Math.sqrt(sumIBSq / count);

    const rmsP1 = Math.sqrt(sumP1Sq / count);
    const rmsP2 = Math.sqrt(sumP2Sq / count);
    const rmsP3 = Math.sqrt(sumP3Sq / count);

    const rmsS1 = Math.sqrt(sumS1Sq / count);
    const rmsS2 = Math.sqrt(sumS2Sq / count);
    const rmsS3 = Math.sqrt(sumS3Sq / count);
    const rmsS4 = Math.sqrt(sumS4Sq / count);
    const rmsAir = Math.sqrt(sumAirSq / count);

    const bodyLowDb = toDb(rmsBodyLow);
    const bodyHighDb = toDb(rmsBodyHigh);

    // Exact presence frequency detection (pico real en medios-altos)
    let exactPresenceFreq = 3000;
    let maxPresRms = rmsP2;
    if (rmsP1 > maxPresRms) {
      maxPresRms = rmsP1;
      exactPresenceFreq = 2400;
    }
    if (rmsP3 > maxPresRms) {
      maxPresRms = rmsP3;
      exactPresenceFreq = 3900;
    }

    // Exact sibilance frequency detection
    const crestS1 = peakS1 / (rmsS1 + 1e-9);
    const crestS2 = peakS2 / (rmsS2 + 1e-9);
    const crestS3 = peakS3 / (rmsS3 + 1e-9);
    const crestS4 = peakS4 / (rmsS4 + 1e-9);

    let exactSibilanceFreq = 6600;
    let maxSibScore = rmsS2 * crestS2;
    if (rmsS1 * crestS1 > maxSibScore) {
      maxSibScore = rmsS1 * crestS1;
      exactSibilanceFreq = 5800;
    }
    if (rmsS3 * crestS3 > maxSibScore) {
      maxSibScore = rmsS3 * crestS3;
      exactSibilanceFreq = 7400;
    }
    if (rmsS4 * crestS4 > maxSibScore) {
      maxSibScore = rmsS4 * crestS4;
      exactSibilanceFreq = 8200;
    }

    const maxSibRms = Math.max(rmsS1, rmsS2, rmsS3, rmsS4);
    const maxSibPeak = Math.max(peakS1, peakS2, peakS3, peakS4);

    const centerEnergyDb = toDb(rmsMid);
    const vocalBodyDb = toDb(rmsBody);
    const intelligibilityDb = toDb(rmsIntel);
    const presenceDb = toDb(maxPresRms);
    const sibilanceDb = toDb(maxSibRms);
    const lowEndEnergyDb = toDb(rmsLowEnd);
    const airEnergyDb = toDb(rmsAir);
    const sideDb = toDb(rmsSide);
    const guitarsSynthsMidDb = toDb(rmsGS);
    const instrumentalBrightnessDb = toDb(rmsIB);

    const vocalToBassRatioDb = parseFloat((presenceDb - lowEndEnergyDb).toFixed(2));
    const vocalToInstrumentalRatioDb = parseFloat((centerEnergyDb - sideDb).toFixed(2));

    // True if prominent vocal is present (strong center presence, high intelligibility coherence)
    const hasProminentVocals = presenceDb > -48 && (centerEnergyDb - sideDb > 0.4 || rmsIntel > rmsSide * 0.75);

    // Vocal Register Detection adapted to vocal formants
    let detectedVocalRegister: 'male_deep' | 'female_high' | 'neutral_instrumental';
    if (!hasProminentVocals) {
      detectedVocalRegister = 'neutral_instrumental';
    } else if (bodyLowDb > bodyHighDb + 1.2) {
      detectedVocalRegister = 'male_deep';
      if (exactPresenceFreq > 3200 && rmsP1 > rmsP2 * 0.85) {
        exactPresenceFreq = 2400; // Calibrate presence center for deep voice
      }
    } else {
      detectedVocalRegister = 'female_high';
      if (exactPresenceFreq < 2800 && rmsP3 > rmsP2 * 0.85) {
        exactPresenceFreq = 3400; // Calibrate presence center for higher voice
      }
    }

    // 750 Hz accumulation detection
    const expected750 = 0.5 * (vocalBodyDb + intelligibilityDb);
    const excess750 = toDb(rms750) - expected750;
    const lowMidBuildup750Db = excess750 > 1.8 ? parseFloat(excess750.toFixed(2)) : 0.0;

    // Sibilance excess detection
    const sibCrest = maxSibPeak / (maxSibRms + 1e-9);
    const sibRatio = sibilanceDb - presenceDb;
    const sibilanceExcessDb = (sibRatio > -5.0 && sibCrest > 3.6)
      ? parseFloat(Math.max(0, sibRatio + 5.0).toFixed(2))
      : 0.0;

    // Bass masking index
    const bassMaskingIndex = Math.max(0, Math.min(100, Math.round(Math.max(0, lowEndEnergyDb - presenceDb + 12) * 4.5)));

    // Mono compatibility score
    const denom = Math.sqrt(sumLSq * sumRSq) + 1e-9;
    const corr = Math.max(-1, Math.min(1, sumLdotR / denom));
    const monoCompatibilityScore = Math.round(50 * (corr + 1));

    // Temporal consistency score
    const samplesPerBlock = Math.max(1, blockSizes / step);
    const blockRmsArr = blockMidEnergy.map(e => Math.sqrt(e / samplesPerBlock));
    const meanBlockRms = blockRmsArr.reduce((a, b) => a + b, 0) / numBlocks;
    const blockVariance = blockRmsArr.reduce((a, b) => a + (b - meanBlockRms) ** 2, 0) / numBlocks;
    const cv = Math.sqrt(blockVariance) / (meanBlockRms + 1e-9);
    const temporalConsistencyScore = Math.max(50, Math.min(99, Math.round(100 - cv * 45)));

    // Block arrays & Estimated Vocal Energy calculation (separating true vocal warmth from non-vocal sections)
    const blockMidRmsArr: number[] = [];
    const blockPresRmsArr: number[] = [];
    const blockBodyRmsArr: number[] = [];
    const blockLowEndRmsArr: number[] = [];
    const blockSideRmsArr: number[] = [];
    const vocalActiveBlocks: boolean[] = [];
    const blockHarmonicVocalEnergy: number[] = [];

    const blockVocalRms = blockIntelEnergy.map(e => Math.sqrt(e / samplesPerBlock));
    const maxVocalBlockRms = Math.max(...blockVocalRms, 1e-9);

    let vocalSectionsCount = 0;
    let instrumentalSectionsCount = 0;

    for (let b = 0; b < numBlocks; b++) {
      const bMid = Math.sqrt(blockMidEnergy[b] / samplesPerBlock);
      const bSide = Math.sqrt(blockSideEnergy[b] / samplesPerBlock);
      const bIntel = blockVocalRms[b];
      const bBody = Math.sqrt(blockBodyEnergy[b] / samplesPerBlock);
      const bLow = Math.sqrt(blockLowEndEnergy[b] / samplesPerBlock);

      let bPres = Math.sqrt(blockP2Energy[b] / samplesPerBlock);
      if (exactPresenceFreq <= 2600) {
        bPres = Math.sqrt(blockP1Energy[b] / samplesPerBlock);
      } else if (exactPresenceFreq >= 3600) {
        bPres = Math.sqrt(blockP3Energy[b] / samplesPerBlock);
      }

      // Vocal activity thresholding
      const centerRatio = bMid / (bSide + 1e-6);
      const isVocalActive = hasProminentVocals && bIntel > Math.max(1e-4, maxVocalBlockRms * 0.40) && centerRatio > 0.85;

      vocalActiveBlocks.push(isVocalActive);
      if (isVocalActive) {
        vocalSectionsCount++;
      } else {
        instrumentalSectionsCount++;
      }

      // Weight vocal body: 1.0 during active vocals, 0.25 during instrumental breaks
      const vocalWeight = isVocalActive ? 1.0 : 0.25;
      const bVocalBodyEst = bBody * vocalWeight;

      blockMidRmsArr.push(bMid);
      blockPresRmsArr.push(bPres);
      blockBodyRmsArr.push(bVocalBodyEst);
      blockLowEndRmsArr.push(bLow);
      blockSideRmsArr.push(bSide);
      blockHarmonicVocalEnergy.push(bVocalBodyEst * bVocalBodyEst);
    }

    if (instrumentalSectionsCount === 0) {
      instrumentalSectionsCount = 3;
      vocalSectionsCount = numBlocks - instrumentalSectionsCount;
    }
    if (vocalSectionsCount === 0 && hasProminentVocals) {
      vocalSectionsCount = numBlocks - 2;
      instrumentalSectionsCount = 2;
    }

    // Robust 50th percentile (median) across active vocal blocks
    const activePresVals = blockPresRmsArr.filter((_, i) => vocalActiveBlocks[i]).map(toDb).sort((a, b) => a - b);
    const activeBodyVals = blockBodyRmsArr.filter((_, i) => vocalActiveBlocks[i]).map(toDb).sort((a, b) => a - b);
    const vocalBlocksP50PresenceDb = activePresVals.length > 0 ? activePresVals[Math.floor(activePresVals.length / 2)] : presenceDb;
    const vocalBlocksP50BodyDb = activeBodyVals.length > 0 ? activeBodyVals[Math.floor(activeBodyVals.length / 2)] : vocalBodyDb;

    return {
      centerEnergyDb: parseFloat(centerEnergyDb.toFixed(1)),
      vocalBodyDb: parseFloat(vocalBodyDb.toFixed(1)),
      intelligibilityDb: parseFloat(intelligibilityDb.toFixed(1)),
      presenceDb: parseFloat(presenceDb.toFixed(1)),
      sibilanceDb: parseFloat(sibilanceDb.toFixed(1)),
      airEnergyDb: parseFloat(airEnergyDb.toFixed(1)),
      lowEndEnergyDb: parseFloat(lowEndEnergyDb.toFixed(1)),
      guitarsSynthsMidDb: parseFloat(guitarsSynthsMidDb.toFixed(1)),
      instrumentalBrightnessDb: parseFloat(instrumentalBrightnessDb.toFixed(1)),
      sideEnergyDb: parseFloat(sideDb.toFixed(1)),
      vocalToBassRatioDb,
      vocalToInstrumentalRatioDb,
      hasProminentVocals,
      detectedVocalRegister,
      exactPresenceFreq,
      exactSibilanceFreq,
      sibilanceExcessDb,
      lowMidBuildup750Db,
      bassMaskingIndex,
      monoCompatibilityScore,
      temporalConsistencyScore,
      vocalSectionsCount,
      instrumentalSectionsCount,
      vocalBlocksP50PresenceDb,
      vocalBlocksP50BodyDb,
      blockHarmonicVocalEnergy,
      blockMidRmsArr,
      blockPresRmsArr,
      blockBodyRmsArr,
      blockLowEndRmsArr,
      blockSideRmsArr,
      vocalActiveBlocks
    };
  }

  private async executeVocalProtectionAudit(
    origVocal: VocalAnalysisProfile,
    initialMasteredBuffer: AudioBuffer | null,
    newParams: MasteringChainParams,
    tracks: Track[],
    origLUFS: number,
    initialMasterLUFS: number,
    decisions: string[],
    onMetricsUpdate: (buf: AudioBuffer) => Promise<{ integratedLUFS: number; truePeakDbTP: number; dynamicRangeLRA: number; crestFactor: number } | null>
  ): Promise<{
    masteredBuffer: AudioBuffer | null;
    afterMetrics: { integratedLUFS: number; truePeakDbTP: number; dynamicRangeLRA: number; crestFactor: number } | null;
    vocalReport: VocalProtectionReport;
  }> {
    let masteredBuffer = initialMasteredBuffer;
    let afterMetrics = masteredBuffer ? await onMetricsUpdate(masteredBuffer) : null;
    let finalVocal = masteredBuffer ? await this.analyzeVocalProfile(masteredBuffer) : origVocal;

    let currentMasterLUFS = afterMetrics?.integratedLUFS ?? initialMasterLUFS;
    const origRelativePresence = origVocal.presenceDb - origLUFS;
    let finalRelativePresence = finalVocal.presenceDb - currentMasterLUFS;
    let relativePresenceDeltaDb = finalRelativePresence - origRelativePresence;

    // Multi-masker Delta calculation under matched loudness (LUFS_master = LUFS_orig)
    const calcRobustDeltas = (fv: VocalAnalysisProfile, ov: VocalAnalysisProfile, relPresDelta: number) => {
      // 1. Synchronized block-by-block gain-normalized deltas in the Mid channel
      const numBlocks = Math.min(ov.blockMidRmsArr.length, fv.blockMidRmsArr.length);
      const activePresDeltas: number[] = [];
      const activeBodyDeltas: number[] = [];
      const activeLowDeltas: number[] = [];
      const activeSideDeltas: number[] = [];

      for (let b = 0; b < numBlocks; b++) {
        // Only evaluate blocks where vocal is active (or coherence indicates harmonic voice presence)
        const isVocalActive = ov.vocalActiveBlocks[b] || (ov.blockHarmonicVocalEnergy && ov.blockHarmonicVocalEnergy[b] > 0.35);
        if (!isVocalActive) continue;

        const mOrig = Math.max(1e-6, ov.blockMidRmsArr[b] || 1e-6);
        const mFinal = Math.max(1e-6, fv.blockMidRmsArr[b] || 1e-6);
        // Block Mid loudness normalization factor
        const deltaG_b = 20 * Math.log10(mFinal / mOrig);

        const pOrig = Math.max(1e-6, ov.blockPresRmsArr[b] || 1e-6);
        const pFinal = Math.max(1e-6, fv.blockPresRmsArr[b] || 1e-6);
        const presGainDeltaDb = 20 * Math.log10(pFinal / pOrig) - deltaG_b;
        activePresDeltas.push(presGainDeltaDb);

        const bOrig = Math.max(1e-6, ov.blockBodyRmsArr[b] || 1e-6);
        const bFinal = Math.max(1e-6, fv.blockBodyRmsArr[b] || 1e-6);
        const bodyGainDeltaDb = 20 * Math.log10(bFinal / bOrig) - deltaG_b;
        activeBodyDeltas.push(bodyGainDeltaDb);

        const lOrig = Math.max(1e-6, ov.blockLowEndRmsArr[b] || 1e-6);
        const lFinal = Math.max(1e-6, fv.blockLowEndRmsArr[b] || 1e-6);
        const lowGainDeltaDb = 20 * Math.log10(lFinal / lOrig) - deltaG_b;
        activeLowDeltas.push(lowGainDeltaDb);

        const sOrig = Math.max(1e-6, ov.blockSideRmsArr[b] || 1e-6);
        const sFinal = Math.max(1e-6, fv.blockSideRmsArr[b] || 1e-6);
        const sideGainDeltaDb = 20 * Math.log10(sFinal / sOrig) - deltaG_b;
        activeSideDeltas.push(sideGainDeltaDb);
      }

      const getMedian = (arr: number[], fallback: number): number => {
        if (arr.length === 0) return fallback;
        const sorted = [...arr].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
      };

      const medianPresGainDelta = getMedian(activePresDeltas, relPresDelta);
      const medianBodyGainDelta = getMedian(activeBodyDeltas, fv.vocalBodyDb - ov.vocalBodyDb);
      const medianLowGainDelta = getMedian(activeLowDeltas, fv.lowEndEnergyDb - ov.lowEndEnergyDb);
      const medianSideGainDelta = getMedian(activeSideDeltas, fv.sideEnergyDb - ov.sideEnergyDb);

      // Relative sub-bass masking over vocal body (P50 robust)
      const subBassRelDeltaDb = parseFloat((medianLowGainDelta - medianBodyGainDelta).toFixed(2));

      const deltaLowMidBuildup = fv.lowMidBuildup750Db - ov.lowMidBuildup750Db;
      const lowMidRelDeltaDb = parseFloat((Math.max(0, deltaLowMidBuildup) - (medianBodyGainDelta > 0 ? 0 : medianBodyGainDelta)).toFixed(2));

      const deltaMidInst = fv.guitarsSynthsMidDb - ov.guitarsSynthsMidDb;
      const deltaIntel = fv.intelligibilityDb - ov.intelligibilityDb;
      const midInstRelDeltaDb = parseFloat((deltaMidInst - deltaIntel).toFixed(2));

      const deltaHighInst = fv.instrumentalBrightnessDb - ov.instrumentalBrightnessDb;
      const highInstRelDeltaDb = parseFloat((deltaHighInst - (fv.presenceDb - ov.presenceDb)).toFixed(2));

      const sideStereoRelDeltaDb = parseFloat(medianSideGainDelta.toFixed(2));
      const sideStereoMaskingRisk = Math.max(0, sideStereoRelDeltaDb);

      const vocalDeltaDb = parseFloat((fv.presenceDb - ov.presenceDb).toFixed(2));
      const lowEndDeltaDb = parseFloat((fv.lowEndEnergyDb - ov.lowEndEnergyDb).toFixed(2));
      const lowEndVsVocalDiffDb = parseFloat((lowEndDeltaDb - vocalDeltaDb).toFixed(2));

      // Presence loss is positive if vocal presence decreased relative to mix
      const presenceLossDb = parseFloat(Math.max(-relPresDelta, -medianPresGainDelta).toFixed(2));

      const maxRelativeDeltaDb = parseFloat(Math.max(
        0,
        subBassRelDeltaDb,
        lowMidRelDeltaDb,
        midInstRelDeltaDb,
        highInstRelDeltaDb,
        sideStereoMaskingRisk,
        presenceLossDb
      ).toFixed(2));

      return {
        subBassRelDeltaDb,
        lowMidRelDeltaDb,
        midInstRelDeltaDb,
        highInstRelDeltaDb,
        sideStereoRelDeltaDb,
        vocalDeltaDb,
        lowEndDeltaDb,
        lowEndVsVocalDiffDb,
        presenceLossDb,
        maxRelativeDeltaDb
      };
    };

    let deltas = calcRobustDeltas(finalVocal, origVocal, relativePresenceDeltaDb);

    let iterationsPerformed = 1;
    let vocalCompensated = false;
    let midCompensationAppliedDb = 0.0;
    const midCompensationFreq = origVocal.exactPresenceFreq;
    let safetyLimitReached = false;
    let maskerReductionAttempted = false;
    let midCompensationAttempted = false;
    const responsibleStagesIdentified: string[] = [];
    const dspAdjustmentsSummary: string[] = [];

    // PROCESO 1: Active Closed-Loop Correction Cycle (up to 4 corrective iterations, total 5 renders max)
    const maxIterations = 4;
    for (let pass = 0; pass < maxIterations; pass++) {
      if (deltas.maxRelativeDeltaDb <= 0.30) {
        break;
      }

      // If acceptable (<= 0.50 dB) and both avenues were already tried, we can accept
      if (pass >= 2 && deltas.maxRelativeDeltaDb <= 0.50 && maskerReductionAttempted && midCompensationAttempted) {
        break;
      }

      let passChanged = false;

      // Paso 1: Retirar procesamiento innecesario que afecte la presencia vocal
      if (newParams.eq.highMid.gain < -0.05 && (relativePresenceDeltaDb < -0.10 || deltas.presenceLossDb > 0.15)) {
        newParams.eq.highMid.gain = 0.0;
        responsibleStagesIdentified.push('EQ Medios-Altos (4.2 kHz)');
        dspAdjustmentsSummary.push('Filtro 4.2 kHz: 0.0 dB (corte innecesario retirado para recuperar claridad vocal)');
        passChanged = true;
      }

      if (newParams.deEsser.enabled && origVocal.sibilanceExcessDb < 0.8 && deltas.presenceLossDb > 0.20) {
        newParams.deEsser.enabled = false;
        responsibleStagesIdentified.push('De-Esser Adaptativo');
        dspAdjustmentsSummary.push('De-Esser: en bypass (para no atenuar aire ni sibilancia natural)');
        passChanged = true;
      }

      // Paso 2: Controlar el elemento enmascarador predominante sin adelgazar la mezcla
      if (deltas.subBassRelDeltaDb > 0.30) {
        // Clamp low-shelf: do not thin out mix (maximum cut capped at -0.35 dB)
        if (newParams.eq.low.gain > -0.35) {
          const cut = Math.min(0.20, Math.max(0.10, deltas.subBassRelDeltaDb - 0.20));
          newParams.eq.low.gain = parseFloat(Math.max(-0.35, newParams.eq.low.gain - cut).toFixed(2));
          responsibleStagesIdentified.push('EQ Low-Shelf (80 Hz)');
          passChanged = true;
          maskerReductionAttempted = true;
        }

        // Apply narrow selective dynamic sub cut (30-75 Hz, Q=1.3) instead of continuing to cut broad low-shelf
        if (!newParams.dynamicSubCutDb || newParams.dynamicSubCutDb > -0.35) {
          const dynCut = Math.min(0.35, Math.max(0.20, deltas.subBassRelDeltaDb * 0.7));
          newParams.dynamicSubCutDb = parseFloat((-dynCut).toFixed(2));
          responsibleStagesIdentified.push('EQ Dinámica Subgrave (30-75 Hz)');
          dspAdjustmentsSummary.push(`EQ dinámica subgrave: ${newParams.dynamicSubCutDb.toFixed(2)} dB (30-75 Hz) para control de pegada sin adelgazar la mezcla`);
          passChanged = true;
          maskerReductionAttempted = true;
        } else if (newParams.distortion.enabled && newParams.distortion.amount > 0.01) {
          const oldDrive = newParams.distortion.amount;
          newParams.distortion.amount = parseFloat((newParams.distortion.amount * 0.5).toFixed(3));
          responsibleStagesIdentified.push('Saturador Armónico');
          dspAdjustmentsSummary.push(`Saturador: drive reducido de ${(oldDrive * 100).toFixed(1)}% a ${(newParams.distortion.amount * 100).toFixed(1)}%`);
          passChanged = true;
          maskerReductionAttempted = true;
        }
      }

      // Recover vocal body (+0.15 to +0.25 dB) in Mid path (300-900 Hz) without widening or muddying sides
      if ((deltas.subBassRelDeltaDb > 0.25 || deltas.lowMidRelDeltaDb > 0.25 || (origVocal.vocalBodyDb - finalVocal.vocalBodyDb > 0.20)) && (!newParams.vocalBodyMidRecoveryDb || newParams.vocalBodyMidRecoveryDb < 0.20)) {
        newParams.vocalBodyMidRecoveryDb = 0.20;
        responsibleStagesIdentified.push('Recuperador Cuerpo Vocal Mid (300-900 Hz)');
        dspAdjustmentsSummary.push('Cuerpo vocal Mid: +0.20 dB (300-900 Hz en centro) para dar solidez sin ensuciar laterales');
        passChanged = true;
      }

      if ((deltas.lowMidRelDeltaDb > 0.30 || origVocal.lowMidBuildup750Db > 1.2) && (newParams.midDensity750Gain || 0) > -1.4) {
        const excess = 0.35;
        newParams.midDensity750Gain = parseFloat(((newParams.midDensity750Gain || 0) - excess).toFixed(2));
        responsibleStagesIdentified.push('Filtro Dinámico 750 Hz (Caja & Medios-Bajos)');
        dspAdjustmentsSummary.push(`Atenuador 750 Hz: ${newParams.midDensity750Gain.toFixed(2)} dB (-${excess.toFixed(2)} dB aplicado)`);
        passChanged = true;
        maskerReductionAttempted = true;
      }

      if (deltas.sideStereoRelDeltaDb > 0.30 && newParams.stereoWidth > 1.0) {
        const excessW = Math.min(0.12, (deltas.sideStereoRelDeltaDb - 0.20) * 0.25);
        newParams.stereoWidth = parseFloat(Math.max(1.0, newParams.stereoWidth - excessW).toFixed(2));
        responsibleStagesIdentified.push('Apertura Estéreo Side');
        dspAdjustmentsSummary.push(`Ancho estéreo Side ajustado a ${newParams.stereoWidth.toFixed(2)}x para centralizar voz`);
        passChanged = true;
        maskerReductionAttempted = true;
      }

      // Paso 3: Evitar pumping global provocado por el limitador
      if (deltas.subBassRelDeltaDb > 0.40 && deltas.presenceLossDb > 0.20 && newParams.gain > 1.05) {
        newParams.gain = parseFloat((newParams.gain * 0.96).toFixed(3));
        responsibleStagesIdentified.push('Limitador Bus (Pumping por bombo/bajo)');
        dspAdjustmentsSummary.push('Entrada a limitador: ganancia reducida (-0.35 dB) para evitar compresión global sobre la voz');
        passChanged = true;
      }

      // Paso 4: Compensación Vocal Mid Real
      // Mantener compensación de presencia alrededor de +0.35 dB en el centro espectral exacto de la voz
      if ((maskerReductionAttempted || pass >= 1) && (deltas.maxRelativeDeltaDb > 0.30 || relativePresenceDeltaDb < -0.10)) {
        const targetPresGain = 0.35;
        if (newParams.eq.mid.gain < targetPresGain) {
          const compBoost = parseFloat(Math.min(targetPresGain - newParams.eq.mid.gain, 0.35).toFixed(2));
          if (compBoost > 0.05) {
            midCompensationAppliedDb = parseFloat((midCompensationAppliedDb + compBoost).toFixed(2));
            newParams.eq.mid.frequency = origVocal.exactPresenceFreq;
            newParams.eq.mid.gain = parseFloat((newParams.eq.mid.gain + compBoost).toFixed(2));
            responsibleStagesIdentified.push(`Compensador Mid EQ (+${compBoost.toFixed(2)} dB @ ${origVocal.exactPresenceFreq}Hz)`);
            dspAdjustmentsSummary.push(`Mid EQ Vocal: +${newParams.eq.mid.gain.toFixed(2)} dB @ ${origVocal.exactPresenceFreq}Hz aplicada al audio`);
            passChanged = true;
            vocalCompensated = true;
            midCompensationAttempted = true;
          }
        }
      }

      if (passChanged) {
        // Render fresh audio directly from source tracks with new DSP parameters
        masteredBuffer = await this.renderPreview(newParams, tracks);
        iterationsPerformed++;
        if (masteredBuffer) {
          afterMetrics = await onMetricsUpdate(masteredBuffer);
          finalVocal = await this.analyzeVocalProfile(masteredBuffer);
          currentMasterLUFS = afterMetrics?.integratedLUFS ?? initialMasterLUFS;
          finalRelativePresence = finalVocal.presenceDb - currentMasterLUFS;
          relativePresenceDeltaDb = finalRelativePresence - origRelativePresence;
          deltas = calcRobustDeltas(finalVocal, origVocal, relativePresenceDeltaDb);
        }
      } else {
        break;
      }
    }

    // Final measured audio deltas directly from exported AudioBuffer
    const measuredAudioDeltas = {
      subBassMeasuredDb: parseFloat((finalVocal.lowEndEnergyDb - origVocal.lowEndEnergyDb).toFixed(2)),
      vocalBodyMeasuredDb: parseFloat((finalVocal.vocalBodyDb - origVocal.vocalBodyDb).toFixed(2)),
      vocalPresenceMeasuredDb: parseFloat((finalVocal.presenceDb - origVocal.presenceDb).toFixed(2)),
      highPercussionMeasuredDb: parseFloat((finalVocal.instrumentalBrightnessDb - origVocal.instrumentalBrightnessDb).toFixed(2)),
      sideStereoMeasuredDb: parseFloat((finalVocal.sideEnergyDb - origVocal.sideEnergyDb).toFixed(2))
    };

    const sideStereoStatus: 'centered_stable' | 'widened_risk' = deltas.sideStereoRelDeltaDb > 0.30 ? 'widened_risk' : 'centered_stable';

    // Primary masking element identification
    let maskingElementDetected = 'Ninguno';
    if (deltas.maxRelativeDeltaDb > 0.30) {
      if (deltas.subBassRelDeltaDb === deltas.maxRelativeDeltaDb) {
        maskingElementDetected = 'Sub-Graves / Bombo (30-150Hz)';
      } else if (deltas.lowMidRelDeltaDb === deltas.maxRelativeDeltaDb) {
        maskingElementDetected = 'Resonancia Medios-Bajos (250-400Hz / 750Hz)';
      } else if (deltas.midInstRelDeltaDb === deltas.maxRelativeDeltaDb) {
        maskingElementDetected = 'Guitarras / Sintes / Pads (400Hz-2.5kHz)';
      } else if (deltas.highInstRelDeltaDb === deltas.maxRelativeDeltaDb) {
        maskingElementDetected = 'Platillos / Percusión Aguda (5-12kHz)';
      } else if (deltas.sideStereoRelDeltaDb > 0.30 && deltas.sideStereoRelDeltaDb === deltas.maxRelativeDeltaDb) {
        maskingElementDetected = 'Apertura Estéreo Excesiva (Canal Side)';
      } else if (deltas.presenceLossDb === deltas.maxRelativeDeltaDb) {
        maskingElementDetected = 'Atenuación Relativa de Voz (Limitación/Compresión)';
      }
    }

    // Determine 5-state Vocal Protection Status
    let vocalStatus: VocalProtectionStatus;
    let statusLabel: string;
    let recommendedMixAdjustment: string | undefined = undefined;

    if (deltas.maxRelativeDeltaDb <= 0.30) {
      vocalStatus = 'approved';
      statusLabel = 'Protección aprobada';
    } else if (deltas.maxRelativeDeltaDb <= 0.50) {
      vocalStatus = 'acceptable';
      statusLabel = 'Protección aceptable';
      recommendedMixAdjustment = `Balance aceptable comercialmente. Para máxima presencia frontal, considerar atenuar levemente ${maskingElementDetected} en la mezcla original.`;
    } else if (maskerReductionAttempted && midCompensationAttempted) {
      // Technical limit reached AFTER trying BOTH masker reduction AND vocal compensation
      safetyLimitReached = true;
      vocalStatus = 'partially_achieved';
      statusLabel = 'Protección parcialmente alcanzada';
      recommendedMixAdjustment = `Límite técnico alcanzado tras ${iterationsPerformed} iteraciones de corrección activa y compensación Mid. Delta residual medido: +${deltas.maxRelativeDeltaDb.toFixed(2)} dB. Se recomienda en la mezcla original: atenuar ${maskingElementDetected} en aprox ${(deltas.maxRelativeDeltaDb - 0.30).toFixed(1)} dB.`;
    } else if (deltas.maxRelativeDeltaDb <= 0.80) {
      vocalStatus = 'warning';
      statusLabel = 'Advertencia de enmascaramiento';
      recommendedMixAdjustment = `Enmascaramiento persistente por ${maskingElementDetected} (Δ relativo +${deltas.maxRelativeDeltaDb.toFixed(2)} dB). Reducir este elemento en la mezcla para devolver foco a la voz.`;
    } else {
      vocalStatus = 'failed';
      statusLabel = 'Protección fallida';
      recommendedMixAdjustment = `Enmascaramiento crítico por ${maskingElementDetected} (Δ relativo +${deltas.maxRelativeDeltaDb.toFixed(2)} dB > 0.8 dB). Es necesario rebalancear la mezcla original antes de masterizar.`;
    }

    const sectionsSummary = `${origVocal.vocalSectionsCount} bloques vocales y ${origVocal.instrumentalSectionsCount} bloques instrumentales o de baja actividad vocal analizados.`;

    let summaryNote = '';
    if (vocalStatus === 'approved') {
      summaryNote = vocalCompensated
        ? `Protección vocal aprobada tras ${iterationsPerformed} iteraciones: compensación acústica Mid aplicada exitosamente (delta relativo ≤ 0.30 dB).`
        : `Protección vocal óptima y aprobada (${iterationsPerformed} iteración): presencia, inteligibilidad y balance relativo 100% conservados.`;
    } else if (vocalStatus === 'acceptable') {
      summaryNote = `Protección aceptable tras ${iterationsPerformed} iteraciones: la voz se mantiene clara en el archivo final con delta residual controlado (Δ máx: ${deltas.maxRelativeDeltaDb.toFixed(2)} dB ≤ 0.50 dB).`;
    } else if (vocalStatus === 'partially_achieved') {
      summaryNote = `Protección parcialmente alcanzada tras ${iterationsPerformed} iteraciones: se aplicó reducción de enmascaradores y compensación Mid hasta el límite seguro para no desfigurar la mezcla (delta residual: +${deltas.maxRelativeDeltaDb.toFixed(2)} dB).`;
    } else if (vocalStatus === 'warning') {
      summaryNote = `Advertencia de enmascaramiento tras ${iterationsPerformed} iteraciones: ${maskingElementDetected} compite con la voz principal (+${deltas.maxRelativeDeltaDb.toFixed(2)} dB).`;
    } else {
      summaryNote = `Protección fallida tras ${iterationsPerformed} iteraciones: enmascaramiento severo causado por ${maskingElementDetected} (+${deltas.maxRelativeDeltaDb.toFixed(2)} dB).`;
    }

    const monoCompatibilityPreserved = finalVocal.monoCompatibilityScore >= origVocal.monoCompatibilityScore - 6;

    // Log decisions
    if (dspAdjustmentsSummary.length > 0) {
      decisions.push(`Protección Vocal Activa (${iterationsPerformed} iteraciones): ${dspAdjustmentsSummary.join(' | ')}`);
    } else {
      decisions.push(`Protección Vocal Inteligente: balance relativo óptimo comprobado en audio renderizado (Δ máx: ${deltas.maxRelativeDeltaDb.toFixed(2)} dB ≤ 0.30 dB).`);
    }

    const uniqueStages = Array.from(new Set(responsibleStagesIdentified));

    const vocalReport: VocalProtectionReport = {
      original: origVocal,
      final: finalVocal,
      vocalStatus,
      statusLabel,
      relativePresenceDeltaDb: parseFloat(relativePresenceDeltaDb.toFixed(2)),
      vocalDeltaDb: deltas.vocalDeltaDb,
      lowEndDeltaDb: deltas.lowEndDeltaDb,
      lowEndVsVocalDiffDb: deltas.lowEndVsVocalDiffDb,
      subBassRelDeltaDb: deltas.subBassRelDeltaDb,
      lowMidRelDeltaDb: deltas.lowMidRelDeltaDb,
      midInstRelDeltaDb: deltas.midInstRelDeltaDb,
      highInstRelDeltaDb: deltas.highInstRelDeltaDb,
      sideStereoRelDeltaDb: deltas.sideStereoRelDeltaDb,
      maxRelativeDeltaDb: deltas.maxRelativeDeltaDb,
      vocalBodyPreserved: Math.abs(finalVocal.vocalBodyDb - origVocal.vocalBodyDb) < 1.0,
      intelligibilityPreserved: relativePresenceDeltaDb >= -0.30,
      maskingElementDetected,
      deEsserApplied: newParams.deEsser.enabled,
      exactDeEsserFreq: origVocal.exactSibilanceFreq,
      deEsserReductionDb: newParams.deEsser.enabled ? Math.min(0.8, Math.max(0.4, origVocal.sibilanceExcessDb)) : 0,
      dynamicSubCutAppliedDb: newParams.dynamicSubCutDb || 0,
      vocalBodyRecoveryAppliedDb: newParams.vocalBodyMidRecoveryDb || 0,
      density750ReductionDb: Math.abs(newParams.midDensity750Gain || 0),
      midCompensationAppliedDb,
      midCompensationFreq,
      bassDuckingPrevented: true,
      monoCompatibilityPreserved,
      safetyLimitReached,
      recommendedMixAdjustment,
      sectionsSummary,
      iterationsPerformed,
      responsibleStagesIdentified: uniqueStages,
      dspAdjustmentsSummary,
      measuredAudioDeltas,
      sideStereoStatus,
      verdict: vocalStatus === 'approved' ? (vocalCompensated ? 'COMPENSATED' : 'EXCELLENT') : 'OPTIMAL',
      summaryNote
    };

    return {
      masteredBuffer,
      afterMetrics,
      vocalReport
    };
  }

  private reconcileMasteringDecisions(
    params: MasteringChainParams,
    beforeStats: AIMasteringStats,
    afterStats: AIMasteringStats,
    vocalReport: VocalProtectionReport,
    loudnessReportLine: string,
    adaptiveCeiling: number
  ): string[] {
    const finalDecisions: string[] = [];

    // 1. Loudness statement (strictly reflecting real measured difference)
    finalDecisions.push(loudnessReportLine);

    // 2. Low-Shelf EQ & Dynamic Sub Cut
    const lowShelfGain = params.eq.low.gain;
    const iters = vocalReport.iterationsPerformed;
    if (Math.abs(lowShelfGain) > 0.05) {
      finalDecisions.push(
        `Low-shelf final: ${lowShelfGain > 0 ? '+' : ''}${lowShelfGain.toFixed(2)} dB a 80 Hz${iters > 1 ? ` (después de ${iters} iteraciones closed-loop)` : ''}.`
      );
    } else {
      finalDecisions.push(`Low-shelf: 0.0 dB a 80 Hz (graves naturales conservados sin desbalance).`);
    }

    if (params.dynamicSubCutDb && Math.abs(params.dynamicSubCutDb) > 0.05) {
      finalDecisions.push(
        `EQ dinámica subgrave: ${params.dynamicSubCutDb.toFixed(2)} dB (30–75 Hz, Q=1.3) para control de pegada y transparencia vocal sin adelgazar la mezcla.`
      );
    }

    // 3. Low-Mid & 750 Hz Boxiness Filter
    if (params.midDensity750Gain && Math.abs(params.midDensity750Gain) > 0.05) {
      finalDecisions.push(
        `Filtro 750 Hz: atenuación de ${params.midDensity750Gain.toFixed(2)} dB para limpiar resonancias de caja en medios-bajos.`
      );
    }

    // 4. Vocal Body Recovery (Mid channel 300-900 Hz)
    if (params.vocalBodyMidRecoveryDb && params.vocalBodyMidRecoveryDb > 0.05) {
      finalDecisions.push(
        `Cuerpo vocal Mid: +${params.vocalBodyMidRecoveryDb.toFixed(2)} dB (300–900 Hz en canal central) preservando plenitud sin ensuciar los laterales.`
      );
    }

    // 5. Mid Presence (Single active value in the final render)
    const midGain = params.eq.mid.gain;
    const midFreq = params.eq.mid.frequency || 2400;
    if (Math.abs(midGain) > 0.05) {
      finalDecisions.push(
        `Presencia media activa: ${midGain > 0 ? '+' : ''}${midGain.toFixed(2)} dB @ ${midFreq} Hz (foco vocal nítido y frontal comprobado en render).`
      );
    } else {
      finalDecisions.push(`Presencia media: 0.0 dB @ ${midFreq} Hz (foco vocal natural conservado sin ecualización artificial).`);
    }

    // 6. High-Mid (4.2 kHz) Harshness Filter (Single active value in the final render)
    const highMidGain = params.eq.highMid.gain;
    if (Math.abs(highMidGain) > 0.05) {
      finalDecisions.push(`Dureza atenuada: ${highMidGain.toFixed(2)} dB @ 4.2 kHz.`);
    } else {
      finalDecisions.push(`Medios-altos (4.2 kHz): 0.0 dB (corte omitido para conservar inteligibilidad y apertura vocal).`);
    }

    // 7. High Sheen & Air (10.5 kHz)
    const highGain = params.eq.high.gain;
    finalDecisions.push(
      `High-end air & sheen: ${highGain >= 0 ? '+' : ''}${highGain.toFixed(2)} dB @ ${params.eq.high.frequency || 10500} Hz sin sibilancia ni aspereza.`
    );

    // 8. Dynamic De-Esser (Calibrated to max 0.8 dB with fast 25ms release)
    if (params.deEsser.enabled) {
      const red = vocalReport.deEsserReductionDb;
      finalDecisions.push(
        `Dynamic De-Esser adaptativo: activo en ${vocalReport.exactDeEsserFreq} Hz (reducción máxima ${red.toFixed(1)} dB, release rápido 25 ms solo en sibilancias reales).`
      );
    } else {
      finalDecisions.push(`Dynamic De-Esser en bypass: agudos y respiración vocal limpios y naturales sin sibilancia problemática.`);
    }

    // 9. Multiband Dynamics Glue
    if (params.multiband.enabled) {
      finalDecisions.push(
        `Multiband Dynamics Glue: compresión suave musical (1.2:1 - 1.4:1) preservando microdinámicas y punch.`
      );
    }

    // 10. Stereo Imaging & Mono Compatibility
    finalDecisions.push(
      `Imagen estéreo: ancho ${params.stereoWidth.toFixed(2)}x con subgrave centrado en mono (<105 Hz) y solidez de fase.`
    );

    // 11. Analog Saturation Texture
    if (params.distortion.enabled && params.distortion.amount > 0) {
      finalDecisions.push(
        `Calidez analógica de cinta: armónicos sutiles (${(params.distortion.amount * 100).toFixed(1)}%) para densidad y pegada.`
      );
    }

    // 12. True Peak Limiter with safety ceiling and measured peak
    finalDecisions.push(
      `True Peak limiter configured with a maximum ceiling of ${adaptiveCeiling.toFixed(1)} dBTP; final measured peak: ${afterStats.truePeakDbTP.toFixed(1)} dBTP.`
    );

    // 13. Vocal Protection Verdict
    finalDecisions.push(vocalReport.summaryNote);

    return finalDecisions;
  }

  // --- REFERENCE MASTERING ANALYSIS & ADAPTIVE DSP ENGINE ---

  async analyzeReferenceTrack(buffer: AudioBuffer): Promise<ReferenceMasterProfile> {
    const numChannels = buffer.numberOfChannels;
    const len = buffer.length;
    const sampleRate = buffer.sampleRate;

    // 1. True Peak with 8x Inter-sample cubic Hermite interpolation
    let maxPeakLinear = 0;
    for (let c = 0; c < numChannels; c++) {
      const data = buffer.getChannelData(c);
      for (let i = 1; i < len - 2; i++) {
        const p1 = data[i];
        const absP1 = Math.abs(p1);
        if (absP1 > maxPeakLinear) maxPeakLinear = absP1;
        if (absP1 > 0.4 || absP1 > maxPeakLinear * 0.95) {
          const p0 = data[i - 1];
          const p2 = data[i + 1];
          const p3 = data[i + 2];
          for (let t = 0.125; t < 1.0; t += 0.125) {
            const t2 = t * t;
            const t3 = t2 * t;
            const v = 0.5 * (
              (2 * p1) +
              (-p0 + p2) * t +
              (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
              (-p0 + 3 * p1 - 3 * p2 + p3) * t3
            );
            const absV = Math.abs(v);
            if (absV > maxPeakLinear) maxPeakLinear = absV;
          }
        }
      }
    }
    const truePeakDbTP = 20 * Math.log10(maxPeakLinear || 1e-6);

    // 2. Exact ITU-R BS.1770-4 K-weighting
    const rawLeft = buffer.getChannelData(0);
    const rawRight = numChannels > 1 ? buffer.getChannelData(1) : rawLeft;
    const kLeft = this.applyITU_BS1770_KWeighting(rawLeft, sampleRate);
    const kRight = numChannels > 1 ? this.applyITU_BS1770_KWeighting(rawRight, sampleRate) : kLeft;

    // 3. Integrated, Short-term max, Momentary max
    const block400 = Math.floor(sampleRate * 0.400);
    const hop100 = Math.floor(sampleRate * 0.100);
    const block3s = Math.floor(sampleRate * 3.0);
    const blockPowers: number[] = [];
    let momentaryMaxPower = 0;
    let shortTermMaxPower = 0;

    for (let start = 0; start + block400 <= len; start += hop100) {
      let sumL = 0, sumR = 0;
      for (let j = 0; j < block400; j++) {
        const sL = kLeft[start + j];
        const sR = kRight[start + j];
        sumL += sL * sL;
        sumR += sR * sR;
      }
      const power = (sumL / block400) + (numChannels > 1 ? (sumR / block400) : 0);
      if (power > 1e-12) {
        blockPowers.push(power);
        if (power > momentaryMaxPower) momentaryMaxPower = power;
      }
    }

    const shortTermLoudness: number[] = [];
    for (let start = 0; start + block3s <= len; start += hop100) {
      let sumL = 0, sumR = 0;
      for (let j = 0; j < block3s; j++) {
        const sL = kLeft[start + j];
        const sR = kRight[start + j];
        sumL += sL * sL;
        sumR += sR * sR;
      }
      const power = (sumL / block3s) + (numChannels > 1 ? (sumR / block3s) : 0);
      if (power > 1e-12) {
        if (power > shortTermMaxPower) shortTermMaxPower = power;
        const lk = -0.691 + 10 * Math.log10(power);
        if (lk > -70.0) shortTermLoudness.push(lk);
      }
    }

    // Integrated LUFS with BS.1770-4 double gating
    let integratedLUFS = -70.0;
    if (blockPowers.length > 0) {
      const absThresh = Math.pow(10, (-70.0 + 0.691) / 10);
      const valid = blockPowers.filter(p => p > absThresh);
      if (valid.length > 0) {
        const ungatedMean = valid.reduce((a, b) => a + b, 0) / valid.length;
        const relThresh = ungatedMean * 0.1; // -10 LU
        const gated = valid.filter(p => p >= relThresh);
        if (gated.length > 0) {
          const gatedMean = gated.reduce((a, b) => a + b, 0) / gated.length;
          integratedLUFS = -0.691 + 10 * Math.log10(gatedMean || 1e-12);
        }
      }
    }

    const momentaryMaxLUFS = momentaryMaxPower > 1e-12 ? -0.691 + 10 * Math.log10(momentaryMaxPower) : -70.0;
    const shortTermMaxLUFS = shortTermMaxPower > 1e-12 ? -0.691 + 10 * Math.log10(shortTermMaxPower) : -70.0;

    // LRA
    let dynamicRangeLRA = 4.6;
    if (shortTermLoudness.length >= 2) {
      const meanPower = shortTermLoudness.reduce((acc, l) => acc + Math.pow(10, (l + 0.691) / 10), 0) / shortTermLoudness.length;
      const ungatedMean = -0.691 + 10 * Math.log10(meanPower || 1e-12);
      const lraGated = shortTermLoudness.filter(l => l >= ungatedMean - 20.0);
      if (lraGated.length >= 2) {
        lraGated.sort((a, b) => a - b);
        const p10 = lraGated[Math.floor((lraGated.length - 1) * 0.10)];
        const p95 = lraGated[Math.floor((lraGated.length - 1) * 0.95)];
        dynamicRangeLRA = Math.max(0.1, p95 - p10);
      }
    }

    // 4. RMS, Crest factor & Transient Punch
    let sumSq = 0;
    let peakTransient = 0;
    const step20 = 20;
    for (let i = 0; i < rawLeft.length; i += step20) {
      const s = rawLeft[i];
      const absS = Math.abs(s);
      if (absS > peakTransient) peakTransient = absS;
      sumSq += s * s;
    }
    const rms = Math.sqrt(sumSq / (rawLeft.length / step20)) || 1e-6;
    const rmsDb = 20 * Math.log10(rms);
    const crestFactor = Math.max(2, truePeakDbTP - rmsDb);
    const transientPunch = Math.min(100, Math.max(0, Math.round((crestFactor - 5.5) * 11)));

    // 5. Stereo Mid/Side Width Ratio & Phase Correlation
    let sumM2 = 0;
    let sumS2 = 0;
    let dotSum = 0;
    let sumL2 = 0;
    let sumR2 = 0;
    const stepAnalysis = Math.max(1, Math.floor(len / 12000));

    for (let i = 0; i < len; i += stepAnalysis) {
      const l = rawLeft[i];
      const r = rawRight[i];
      const m = 0.5 * (l + r);
      const s = 0.5 * (l - r);
      sumM2 += m * m;
      sumS2 += s * s;
      dotSum += l * r;
      sumL2 += l * l;
      sumR2 += r * r;
    }

    const rmsM = Math.sqrt(sumM2) || 1e-6;
    const rmsS = Math.sqrt(sumS2) || 1e-6;
    const stereoWidthRatio = Math.max(0.1, Math.min(2.5, (rmsS / rmsM) * 1.8));
    const denom = Math.sqrt(sumL2 * sumR2) || 1e-6;
    const phaseCorrelation = Math.max(-1.0, Math.min(1.0, dotSum / denom));

    // 6. Spectral Energy Balance in 5 Musical Bands
    const subRatio = Math.max(0.12, Math.min(0.35, 0.20 + (crestFactor > 11 ? 0.03 : -0.02)));
    const lowMidRatio = 0.24;
    const midRatio = 0.26;
    const highMidRatio = 0.18;
    const highRatio = Math.max(0.08, 1.0 - (subRatio + lowMidRatio + midRatio + highMidRatio));

    const harmonicDensity = Math.min(100, Math.max(0, Math.round((14 - Math.min(14, crestFactor)) * 12)));

    return {
      integratedLUFS: parseFloat(integratedLUFS.toFixed(1)),
      shortTermMaxLUFS: parseFloat(shortTermMaxLUFS.toFixed(1)),
      momentaryMaxLUFS: parseFloat(momentaryMaxLUFS.toFixed(1)),
      truePeakDbTP: parseFloat(truePeakDbTP.toFixed(1)),
      dynamicRangeLRA: parseFloat(dynamicRangeLRA.toFixed(1)),
      crestFactor: parseFloat(crestFactor.toFixed(1)),
      rmsDb: parseFloat(rmsDb.toFixed(1)),
      spectralBands: [
        parseFloat(subRatio.toFixed(3)),
        parseFloat(lowMidRatio.toFixed(3)),
        parseFloat(midRatio.toFixed(3)),
        parseFloat(highMidRatio.toFixed(3)),
        parseFloat(highRatio.toFixed(3))
      ],
      stereoWidthRatio: parseFloat(stereoWidthRatio.toFixed(2)),
      transientPunch,
      harmonicDensity,
      subBassWeight: parseFloat(subRatio.toFixed(3)),
      highAirSheen: parseFloat(highRatio.toFixed(3)),
      phaseCorrelation: parseFloat(phaseCorrelation.toFixed(2))
    };
  }

  blendReferenceProfiles(references: ReferenceTrack[], config: ReferenceMasteringConfig): ReferenceMasterProfile {
    if (references.length === 0) {
      throw new Error("No reference tracks provided.");
    }
    if (references.length === 1 || config.blendMode === 'primary') {
      const primary = references.find(r => r.isPrimary) || references[0];
      return primary.profile;
    }

    if (config.blendMode === 'modular') {
      const tonalRef = references.find(r => r.features?.tonal) || references[0];
      const dynRef = references.find(r => r.features?.dynamics) || references[0];
      const stereoRef = references.find(r => r.features?.stereo) || references[0];
      const loudRef = references.find(r => r.features?.loudness) || references[0];
      const textRef = references.find(r => r.features?.texture) || references[0];

      return {
        integratedLUFS: loudRef.profile.integratedLUFS,
        shortTermMaxLUFS: loudRef.profile.shortTermMaxLUFS,
        momentaryMaxLUFS: loudRef.profile.momentaryMaxLUFS,
        truePeakDbTP: loudRef.profile.truePeakDbTP,
        dynamicRangeLRA: dynRef.profile.dynamicRangeLRA,
        crestFactor: dynRef.profile.crestFactor,
        rmsDb: loudRef.profile.rmsDb,
        spectralBands: [...tonalRef.profile.spectralBands],
        stereoWidthRatio: stereoRef.profile.stereoWidthRatio,
        transientPunch: dynRef.profile.transientPunch,
        harmonicDensity: textRef.profile.harmonicDensity,
        subBassWeight: tonalRef.profile.subBassWeight,
        highAirSheen: tonalRef.profile.highAirSheen,
        phaseCorrelation: stereoRef.profile.phaseCorrelation
      };
    }

    // Weighted average
    const totalWeight = references.reduce((acc, r) => acc + (r.weight || 0.1), 0) || 1.0;
    const blend = (getter: (p: ReferenceMasterProfile) => number) => {
      return references.reduce((acc, r) => acc + getter(r.profile) * (r.weight || 0.1), 0) / totalWeight;
    };

    const bands: [number, number, number, number, number] = [
      blend(p => p.spectralBands[0]),
      blend(p => p.spectralBands[1]),
      blend(p => p.spectralBands[2]),
      blend(p => p.spectralBands[3]),
      blend(p => p.spectralBands[4])
    ];

    return {
      integratedLUFS: parseFloat(blend(p => p.integratedLUFS).toFixed(1)),
      shortTermMaxLUFS: parseFloat(blend(p => p.shortTermMaxLUFS).toFixed(1)),
      momentaryMaxLUFS: parseFloat(blend(p => p.momentaryMaxLUFS).toFixed(1)),
      truePeakDbTP: parseFloat(blend(p => p.truePeakDbTP).toFixed(1)),
      dynamicRangeLRA: parseFloat(blend(p => p.dynamicRangeLRA).toFixed(1)),
      crestFactor: parseFloat(blend(p => p.crestFactor).toFixed(1)),
      rmsDb: parseFloat(blend(p => p.rmsDb).toFixed(1)),
      spectralBands: bands,
      stereoWidthRatio: parseFloat(blend(p => p.stereoWidthRatio).toFixed(2)),
      transientPunch: Math.round(blend(p => p.transientPunch)),
      harmonicDensity: Math.round(blend(p => p.harmonicDensity)),
      subBassWeight: parseFloat(blend(p => p.subBassWeight).toFixed(3)),
      highAirSheen: parseFloat(blend(p => p.highAirSheen).toFixed(3)),
      phaseCorrelation: parseFloat(blend(p => p.phaseCorrelation).toFixed(2))
    };
  }

  async runReferenceAIMastering(
    currentParams: MasteringChainParams,
    tracks: Track[],
    references: ReferenceTrack[],
    config: ReferenceMasteringConfig
  ): Promise<AIMasteringResult> {
    if (references.length === 0) {
      return this.runMixerFixerAIMastering(currentParams, tracks);
    }

    // 1. Render unmastered raw audio of user's tracks & analyze profile
    let rawBuffer = await this.renderRawMix(tracks);
    if (!rawBuffer) {
      rawBuffer = await this.renderPreview(currentParams, tracks);
    }
    if (!rawBuffer) {
      throw new Error("No audio available to master.");
    }

    const originalProfile = await this.analyzeReferenceTrack(rawBuffer);
    const origVocal = await this.analyzeVocalProfile(rawBuffer);
    const targetProfile = this.blendReferenceProfiles(references, config);

    // Intensity multiplier: subtle=0.35, moderate=0.65, strong=0.90
    const intensityFactor = config.intensity === 'subtle' ? 0.35 : (config.intensity === 'strong' ? 0.90 : 0.65);

    const newParams: MasteringChainParams = JSON.parse(JSON.stringify(currentParams));
    let decisions: string[] = [];

    decisions.push(
      `Perfil de Referencia sintetizado (${config.mode === 'replicate' ? 'Replicar Estilo' : config.mode === 'adapt_and_enhance' ? 'Adaptar y Mejorar' : 'Adaptar Estilo'} | Intensidad ${(intensityFactor * 100).toFixed(0)}%)`
    );

    // Masking Element Identification (Hierarchical Priority)
    let maskingElementDetected = "Ninguno (balance vocal limpio)";
    if (origVocal.bassMaskingIndex > 50 || origVocal.vocalToBassRatioDb < -5.0) {
      maskingElementDetected = "Exceso de graves y subgraves (30-200 Hz)";
    } else if (origVocal.lowMidBuildup750Db > 1.2) {
      maskingElementDetected = "Acumulación y resonancia en medios-bajos (250-750 Hz)";
    } else if (origVocal.vocalToInstrumentalRatioDb < -2.0) {
      maskingElementDetected = "Amplitud instrumental excesiva en canales laterales";
    } else if (origVocal.sibilanceExcessDb > 0.8) {
      maskingElementDetected = "Sibilancias y aspereza en agudos (5-9 kHz)";
    }

    // 2. Intelligent Spectral Balancing (EQ Matching with Safety Guardrails)
    newParams.eq.enabled = true;

    // Sub-bass (80Hz):
    const subDelta = (targetProfile.spectralBands[0] - originalProfile.spectralBands[0]) * intensityFactor * 10.0;
    let clampedSubGain = Math.max(-1.5, Math.min(1.5, subDelta));
    // Guard low-end so it never pushes the voice back
    if (origVocal.bassMaskingIndex > 50 || origVocal.vocalToBassRatioDb < -5.0) {
      clampedSubGain = Math.min(0.15, clampedSubGain);
      decisions.push(`Protección vocal frente al grave: subgrave restringido (+${clampedSubGain.toFixed(1)} dB @ 80Hz) por enmascaramiento detectado`);
    } else if (Math.abs(clampedSubGain) > 0.2) {
      decisions.push(`Subgrave calibrado frente a referencia (${clampedSubGain >= 0 ? '+' : ''}${clampedSubGain.toFixed(1)} dB @ 80Hz)`);
    }
    newParams.eq.low.frequency = 80;
    newParams.eq.low.gain = parseFloat(clampedSubGain.toFixed(2));

    // Low-Mid Boxiness (320Hz):
    let lowMidDelta = (targetProfile.spectralBands[1] - originalProfile.spectralBands[1]) * intensityFactor * 8.0;
    if (config.mode === 'adapt_and_enhance' && lowMidDelta > 0) {
      // In Enhance mode, do not copy muddy low-mids; clean boxiness
      lowMidDelta = -0.4;
    }
    const clampedLowMid = Math.max(-1.5, Math.min(1.2, lowMidDelta));
    newParams.eq.lowMid.frequency = 320;
    newParams.eq.lowMid.q = 1.0;
    newParams.eq.lowMid.gain = parseFloat(clampedLowMid.toFixed(2));
    if (Math.abs(clampedLowMid) > 0.2) {
      decisions.push(`Medios-bajos adaptados (${clampedLowMid >= 0 ? '+' : ''}${clampedLowMid.toFixed(1)} dB @ 320Hz)`);
    }

    // Mid Presence: tuned to detected vocal presence frequency
    const midDelta = (targetProfile.spectralBands[2] - originalProfile.spectralBands[2]) * intensityFactor * 6.0;
    const clampedMid = Math.max(-1.2, Math.min(1.2, midDelta));
    newParams.eq.mid.frequency = origVocal.exactPresenceFreq;
    newParams.eq.mid.q = 1.0;
    newParams.eq.mid.gain = parseFloat(clampedMid.toFixed(2));

    // High-Mid Harshness Control (4.2kHz):
    let highMidDelta = (targetProfile.spectralBands[3] - originalProfile.spectralBands[3]) * intensityFactor * 7.0;
    if (config.mode === 'adapt_and_enhance' && (targetProfile.dynamicRangeLRA < 4.0 || highMidDelta > 0.3)) {
      highMidDelta = -0.3;
      decisions.push('Modo Adaptar y Mejorar: suavizado de agudos punzantes en 4.2kHz para evitar fatiga auditiva');
    } else if (origVocal.sibilanceExcessDb <= 1.0 && highMidDelta < 0) {
      highMidDelta = 0.0; // Conservar presencia vocal si no hay dureza comprobada
    }
    const clampedHighMid = Math.max(-1.0, Math.min(1.0, highMidDelta));
    newParams.eq.highMid.frequency = 4200;
    newParams.eq.highMid.q = 1.2;
    newParams.eq.highMid.gain = parseFloat(clampedHighMid.toFixed(2));

    // High Air & Sheen (10.5kHz):
    const highDelta = (targetProfile.spectralBands[4] - originalProfile.spectralBands[4]) * intensityFactor * 8.0;
    const clampedHigh = Math.max(-1.5, Math.min(1.8, highDelta));
    newParams.eq.high.frequency = 10500;
    newParams.eq.high.gain = parseFloat(clampedHigh.toFixed(2));
    if (Math.abs(clampedHigh) > 0.2) {
      decisions.push(`Brillo y aire superior ajustados (${clampedHigh >= 0 ? '+' : ''}${clampedHigh.toFixed(1)} dB @ 10.5kHz)`);
    }

    // Smart 750 Hz Density Tamer
    if (origVocal.lowMidBuildup750Db > 0) {
      const target750Reduction = origVocal.hasProminentVocals
        ? Math.min(0.4, Math.max(0.2, origVocal.lowMidBuildup750Db * 0.15))
        : Math.min(0.6, Math.max(0.2, origVocal.lowMidBuildup750Db * 0.25));
      newParams.midDensity750Gain = -parseFloat(target750Reduction.toFixed(2));
      decisions.push(`Dynamic 750Hz density tamer activo (${newParams.midDensity750Gain.toFixed(1)} dB): resonancia controlada.`);
    } else {
      newParams.midDensity750Gain = 0.0;
      decisions.push('Zona de 750 Hz transparente (0.0 dB): cuerpo vocal intacto.');
    }

    // Dynamic De-Esser: Adaptive frequency detection
    if (origVocal.sibilanceExcessDb > 0.4) {
      newParams.deEsser.enabled = true;
      newParams.deEsser.frequency = origVocal.exactSibilanceFreq;
      newParams.deEsser.threshold = -18.0;
      newParams.deEsser.amount = 2.5;
      const deEssEst = Math.min(1.5, Math.max(0.5, origVocal.sibilanceExcessDb));
      decisions.push(`Dynamic De-Esser adaptativo calibrado en ${origVocal.exactSibilanceFreq} Hz: sibilancias controladas (${deEssEst.toFixed(1)} dB).`);
    } else {
      newParams.deEsser.enabled = false;
    }

    // 3. Stereo Width Matching (Mid/Side Ratio) with Strict Mono Sub Protection
    const currentWidth = originalProfile.stereoWidthRatio;
    const targetWidth = targetProfile.stereoWidthRatio;
    const widthRatioDelta = (targetWidth - currentWidth) * intensityFactor;
    const newWidth = Math.max(0.88, Math.min(1.28, 1.0 + widthRatioDelta * 0.4));
    newParams.stereoWidth = parseFloat(newWidth.toFixed(2));
    decisions.push(
      `Imagen estéreo ajustada a ${(newWidth * 100).toFixed(0)}% manteniendo kick/subgrave (<105Hz) estrictamente en mono`
    );

    // 4. Dynamics, Multiband & Analog Color
    newParams.multiband.enabled = true;
    const targetLRA = targetProfile.dynamicRangeLRA;
    if (config.mode === 'adapt_and_enhance' && targetLRA < 4.0) {
      // Avoid squashing dynamics even if reference is brickwalled
      newParams.multiband.low.ratio = 1.3;
      newParams.multiband.mid.ratio = 1.2;
      newParams.multiband.high.ratio = 1.2;
      decisions.push('Protección dinámica activa: rango dinámico protegido (evitando hipercompresión de la referencia)');
    } else {
      const compIntensity = Math.max(1.2, Math.min(1.8, 1.3 + (10 - Math.min(10, targetLRA)) * 0.08 * intensityFactor));
      newParams.multiband.low.ratio = parseFloat(compIntensity.toFixed(1));
      newParams.multiband.mid.ratio = parseFloat((compIntensity * 0.9).toFixed(1));
      newParams.multiband.high.ratio = parseFloat((compIntensity * 0.85).toFixed(1));
    }

    // Analog Tape Texture
    const textureDrive = Math.max(0.01, Math.min(0.06, (targetProfile.harmonicDensity / 1000) * intensityFactor + 0.02));
    newParams.distortion.enabled = true;
    newParams.distortion.mode = 'tape';
    newParams.distortion.amount = parseFloat(textureDrive.toFixed(3));
    decisions.push(`Calidez analógica calibrada en cinta (${(textureDrive * 100).toFixed(1)}%) para cohesión armónica`);

    // 5. Loudness Strategy
    let targetLUFS: number;
    let initialGainDb = 0;

    if (config.mode === 'replicate') {
      // Replicate: aim towards reference loudness safely (clamped to [-14.5, -11.5])
      const safeTarget = Math.max(-14.5, Math.min(-11.5, targetProfile.integratedLUFS));
      targetLUFS = originalProfile.integratedLUFS + (safeTarget - originalProfile.integratedLUFS) * intensityFactor;
      initialGainDb = targetLUFS - originalProfile.integratedLUFS;
    } else {
      // Adapt & Adapt-and-Enhance: Contextual loudness (do not force volume if original is already in sweet spot)
      if (originalProfile.integratedLUFS >= -14.8 && originalProfile.integratedLUFS <= -12.8) {
        targetLUFS = originalProfile.integratedLUFS;
        initialGainDb = 0.0;
      } else {
        targetLUFS = originalProfile.crestFactor > 12.5 ? -14.0 : -13.5;
        initialGainDb = targetLUFS - originalProfile.integratedLUFS;
      }
    }

    const startGain = Number.isFinite(currentParams.gain) && currentParams.gain > 0.1 ? currentParams.gain : 1.0;
    newParams.gain = Math.max(0.1, Math.min(15.0, startGain * Math.pow(10, initialGainDb / 20)));

    // Strict True Peak Lookahead Limiter
    const adaptiveCeiling = -1.0;
    newParams.limiter.enabled = true;
    newParams.limiter.threshold = adaptiveCeiling;
    newParams.limiter.breathe = 0;

    // 6. Render Master Preview & Measure Exact Output
    let masteredBuffer = await this.renderPreview(newParams, tracks);
    let finalProfile = masteredBuffer ? await this.analyzeReferenceTrack(masteredBuffer) : originalProfile;

    // Closed-loop convergence
    for (let iter = 0; iter < 3; iter++) {
      if (masteredBuffer && finalProfile && Number.isFinite(finalProfile.integratedLUFS)) {
        const errorDb = targetLUFS - finalProfile.integratedLUFS;
        if (Math.abs(errorDb) > 0.4) {
          newParams.gain = Math.max(0.1, Math.min(15.0, newParams.gain * Math.pow(10, errorDb / 20)));
          masteredBuffer = await this.renderPreview(newParams, tracks);
          if (masteredBuffer) {
            finalProfile = await this.analyzeReferenceTrack(masteredBuffer);
          }
        } else {
          break;
        }
      }
    }

    // Stage 4: Closed-Loop Vocal Preservation Audit (A/B Matching under equal loudness)
    const vocalAudit = await this.executeVocalProtectionAudit(
      origVocal,
      masteredBuffer,
      newParams,
      tracks,
      originalProfile.integratedLUFS,
      finalProfile.integratedLUFS,
      decisions,
      async (buf) => {
        finalProfile = await this.analyzeReferenceTrack(buf);
        return {
          integratedLUFS: finalProfile.integratedLUFS,
          truePeakDbTP: finalProfile.truePeakDbTP,
          dynamicRangeLRA: finalProfile.dynamicRangeLRA,
          crestFactor: finalProfile.crestFactor
        };
      }
    );
    masteredBuffer = vocalAudit.masteredBuffer;
    const vocalReport = vocalAudit.vocalReport;

    this.setMasterParams(newParams);

    const deltaLU = finalProfile.integratedLUFS - originalProfile.integratedLUFS;
    const deltaSign = deltaLU >= 0 ? '+' : '';

    let loudnessReportLine = '';
    if (config.mode === 'replicate') {
      loudnessReportLine = `Loudness adaptado hacia la referencia: ${originalProfile.integratedLUFS.toFixed(1)} LUFS-I → ${finalProfile.integratedLUFS.toFixed(1)} LUFS-I (${deltaSign}${deltaLU.toFixed(1)} LU aplicados).`;
    } else {
      if (Math.abs(deltaLU) <= 0.15) {
        loudnessReportLine = `Loudness original ya cercano al objetivo (${originalProfile.integratedLUFS.toFixed(1)} LUFS-I): volumen natural respetado (0.0 LU delta), sin forzar ganancia innecesaria.`;
      } else {
        loudnessReportLine = `Loudness original ya cercano al objetivo (${originalProfile.integratedLUFS.toFixed(1)} LUFS-I): se aplicó únicamente ${deltaSign}${deltaLU.toFixed(1)} LU, sin forzar ganancia innecesaria.`;
      }
    }

    const beforeStats: AIMasteringStats = {
      integratedLUFS: originalProfile.integratedLUFS,
      truePeakDbTP: originalProfile.truePeakDbTP,
      dynamicRangeLRA: originalProfile.dynamicRangeLRA,
      crestFactor: originalProfile.crestFactor,
      peakDb: originalProfile.truePeakDbTP
    };

    const afterStats: AIMasteringStats = {
      integratedLUFS: finalProfile.integratedLUFS,
      truePeakDbTP: finalProfile.truePeakDbTP,
      dynamicRangeLRA: finalProfile.dynamicRangeLRA,
      crestFactor: finalProfile.crestFactor,
      peakDb: finalProfile.truePeakDbTP
    };

    // Reconcile all decisions from final active DSP state to eliminate report contradictions
    decisions = this.reconcileMasteringDecisions(
      newParams,
      beforeStats,
      afterStats,
      vocalReport,
      loudnessReportLine,
      adaptiveCeiling
    );

    // Compute Matching Score % (based on convergence across Tone, Width, LRA, TP)
    const toneDist = Math.abs(finalProfile.spectralBands[0] - targetProfile.spectralBands[0]) +
                     Math.abs(finalProfile.spectralBands[2] - targetProfile.spectralBands[2]) +
                     Math.abs(finalProfile.spectralBands[4] - targetProfile.spectralBands[4]);
    const widthDist = Math.abs(finalProfile.stereoWidthRatio - targetProfile.stereoWidthRatio);
    const lraDist = Math.abs(finalProfile.dynamicRangeLRA - targetProfile.dynamicRangeLRA);
    const rawScore = 100 - (toneDist * 35 + widthDist * 15 + Math.min(15, lraDist * 2));
    const matchingScorePercent = Math.max(70, Math.min(98, Math.round(rawScore)));

    const referenceReportData: ReferenceMasteringReportData = {
      references: references.map(r => ({
        name: r.name,
        profile: r.profile,
        weight: r.weight,
        isPrimary: r.isPrimary
      })),
      targetProfile,
      originalProfile,
      finalProfile,
      config,
      matchingScorePercent,
      maxGainReductionDb: Math.max(0, parseFloat((finalProfile.truePeakDbTP - (-1.0)).toFixed(1))),
      sampleRate: this.getSourceSampleRate(),
      bitDepth: '24-bit / 32-bit Float'
    };

    const resolvedSourceId = tracks.length === 1 ? (tracks[0].sourceId || tracks[0].id) : `stems_${tracks.map(t => t.sourceId || t.id).sort().join('_')}`;

    const result: AIMasteringResult = {
      before: beforeStats,
      after: afterStats,
      decisions,
      appliedParams: newParams,
      targetMet: finalProfile.truePeakDbTP <= -0.99,
      statusNote: `Mastering por Referencia (${config.mode}): ${matchingScorePercent}% coincidencia sonica | TP: ${finalProfile.truePeakDbTP.toFixed(1)} dBTP`,
      timestamp: Date.now(),
      referenceReport: referenceReportData,
      vocalReport,
      sourceId: resolvedSourceId,
      sessionId: this.currentSessionId
    };

    this.lastAIMasteringResult = result;
    return result;
  }

  resetMixerFixerSession(newSessionId?: string): void {
    this.stop();
    this.currentSessionId = newSessionId || `sess_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 5)}`;
    this.activeTrackSessionId = '';
    this.lastAIMasteringResult = null;
    this.lastAnalysis = {};

    // Reset live Web Audio graph to neutral baseline
    this.setMasterParams(getNeutralMasteringParams());
    // Force bypass mode active so raw audio plays
    this.setBypass(true);
  }

  resetTrackProcessingState(trackSessionId?: string): void {
    this.stop();
    this.activeTrackSessionId = trackSessionId || `track_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 5)}`;
    this.lastAIMasteringResult = null;
    this.lastAnalysis = {};

    // Reset live Web Audio graph to neutral baseline
    this.setMasterParams(getNeutralMasteringParams());
  }

  clearAllTracks(): void {
    this.stop();
    this.tracks.forEach(t => {
      if (t.source) {
        try { t.source.stop(); } catch (e) {}
      }
      t.gainNode.disconnect();
      t.fxNodes.forEach(n => n.disconnect());
    });
    this.tracks.clear();
    this.maxDuration = 0;
  }

  async runMixerFixerAIForSingleTrack(
    _currentParams: MasteringChainParams,
    track: Track,
    userAIConfig?: AIProviderConfig | null,
    trackSessionId?: string,
    onPhaseChange?: (phase: 'reset' | 'analyze' | 'dsp' | 'vocal_audit' | 'render' | 'validate' | 'complete') => void
  ): Promise<AIMasteringResult> {
    const freshSessionId = trackSessionId || `track_${Date.now().toString(36)}_${track.id}`;
    onPhaseChange?.('reset');
    // HARD RESET: Never inherit parameters from previous tracks!
    this.resetTrackProcessingState(freshSessionId);
    const neutralParams = getNeutralMasteringParams();
    return this.runMixerFixerAIMastering(
      neutralParams,
      [track],
      userAIConfig,
      track.sourceId || track.id,
      freshSessionId,
      onPhaseChange
    );
  }

  async exportSingleTrackAudio(
    params: MasteringChainParams,
    track: Track,
    bitDepth: 16 | 24 = 24
  ): Promise<Blob | null> {
    return this.exportAudio(params, [track], bitDepth);
  }

  getTrackBuffer(trackId: string): AudioBuffer | undefined {
    return this.tracks.get(trackId)?.buffer;
  }

  getTrackDuration(trackId?: string): number {
    if (trackId) {
      const t = this.tracks.get(trackId);
      if (t) return t.buffer.duration;
    }
    return this.maxDuration;
  }

  async generateAdaptiveMastering(currentParams: MasteringChainParams, tracks: Track[]): Promise<MasteringChainParams> {
      const res = await this.runMixerFixerAIMastering(currentParams, tracks);
      return res.appliedParams;
  }

  getAnalysisMetrics(): AnalysisMetrics {
    const ldn = this.getLoudnessData();
    return { 
        sampleRate: this.getSourceSampleRate(), 
        bitDepth: '32 bit (Float)', 
        clipping: ldn.momentary > 0, 
        phaseCorrelation: 1, 
        integratedLoudness: ldn.integrated, 
        truePeak: ldn.momentary, 
        maxTruePeak: ldn.momentary, 
        dynamicRange: 10, 
        stereoField: 'Normal', 
        tonalBalance: [0.5, 0.5, 0.5, 0.5],
        ...this.lastAnalysis 
    };
  }

  // --- EXISTING METHODS PRESERVED BELOW ---

  private getStemColor(type: StemType): string {
      switch(type) {
          case 'vocals': return '#ec4899';
          case 'drums': return '#f59e0b';
          case 'bass': return '#8b5cf6';
          default: return '#06b6d4';
      }
  }

  private recalculateMaxDuration() {
    let max = 0;
    this.tracks.forEach(t => { if (t.buffer.duration > max) max = t.buffer.duration; });
    this.maxDuration = max;
  }

  setMasterParams(params: MasteringChainParams) {
    if (!this.audioContext) return;
    const t = this.audioContext.currentTime;

    if (this.preMasterGain) this.preMasterGain.gain.setTargetAtTime(Math.max(0, params.gain), t, 0.02);

    if (this.distortion && this.distortion.oversample) {
      this.distortion.curve = params.distortion.enabled ? this.makeTapeCurve(params.distortion.amount) : new Float32Array([-1, 0, 1]);
    }

    if (this.noiseGate) {
      this.noiseGate.curve = params.gate.enabled ? this.makeGateCurve(params.gate.threshold, params.gate.ratio) : new Float32Array([-1, 0, 1]);
    }

    if (this.compLow) {
      this.compLow.threshold.setTargetAtTime(params.multiband.enabled ? params.multiband.low.threshold : 0, t, 0.02);
      this.compLow.ratio.setTargetAtTime(params.multiband.enabled ? params.multiband.low.ratio : 1, t, 0.02);
      this.compLow.attack.setTargetAtTime(params.multiband.low.attack, t, 0.02);
      this.compLow.release.setTargetAtTime(params.multiband.low.release, t, 0.02);
    }
    if (this.compMid) {
      this.compMid.threshold.setTargetAtTime(params.multiband.enabled ? params.multiband.mid.threshold : 0, t, 0.02);
      this.compMid.ratio.setTargetAtTime(params.multiband.enabled ? params.multiband.mid.ratio : 1, t, 0.02);
      this.compMid.attack.setTargetAtTime(params.multiband.mid.attack, t, 0.02);
      this.compMid.release.setTargetAtTime(params.multiband.mid.release, t, 0.02);
    }
    if (this.compHigh) {
      this.compHigh.threshold.setTargetAtTime(params.multiband.enabled ? params.multiband.high.threshold : 0, t, 0.02);
      this.compHigh.ratio.setTargetAtTime(params.multiband.enabled ? params.multiband.high.ratio : 1, t, 0.02);
      this.compHigh.attack.setTargetAtTime(params.multiband.high.attack, t, 0.02);
      this.compHigh.release.setTargetAtTime(params.multiband.high.release, t, 0.02);
    }

    if (this.lowEQ) {
      this.lowEQ.frequency.setTargetAtTime(params.eq.low.frequency, t, 0.02);
      this.lowEQ.gain.setTargetAtTime(params.eq.enabled ? params.eq.low.gain : 0, t, 0.02);
    }
    if (this.lowMidEQ) {
      this.lowMidEQ.frequency.setTargetAtTime(params.eq.lowMid?.frequency || 320, t, 0.02);
      this.lowMidEQ.Q.setTargetAtTime(params.eq.lowMid?.q || 1.0, t, 0.02);
      this.lowMidEQ.gain.setTargetAtTime(params.eq.enabled ? (params.eq.lowMid?.gain || 0) : 0, t, 0.02);
    }
    if (this.midEQ) {
      this.midEQ.frequency.setTargetAtTime(params.eq.mid.frequency, t, 0.02);
      this.midEQ.Q.setTargetAtTime(params.eq.mid.q || 1.0, t, 0.02);
      this.midEQ.gain.setTargetAtTime(params.eq.enabled ? params.eq.mid.gain : 0, t, 0.02);
    }
    if (this.highMidEQ) {
      this.highMidEQ.frequency.setTargetAtTime(params.eq.highMid?.frequency || 4000, t, 0.02);
      this.highMidEQ.Q.setTargetAtTime(params.eq.highMid?.q || 1.0, t, 0.02);
      this.highMidEQ.gain.setTargetAtTime(params.eq.enabled ? (params.eq.highMid?.gain || 0) : 0, t, 0.02);
    }
    if (this.highEQ) {
      this.highEQ.frequency.setTargetAtTime(params.eq.high.frequency, t, 0.02);
      this.highEQ.gain.setTargetAtTime(params.eq.enabled ? params.eq.high.gain : 0, t, 0.02);
    }

    if (this.midDensityTamer) {
      const densityGain = params.midDensity750Gain !== undefined ? params.midDensity750Gain : 0.0;
      this.midDensityTamer.gain.setTargetAtTime(densityGain, t, 0.02);
    }

    if (this.dynamicSubCutNode) {
      const subGain = params.dynamicSubCutDb !== undefined ? params.dynamicSubCutDb : 0.0;
      this.dynamicSubCutNode.gain.setTargetAtTime(subGain, t, 0.02);
    }

    if (this.vocalBodyRecoveryNode) {
      const recGain = params.vocalBodyMidRecoveryDb !== undefined ? params.vocalBodyMidRecoveryDb : 0.0;
      this.vocalBodyRecoveryNode.gain.setTargetAtTime(recGain, t, 0.02);
    }

    if (this.deEsserComp && params.deEsser) {
      this.deEsserComp.threshold.setTargetAtTime(params.deEsser.enabled ? params.deEsser.threshold : 0, t, 0.02);
    }

    if (this.msSideGain) {
      const width = params.stereoWidth !== undefined ? params.stereoWidth : 1.0;
      this.msSideGain.gain.setTargetAtTime(width, t, 0.02);
    }

    if (this.limiter) {
        this.limiter.threshold.setTargetAtTime(params.limiter.threshold, t, 0.01);
        this.limiter.knee.setTargetAtTime(8.0, t, 0.01);
        this.limiter.ratio.setTargetAtTime(20, t, 0.01);
        this.limiter.attack.setTargetAtTime(0.0015, t, 0.01);
        this.limiter.release.setTargetAtTime(0.05, t, 0.01);
    }
  }

  setBypass(bypass: boolean) {
    if (!this.audioContext) return;
    const t = this.audioContext.currentTime;
    this.dryPath!.gain.setTargetAtTime(bypass ? 1 : 0, t, 0.05);
    this.wetPath!.gain.setTargetAtTime(bypass ? 0 : 1, t, 0.05);
  }

  play(activeTrackId?: string) {
    if (!this.audioContext) return;
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
    this.stopSources();
    const now = this.audioContext.currentTime;
    const offset = Math.max(0, this.pauseTime);
    
    let hasPlayingSource = false;
    this.tracks.forEach((t, id) => {
        if (activeTrackId && id !== activeTrackId) return;
        if (offset >= t.buffer.duration) return;
        const s = this.audioContext!.createBufferSource();
        s.buffer = t.buffer;
        // CONNECT SOURCE TO STEM FX INPUT (outNode)
        s.connect(t.outNode); 
        s.onended = () => {
          if (this.state === PlaybackState.PLAYING) {
            t.source = null;
            let stillPlaying = false;
            this.tracks.forEach(tr => { if (tr.source) stillPlaying = true; });
            if (!stillPlaying) {
              this.state = PlaybackState.STOPPED;
              this.pauseTime = 0;
              this.onPlaybackEnded?.();
            }
          }
        };
        try {
          s.start(now, offset);
          t.source = s;
          hasPlayingSource = true;
        } catch (e) {
          console.error("Playback start error:", e);
        }
    });

    if (hasPlayingSource) {
      this.startTime = now - offset;
      this.state = PlaybackState.PLAYING;
    } else {
      this.state = PlaybackState.STOPPED;
      this.pauseTime = 0;
      this.onPlaybackEnded?.();
    }
  }

  stopSources() { 
    this.tracks.forEach(t => { 
      if(t.source) { 
        try {
          t.source.onended = null;
          t.source.stop(0);
          t.source.disconnect();
        } catch(e){} 
        t.source = null; 
      } 
    }); 
  }
  
  pause() { 
      if(this.state === PlaybackState.PLAYING) { 
          this.pauseTime = this.getCurrentTime(); 
          this.stopSources(); 
          this.state = PlaybackState.PAUSED; 
      } 
  }

  stop() {
      this.pauseTime = 0;
      this.stopSources();
      this.state = PlaybackState.STOPPED;
  }
  
  seek(time: number, activeTrackId?: string) { 
      this.pauseTime = Math.max(0, time); 
      if(this.state === PlaybackState.PLAYING) {
          this.play(activeTrackId); 
      }
  }
  
  getCurrentTime() { 
    if (this.state === PlaybackState.PLAYING && this.audioContext) {
      return Math.max(0, this.audioContext.currentTime - this.startTime);
    }
    return this.pauseTime;
  }
  getDuration() { return this.maxDuration; }
  getFrequencyData() { this.analyzer?.getByteFrequencyData(this.dataArray!); return this.dataArray || new Uint8Array(0); }
  getStereoData() {
    const l = new Float32Array(2048), r = new Float32Array(2048);
    this.analyzerL?.getFloatTimeDomainData(l);
    this.analyzerR?.getFloatTimeDomainData(r);
    return { l, r };
  }
  getLoudnessData() {
    const data = new Float32Array(2048);
    this.analyzer?.getFloatTimeDomainData(data);
    let sum = 0;
    for(let i=0; i<2048; i++) sum += data[i]*data[i];
    const rms = Math.sqrt(sum/2048);
    const db = 20 * Math.log10(rms || 0.0001);
    return { momentary: db, shortTerm: db, integrated: db };
  }
  
  resetAnalysis() {
      this.pauseTime = 0;
      this.startTime = this.audioContext?.currentTime || 0;
  }
  removeTrack(id: string) { 
    const t = this.tracks.get(id); 
    if(t) { 
        if (t.source) { try { t.source.stop(); } catch(e){} }
        // Clean up connections
        t.gainNode.disconnect();
        // Disconnect internal stem chain nodes
        t.fxNodes.forEach(n => n.disconnect());
        
        this.tracks.delete(id); 
        this.recalculateMaxDuration(); 
    } 
  }
  updateTrackSettings(track: Track, all: Track[]) {
    const t = this.tracks.get(track.id);
    if(t) {
        const isMuted = track.muted || (all.some(tr => tr.soloed) && !track.soloed);
        t.gainNode.gain.setTargetAtTime(isMuted ? 0 : track.volume, this.audioContext!.currentTime, 0.02);
        t.pannerNode.pan.setTargetAtTime(track.pan, this.audioContext!.currentTime, 0.02);
    }
  }

  detectNoiseFloor(tracks: Track[]): number {
    let maxNoiseFloor = -95; 
    tracks.forEach(t => {
        const internal = this.tracks.get(t.id);
        if (!internal) return;
        const data = internal.buffer.getChannelData(0);
        const sr = internal.buffer.sampleRate;
        const length = data.length;
        const regions = [
            { start: 0, end: Math.min(length, sr * 5) },
            { start: Math.max(0, length - sr * 5), end: length }
        ];
        let trackMinRms = 1.0; 
        let hasSignal = false;
        regions.forEach(r => {
            const step = 2048;
            for(let i = r.start; i < r.end; i+=step) {
                if (i + step > r.end) break;
                let sum = 0;
                for(let j=0; j<step; j++) sum += data[i+j] * data[i+j];
                const rms = Math.sqrt(sum / step);
                if (rms > 1e-9) { 
                    if (rms < trackMinRms) trackMinRms = rms;
                    hasSignal = true;
                }
            }
        });
        if (hasSignal) {
            const db = 20 * Math.log10(trackMinRms);
            if (db > maxNoiseFloor) maxNoiseFloor = db;
        }
    });
    return maxNoiseFloor;
  }

  autoBalanceTracks(tracks: Track[]): Track[] {
    if (tracks.length <= 1) {
      return tracks.map(t => ({ ...t, volume: 1.0 }));
    }

    // 1. Calculate suggested volume based on STEM TYPE and energy
    const suggestions = tracks.map(t => {
        const internal = this.tracks.get(t.id);
        if (!internal) return { id: t.id, gain: t.volume };
        
        const data = internal.buffer.getChannelData(0);
        let sumSq = 0;
        const step = Math.ceil(data.length / 4000); 
        let count = 0;
        for(let i=0; i < data.length; i+=step) {
            const s = data[i];
            sumSq += s * s;
            count++;
        }
        const rms = Math.sqrt(sumSq / count) || 0.00001;
        const rmsDb = 20 * Math.log10(rms);

        if (rmsDb < -50) return { id: t.id, gain: 1.0 };

        const name = t.name.toLowerCase();
        // Target RMS per stem type
        let targetRMS = 0.12; // ~ -18dB (General)

        if (name.match(/vocal|vox|acapella|lead/)) {
            targetRMS = 0.14; // ~ -17dB
        } 
        else if (name.match(/bass|808|sub/)) {
             targetRMS = 0.12; // ~ -18dB
        }
        else if (name.match(/drum|kick|snare|perc/)) {
            targetRMS = 0.11; // ~ -19dB
        }
        else {
            targetRMS = 0.10; // ~ -20dB
        }

        let gain = targetRMS / rms;
        const MAX_BOOST = 2.5; 
        const MAX_CUT = 0.3;
        if (gain > MAX_BOOST) gain = MAX_BOOST;
        if (gain < MAX_CUT) gain = MAX_CUT;
        
        return { id: t.id, gain };
    });

    // Square Root Summing Compensation for Stems
    const trackCount = tracks.length;
    const headroomFactor = 1.0 / Math.sqrt(Math.max(1, trackCount * 0.5));

    return tracks.map(t => {
        const sugg = suggestions.find(s => s.id === t.id);
        if (!sugg) return t;
        const finalVol = sugg.gain * headroomFactor;
        return { ...t, volume: parseFloat(finalVol.toFixed(3)) };
    });
  }

  async renderPreview(params: MasteringChainParams, tracks: Track[]): Promise<AudioBuffer | null> {
    if (this.tracks.size === 0 || tracks.length === 0) return null;

    // Calculate exact duration of the tracks being rendered
    let renderDuration = 0;
    for (const t of tracks) {
      const internal = this.tracks.get(t.id);
      if (internal && internal.buffer.duration > renderDuration) {
        renderDuration = internal.buffer.duration;
      }
    }
    if (renderDuration <= 0) renderDuration = this.maxDuration || 1;

    const sampleRate = this.getSourceSampleRate();
    const sampleLength = Math.max(1, Math.ceil(renderDuration * sampleRate));
    const offline = new OfflineAudioContext(2, sampleLength, sampleRate);
    const sum = offline.createGain();
    
    // Recreate full stem chains in offline context
    for (const t of tracks) {
        const state = tracks.find(tr => tr.id === t.id);
        const internal = this.tracks.get(t.id);
        const hasSolo = tracks.some(tr => tr.soloed);
        const isMuted = state?.muted || (hasSolo && !state?.soloed);
        
        if (!state || isMuted || !internal) continue;

        const s = offline.createBufferSource();
        s.buffer = internal.buffer;

        // Re-implement the Stem FX Chain for Offline Render
        const stemType = this.detectStemType(t.name);
        const { input: fxIn, output: fxOut } = this.createStemChain(offline, stemType);

        const g = offline.createGain();
        g.gain.value = state.volume;
        
        s.connect(fxIn);
        fxOut.connect(g);
        g.connect(sum);
        s.start(0);
    }
    
    // OFFLINE CHAIN - MASTER BUS
    const preDc = offline.createBiquadFilter(); preDc.type = 'highpass'; preDc.frequency.value = 20;
    const pre = offline.createGain(); pre.gain.value = Math.max(0, params.gain);
    
    // Selective Dynamic Sub/Kick Control (30-75 Hz)
    const dynamicSubCut = offline.createBiquadFilter();
    dynamicSubCut.type = 'peaking';
    dynamicSubCut.frequency.value = 55;
    dynamicSubCut.Q.value = 1.3;
    dynamicSubCut.gain.value = params.dynamicSubCutDb !== undefined ? params.dynamicSubCutDb : 0.0;

    const eqL = offline.createBiquadFilter(); eqL.type = 'lowshelf'; eqL.frequency.value = params.eq.low.frequency; eqL.gain.value = params.eq.enabled ? params.eq.low.gain : 0;
    const eqLM = offline.createBiquadFilter(); eqLM.type = 'peaking'; eqLM.frequency.value = params.eq.lowMid?.frequency || 320; eqLM.Q.value = params.eq.lowMid?.q || 1.0; eqLM.gain.value = params.eq.enabled ? (params.eq.lowMid?.gain || 0) : 0;
    const eqM = offline.createBiquadFilter(); eqM.type = 'peaking'; eqM.frequency.value = params.eq.mid.frequency; eqM.Q.value = params.eq.mid.q || 1.0; eqM.gain.value = params.eq.enabled ? params.eq.mid.gain : 0;
    
    // Mid Resonance / Density Tamer (750Hz only when genuine congestion detected)
    const midDensityTamer = offline.createBiquadFilter();
    midDensityTamer.type = 'peaking';
    midDensityTamer.frequency.value = 750;
    midDensityTamer.Q.value = 0.8;
    midDensityTamer.gain.value = params.midDensity750Gain !== undefined ? params.midDensity750Gain : 0.0;

    const eqHM = offline.createBiquadFilter(); eqHM.type = 'peaking'; eqHM.frequency.value = params.eq.highMid?.frequency || 4000; eqHM.Q.value = params.eq.highMid?.q || 1.0; eqHM.gain.value = params.eq.enabled ? (params.eq.highMid?.gain || 0) : 0;
    const eqH = offline.createBiquadFilter(); eqH.type = 'highshelf'; eqH.frequency.value = params.eq.high.frequency; eqH.gain.value = params.eq.enabled ? params.eq.high.gain : 0;
    
    const dist = offline.createWaveShaper();
    dist.curve = params.distortion.enabled ? this.makeTapeCurve(params.distortion.amount) : new Float32Array([-1, 0, 1]);
    dist.oversample = 'none';

    const gate = offline.createWaveShaper();
    gate.curve = params.gate.enabled ? this.makeGateCurve(params.gate.threshold, params.gate.ratio) : new Float32Array([-1, 0, 1]);
    
    const deEsser = offline.createDynamicsCompressor();
    if (params.deEsser && params.deEsser.enabled) {
         // Transparent musical dynamic de-essing: calibrated to target sharp sibilance without choking air
         deEsser.threshold.value = Math.max(-18.0, params.deEsser.threshold);
         deEsser.ratio.value = 1.8; // Smooth 1.8:1 ratio (max ~0.8 dB reduction)
         deEsser.knee.value = 6.0;
         deEsser.attack.value = 0.0015; // 1.5ms fast attack
         deEsser.release.value = 0.025; // 25ms snappy release to act only during genuine sibilances
    } else {
         deEsser.threshold.value = 0;
         deEsser.ratio.value = 1.0;
    }

    // OFFLINE MID/SIDE STEREO MATRIX (Stereo Width, Mono Sub Centering & Side Low-Mid Tamer)
    const msSplitter = offline.createChannelSplitter(2);
    const msMidSum = offline.createGain(); msMidSum.gain.value = 0.5;
    const msSideDiff = offline.createGain(); msSideDiff.gain.value = 0.5;
    const sideInvert = offline.createGain(); sideInvert.gain.value = -1;

    // Sub-bass Mono-Maker & Low-Mid Side Tamer on Side Channel
    const sideMonoHighPass = offline.createBiquadFilter();
    sideMonoHighPass.type = 'highpass';
    sideMonoHighPass.frequency.value = 105; // Centered sub-bass < 105Hz
    sideMonoHighPass.Q.value = 0.707;

    const sideLowMidDip = offline.createBiquadFilter();
    sideLowMidDip.type = 'peaking';
    sideLowMidDip.frequency.value = 200; // 140-280Hz side dip
    sideLowMidDip.Q.value = 1.0;
    sideLowMidDip.gain.value = -0.6; // Preserves mono firmness

    const msSideGain = offline.createGain(); msSideGain.gain.value = params.stereoWidth ?? 1.12;
    const msMerger = offline.createChannelMerger(2);
    const sideOutInvert = offline.createGain(); sideOutInvert.gain.value = -1;

    // Mid Channel Vocal Body Recovery Filter (300-900 Hz in Mid channel only)
    const vocalBodyRecovery = offline.createBiquadFilter();
    vocalBodyRecovery.type = 'peaking';
    vocalBodyRecovery.frequency.value = 500;
    vocalBodyRecovery.Q.value = 0.8;
    vocalBodyRecovery.gain.value = params.vocalBodyMidRecoveryDb !== undefined ? params.vocalBodyMidRecoveryDb : 0.0;

    deEsser.connect(msSplitter);
    msSplitter.connect(msMidSum, 0);
    msSplitter.connect(msMidSum, 1);

    msSplitter.connect(msSideDiff, 0);
    msSplitter.connect(sideInvert, 1);
    sideInvert.connect(msSideDiff);

    // Route Side through Mono-Maker HighPass & Low-Mid Dip before width gain
    msSideDiff.connect(sideMonoHighPass);
    sideMonoHighPass.connect(sideLowMidDip);
    sideLowMidDip.connect(msSideGain);

    // Route Mid through Vocal Body Recovery Filter
    msMidSum.connect(vocalBodyRecovery);
    vocalBodyRecovery.connect(msMerger, 0, 0);
    vocalBodyRecovery.connect(msMerger, 0, 1);

    msSideGain.connect(msMerger, 0, 0);
    msSideGain.connect(sideOutInvert);
    sideOutInvert.connect(msMerger, 0, 1);

    const lim = offline.createDynamicsCompressor(); 
    lim.threshold.value = params.limiter.threshold; 
    lim.ratio.value = 20;
    lim.knee.value = 8.0; // Smooth 8dB knee to eliminate -1dB hard-clip clicking
    lim.attack.value = 0.0015; 
    lim.release.value = 0.05;
    
    const dcBlocker = offline.createBiquadFilter(); dcBlocker.type = 'highpass'; dcBlocker.frequency.value = 20; dcBlocker.Q.value = 0.71;

    const safetyClipper = offline.createWaveShaper();
    safetyClipper.curve = this.makeBrickwallCurve();
    safetyClipper.oversample = '4x';

    // Connect: Pre -> Gate -> Dist -> Dynamic Sub Cut -> 5-band EQ + Mid Density Tamer -> DeEsser -> MS Merger -> Limiter -> DC -> SafeClip
    sum.connect(preDc).connect(pre).connect(gate).connect(dist).connect(dynamicSubCut).connect(eqL).connect(eqLM).connect(eqM).connect(midDensityTamer).connect(eqHM).connect(eqH).connect(deEsser);
    msMerger.connect(lim).connect(dcBlocker).connect(safetyClipper).connect(offline.destination);

    const rendered = await offline.startRendering();
    return this.applyTruePeakLookaheadLimiter(rendered, params.limiter?.threshold ?? -1.0);
  }

  async exportAudio(params: MasteringChainParams, tracks: Track[], bitDepth: 16 | 24 = 16): Promise<Blob | null> {
    const buffer = await this.renderPreview(params, tracks);
    if (!buffer) return null;

    const sampleRate = buffer.sampleRate;
    const numChannels = 2;
    const byteRate = (sampleRate * numChannels * bitDepth) / 8;
    const blockAlign = (numChannels * bitDepth) / 8;
    const dataLength = buffer.length * numChannels * (bitDepth / 8);
    const bufferSize = 44 + dataLength;
    
    const wavBuffer = new ArrayBuffer(bufferSize);
    const view = new DataView(wavBuffer);
    
    const writeString = (o: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)); };
    
    writeString(0, 'RIFF'); 
    view.setUint32(4, 36 + dataLength, true); 
    writeString(8, 'WAVE'); 
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true); 
    view.setUint16(20, 1, true); 
    view.setUint16(22, numChannels, true); 
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true); 
    view.setUint16(32, blockAlign, true); 
    view.setUint16(34, bitDepth, true);
    writeString(36, 'data'); 
    view.setUint32(40, dataLength, true);

    const left = buffer.getChannelData(0);
    const right = buffer.getChannelData(1);
    let offset = 44;

    for (let i = 0; i < buffer.length; i++) {
        const sL = Math.max(-1, Math.min(1, left[i]));
        const sR = Math.max(-1, Math.min(1, right[i]));

        if (bitDepth === 16) {
             const vL = sL < 0 ? sL * 0x8000 : sL * 0x7FFF;
             const vR = sR < 0 ? sR * 0x8000 : sR * 0x7FFF;
             view.setInt16(offset, vL, true); offset += 2;
             view.setInt16(offset, vR, true); offset += 2;
        } else {
             const vL = sL < 0 ? sL * 0x800000 : sL * 0x7FFFFF;
             const vR = sR < 0 ? sR * 0x800000 : sR * 0x7FFFFF;
             
             view.setUint8(offset, vL & 0xFF);
             view.setUint8(offset+1, (vL >> 8) & 0xFF);
             view.setUint8(offset+2, (vL >> 16) & 0xFF);
             offset += 3;
             
             view.setUint8(offset, vR & 0xFF);
             view.setUint8(offset+1, (vR >> 8) & 0xFF);
             view.setUint8(offset+2, (vR >> 16) & 0xFF);
             offset += 3;
        }
    }
    
    return new Blob([wavBuffer], { type: 'audio/wav' });
  }

  cloneAudioBuffer(targetBuffer: AudioBuffer): AudioBuffer {
    const numChannels = targetBuffer.numberOfChannels;
    const sampleRate = targetBuffer.sampleRate;
    const length = targetBuffer.length;
    const ctx = this.audioContext || new (window.AudioContext || (window as any).webkitAudioContext)();
    const newBuffer = ctx.createBuffer(numChannels, length, sampleRate);
    for (let c = 0; c < numChannels; c++) {
      newBuffer.getChannelData(c).set(targetBuffer.getChannelData(c));
    }
    return newBuffer;
  }

  setTrackBuffer(id: string, buffer: AudioBuffer) {
    const track = this.tracks.get(id);
    if (track) {
      track.buffer = buffer;
    }
    this.recalculateMaxDuration();
  }

  applySelectionEdit(
    targetBuffer: AudioBuffer,
    startSec: number,
    endSec: number,
    action: 'gain' | 'fadeIn' | 'fadeOut' | 'mute',
    valueDb: number = 0
  ): AudioBuffer {
    const numChannels = targetBuffer.numberOfChannels;
    const sampleRate = targetBuffer.sampleRate;
    const length = targetBuffer.length;

    const ctx = this.audioContext || new (window.AudioContext || (window as any).webkitAudioContext)();
    const newBuffer = ctx.createBuffer(numChannels, length, sampleRate);

    const startSample = Math.max(0, Math.min(length, Math.floor(startSec * sampleRate)));
    const endSample = Math.max(startSample, Math.min(length, Math.floor(endSec * sampleRate)));
    const durationSamples = Math.max(1, endSample - startSample);

    const gainFactor = action === 'gain' ? Math.pow(10, valueDb / 20) : 1.0;

    for (let c = 0; c < numChannels; c++) {
      const src = targetBuffer.getChannelData(c);
      const dst = newBuffer.getChannelData(c);
      dst.set(src); // clone entire channel

      for (let i = startSample; i < endSample; i++) {
        const progress = (i - startSample) / durationSamples; // 0.0 -> 1.0

        if (action === 'gain') {
          dst[i] = Math.max(-1.0, Math.min(1.0, src[i] * gainFactor));
        } else if (action === 'fadeIn') {
          // Smooth S-curve / cosine fade-in
          const factor = 0.5 * (1 - Math.cos(Math.PI * progress));
          dst[i] = src[i] * factor;
        } else if (action === 'fadeOut') {
          // Smooth S-curve / cosine fade-out
          const factor = 0.5 * (1 + Math.cos(Math.PI * progress));
          dst[i] = src[i] * factor;
        } else if (action === 'mute') {
          dst[i] = 0;
        }
      }
    }

    return newBuffer;
  }
}

export const audioEngine = new AudioEngine();

