import { EngineMode } from "../model/types.js";
                                                                      

export function isRunningMode(mode                )          {
  return mode === EngineMode.Ignition || mode === EngineMode.Ramp || mode === EngineMode.Run;
}

export function isStartMode(mode                )          {
  return mode === EngineMode.Glow || mode === EngineMode.Start || mode === EngineMode.Ignition;
}
