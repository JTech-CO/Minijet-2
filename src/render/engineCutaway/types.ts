import type { EngineMode } from "../../engine/index.ts";

export interface CutawayZoneState {
  id: "inlet" | "compressor" | "combustor" | "turbine" | "nozzle";
  label: string;
  pressureNorm: number;
  temperatureNorm: number;
  flowNorm: number;
  activityNorm: number;
}

export interface RotorVisualState {
  rpm: number;
  revolutionsPerSecond: number;
  blurNorm: number;
  direction: 1 | -1;
}

export interface FlameVisualState {
  lit: boolean;
  lengthNorm: number;
  intensityNorm: number;
  temperatureNorm: number;
  color: string;
}

export interface ExhaustVisualState {
  velocityNorm: number;
  densityNorm: number;
  temperatureNorm: number;
  thrustNorm: number;
  pressureGlowNorm: number;
}

export interface EngineCutawayState {
  mode: EngineMode;
  zones: CutawayZoneState[];
  compressorRotor: RotorVisualState;
  turbineRotor: RotorVisualState;
  flame: FlameVisualState;
  exhaust: ExhaustVisualState;
  overlay: {
    massFlowNorm: number;
    pressureRatioNorm: number;
    surgeMarginNorm: number;
    thrustNorm: number;
    egtNorm: number;
  };
}