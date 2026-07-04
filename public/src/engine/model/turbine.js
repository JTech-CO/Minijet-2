                                                                         
import { CP_GAS_J_PER_KG_K, clamp, rpmToRadPerSec } from "./units.js";

export function computeTurbineTorque(state             , spec            )                {
  if (!state.isCombustionLit || state.fuelFlowKgPerS <= 0 || state.massFlowKgPerS <= 0) {
    return { torqueNm: 0, shaftPowerW: 0, thermalPowerW: 0 };
  }

  const rpmNorm = clamp(state.spoolRpm / spec.spool.maxRpm, 0, 1.15);
  const fuelNorm = clamp(state.fuelFlowKgPerS / spec.fuel.maxFlowKgPerS, 0, 1.25);
  const mixturePeak = Math.exp(-Math.pow((state.fuelAirRatio - 0.012) / 0.011, 2));
  const thermalDeltaC = Math.max(0, state.turbineInletTempC - state.egtC * 0.72);
  const gasPowerW = state.massFlowKgPerS * CP_GAS_J_PER_KG_K * thermalDeltaC;
  const fuelPowerW = state.fuelFlowKgPerS * spec.combustor.lowerHeatingValueJPerKg * spec.combustor.efficiency;
  const thermalPowerW = Math.min(gasPowerW, fuelPowerW) * spec.turbine.extractionEfficiency * (0.72 + 0.28 * mixturePeak);
  const omegaRadS = Math.max(rpmToRadPerSec(state.spoolRpm), 750);
  const torqueFromPowerNm = thermalPowerW / omegaRadS;
  const thermalNorm = clamp((state.turbineInletTempC - 260) / 720, 0, 1.25);
  const torqueCapNm =
    spec.turbine.maxTorqueNm *
    Math.pow(fuelNorm, 0.42) *
    (0.42 + 0.58 * rpmNorm) *
    (0.62 + 0.38 * thermalNorm);
  const torqueNm = clamp(torqueFromPowerNm, 0, torqueCapNm);
  const shaftPowerW = torqueNm * rpmToRadPerSec(state.spoolRpm);

  return { torqueNm, shaftPowerW, thermalPowerW };
}