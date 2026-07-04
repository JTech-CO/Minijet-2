             
               
                   
             
             
             
                    
import { CP_GAS_J_PER_KG_K, clamp, kelvinToCelsius } from "./units.js";

export function updateCombustor(
  state             ,
  ambient              ,
  command            ,
  spec            ,
  dtS        
)                   {
  const airFlow = Math.max(state.massFlowKgPerS, 0.0001);
  const fuelAirRatio = state.fuelFlowKgPerS / airFlow;
  const inStableMixture =
    fuelAirRatio >= spec.combustor.leanBlowoutFar &&
    fuelAirRatio <= spec.combustor.richBlowoutFar;
  const canLight =
    command.glowPlugOn &&
    state.spoolRpm >= spec.spool.ignitionRpm &&
    state.fuelFlowKgPerS > spec.fuel.startFlowKgPerS * 0.45 &&
    state.combustorTempC >= spec.combustor.lightOffTempC &&
    inStableMixture;

  const isLit =
    state.isCombustionLit && inStableMixture && state.fuelFlowKgPerS > 0
      ? true
      : canLight;

  let wetFuelKg = state.wetFuelKg;
  if (!isLit && state.fuelFlowKgPerS > 0) {
    wetFuelKg += state.fuelFlowKgPerS * dtS;
  } else if (isLit && wetFuelKg > 0) {
    wetFuelKg = Math.max(0, wetFuelKg - state.fuelFlowKgPerS * dtS * 6);
  }

  const mixturePeak =
    fuelAirRatio <= 0
      ? 0
      : Math.exp(-Math.pow((fuelAirRatio - 0.012) / 0.009, 2));
  const heatPowerW = isLit
    ? state.fuelFlowKgPerS * spec.combustor.lowerHeatingValueJPerKg * spec.combustor.efficiency * (0.65 + 0.35 * mixturePeak)
    : 0;
  const deltaTK = (heatPowerW / (airFlow * CP_GAS_J_PER_KG_K)) * spec.combustor.temperatureGain;
  const turbineInletTempK = ambient.temperatureK + deltaTK;

  return {
    isLit,
    turbineInletTempC: isLit ? clamp(kelvinToCelsius(turbineInletTempK), ambient.temperatureC, 1200) : ambient.temperatureC,
    fuelAirRatio,
    wetFuelKg
  };
}
