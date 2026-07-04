import type { AmbientState, CombustionResult, EcuCommand, EngineSpec, EngineState } from "./types.ts";
import { approachExp, clamp } from "./units.ts";

export function updateThermalState(
  state: EngineState,
  ambient: AmbientState,
  combustion: CombustionResult,
  command: EcuCommand,
  spec: EngineSpec,
  dtS: number
): Pick<EngineState, "combustorTempC" | "turbineInletTempC" | "egtC" | "metalTempC"> {
  const glowTargetC = command.glowPlugOn ? spec.thermal.glowTargetC : ambient.temperatureC;
  const combustorTargetC = combustion.isLit
    ? combustion.turbineInletTempC
    : Math.max(glowTargetC, ambient.temperatureC);
  const combustorTempC = approachExp(
    state.combustorTempC,
    combustorTargetC,
    dtS,
    combustion.isLit ? spec.thermal.combustorLagS : spec.thermal.combustorLagS * 2.6
  );

  const lowSpeedHeatSoakC = combustion.isLit ? 120 * (1 - clamp(state.spoolRpm / spec.spool.maxRpm, 0, 1)) : 0;
  const egtTargetC = combustion.isLit
    ? ambient.temperatureC + (combustion.turbineInletTempC - ambient.temperatureC) * 0.78 + lowSpeedHeatSoakC
    : command.glowPlugOn
      ? ambient.temperatureC + 45
      : ambient.temperatureC;
  const egtC = approachExp(state.egtC, egtTargetC, dtS, spec.thermal.egtLagS);
  const metalTau = egtC > state.metalTempC ? spec.thermal.metalHeatLagS : spec.thermal.metalCoolLagS;
  const metalTempC = approachExp(state.metalTempC, egtC, dtS, metalTau);

  return {
    combustorTempC,
    turbineInletTempC: clamp(combustion.turbineInletTempC, ambient.temperatureC, 1200),
    egtC,
    metalTempC
  };
}
