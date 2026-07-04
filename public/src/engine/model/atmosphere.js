                                                             
import {
  GAMMA_AIR,
  GAS_CONSTANT_AIR,
  STANDARD_DENSITY_KG_PER_M3,
  STANDARD_PRESSURE_PA,
  STANDARD_TEMPERATURE_K,
  celsiusToKelvin,
  clamp,
  kelvinToCelsius
} from "./units.js";

const ISA_LAPSE_RATE_K_PER_M = 0.0065;
const ISA_PRESSURE_EXPONENT = 5.25588;

export function computeAtmosphere(input              )               {
  const altitudeM = clamp(input.altitudeM, -500, 11000);
  const standardTempAtAltitudeK = STANDARD_TEMPERATURE_K - ISA_LAPSE_RATE_K_PER_M * altitudeM;
  const pressurePa =
    STANDARD_PRESSURE_PA *
    Math.pow(standardTempAtAltitudeK / STANDARD_TEMPERATURE_K, ISA_PRESSURE_EXPONENT);

  const seaLevelTempOffsetK = celsiusToKelvin(input.temperatureC) - STANDARD_TEMPERATURE_K;
  const actualTempK = Math.max(180, standardTempAtAltitudeK + seaLevelTempOffsetK);
  const densityKgPerM3 = pressurePa / (GAS_CONSTANT_AIR * actualTempK);
  const speedOfSoundMps = Math.sqrt(GAMMA_AIR * GAS_CONSTANT_AIR * actualTempK);

  return {
    temperatureC: kelvinToCelsius(actualTempK),
    temperatureK: actualTempK,
    pressurePa,
    densityKgPerM3,
    densityRatio: densityKgPerM3 / STANDARD_DENSITY_KG_PER_M3,
    speedOfSoundMps
  };
}
