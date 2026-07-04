import type { EngineMode, FaultCode } from "../engine/index.ts";

export const AudioLayerId = {
  Starter: "starter",
  CompressorWhine: "compressorWhine",
  CombustionRoar: "combustionRoar",
  ExhaustRush: "exhaustRush",
  Pump: "pump",
  Instability: "instability",
  CoolingTicks: "coolingTicks",
  Warning: "warning"
} as const;

export type AudioLayerId = (typeof AudioLayerId)[keyof typeof AudioLayerId];

export interface AudioLayerState {
  id: AudioLayerId;
  gain: number;
  frequencyHz: number;
  filterHz: number;
  detuneCents: number;
  noiseMix: number;
  pulseRateHz: number;
}

export interface AudioCue {
  id: string;
  label: string;
  gain: number;
  priority: number;
}

export interface EngineAudioState {
  mode: EngineMode;
  masterGain: number;
  layers: Record<AudioLayerId, AudioLayerState>;
  cues: AudioCue[];
  activeFaults: FaultCode[];
}