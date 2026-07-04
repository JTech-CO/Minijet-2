                                                                                      
import { CP_GAS_J_PER_KG_K, GAMMA_AIR, celsiusToKelvin, clamp } from "./units.js";

const ESTIMATED_NOZZLE_AREA_M2 = 0.00018;
const NOZZLE_EFFICIENCY = 0.82;

export function computeNozzle(
  state             ,
  ambient              ,
  spec            
)               {
  if (state.massFlowKgPerS <= 0.0001) {
    return { thrustN: 0, exhaustVelocityMps: 0, pressureThrustN: 0, nozzlePressureRatio: 1 };
  }

  const egtK = celsiusToKelvin(state.egtC);
  const thermalDeltaK = Math.max(0, egtK - ambient.temperatureK);
  const nozzlePressureRatio = clamp(state.compressorPressureRatio * (0.82 + 0.18 * clamp(state.fuelAirRatio / 0.014, 0, 1.2)), 1, spec.compressor.pressureRatioAtMax * 1.08);
  const expansionTerm = 1 - Math.pow(1 / nozzlePressureRatio, (GAMMA_AIR - 1) / GAMMA_AIR);
  const pressureVelocityMps = Math.sqrt(Math.max(0, 2 * CP_GAS_J_PER_KG_K * egtK * NOZZLE_EFFICIENCY * expansionTerm));
  const thermalVelocityMps = Math.sqrt(2 * CP_GAS_J_PER_KG_K * thermalDeltaK * 0.22);
  const exhaustVelocityMps = Math.max(thermalVelocityMps, pressureVelocityMps);
  const residualExitPressurePa = ambient.pressurePa * (1 + 0.055 * (nozzlePressureRatio - 1));
  const pressureThrustN = Math.max(0, residualExitPressurePa - ambient.pressurePa) * ESTIMATED_NOZZLE_AREA_M2;
  const momentumThrustN = state.massFlowKgPerS * exhaustVelocityMps;
  const installationFactor = 0.48 + 0.18 * clamp((state.compressorPressureRatio - 1) / (spec.compressor.pressureRatioAtMax - 1), 0, 1);
  const thrustN = momentumThrustN * installationFactor + pressureThrustN;

  return {
    thrustN,
    exhaustVelocityMps,
    pressureThrustN,
    nozzlePressureRatio
  };
}