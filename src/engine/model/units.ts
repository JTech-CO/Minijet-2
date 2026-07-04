export const STANDARD_PRESSURE_PA = 101325;
export const STANDARD_TEMPERATURE_K = 288.15;
export const STANDARD_DENSITY_KG_PER_M3 = 1.225;
export const GAS_CONSTANT_AIR = 287.05;
export const GAMMA_AIR = 1.4;
export const CP_GAS_J_PER_KG_K = 1005;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * clamp(t, 0, 1);
}

export function expSmoothingFactor(dtS: number, tauS: number): number {
  if (tauS <= 0) return 1;
  return 1 - Math.exp(-dtS / tauS);
}

export function approachExp(current: number, target: number, dtS: number, tauS: number): number {
  return current + (target - current) * expSmoothingFactor(dtS, tauS);
}

export function celsiusToKelvin(celsius: number): number {
  return celsius + 273.15;
}

export function kelvinToCelsius(kelvin: number): number {
  return kelvin - 273.15;
}

export function rpmToRadPerSec(rpm: number): number {
  return (rpm * Math.PI * 2) / 60;
}

export function radPerSecToRpm(radPerSec: number): number {
  return (radPerSec * 60) / (Math.PI * 2);
}

export function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}
