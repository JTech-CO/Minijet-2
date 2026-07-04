import { EngineMode } from "../model/types.ts";
import type { EngineMode as EngineModeType } from "../model/types.ts";

export function isRunningMode(mode: EngineModeType): boolean {
  return mode === EngineMode.Ignition || mode === EngineMode.Ramp || mode === EngineMode.Run;
}

export function isStartMode(mode: EngineModeType): boolean {
  return mode === EngineMode.Glow || mode === EngineMode.Start || mode === EngineMode.Ignition;
}
