import type { EngineSpec } from "../model/types.ts";

export const microTurbineSpec: EngineSpec = {
  name: "MJ-140 micro turbine",
  spool: {
    idleRpm: 35000,
    maxRpm: 140000,
    ignitionRpm: 13000,
    selfSustainRpm: 24500,
    starterCutoffRpm: 42000,
    overspeedRpm: 150000,
    inertiaKgM2: 0.000018,
    starterTorqueNm: 0.044,
    bearingFrictionNm: 0.0038,
    windageFrictionNm: 0.0175
  },
  compressor: {
    referenceMassFlowKgPerS: 0.055,
    pressureRatioAtMax: 3.2,
    torqueAtMaxNm: 0.104
  },
  combustor: {
    lowerHeatingValueJPerKg: 43000000,
    efficiency: 0.48,
    temperatureGain: 2.2,
    lightOffTempC: 175,
    leanBlowoutFar: 0.0032,
    richBlowoutFar: 0.032,
    hotStartTempC: 850,
    maxContinuousEgtC: 790
  },
  turbine: {
    maxTorqueNm: 0.138,
    extractionEfficiency: 0.94
  },
  fuel: {
    capacityKg: 0.32,
    idleFlowKgPerS: 0.000072,
    maxFlowKgPerS: 0.0011,
    startFlowKgPerS: 0.00004,
    pumpLagS: 0.18,
    maxPumpPressureBar: 8
  },
  electrical: {
    nominalBatteryV: 7.6,
    lowBatteryV: 6.3,
    resetBatteryV: 7.0,
    pumpMinVoltageV: 6.1,
    starterCurrentA: 8.2,
    pumpCurrentA: 1.6,
    batteryInternalResistanceOhm: 0.018,
    drainPerSecondV: 0.000025
  },
  thermal: {
    glowTargetC: 245,
    egtLagS: 0.9,
    combustorLagS: 0.18,
    metalHeatLagS: 6,
    metalCoolLagS: 18
  },
  sensors: {
    rpmLagS: 0.12,
    egtLagS: 0.5,
    pumpLagS: 0.2,
    batteryLagS: 0.12
  },
  ecu: {
    glowDurationS: 1.2,
    primePressureBar: 0.8,
    primeDurationS: 0.75,
    minStartDurationS: 0.45,
    startTimeoutS: 5.5,
    ignitionTimeoutS: 4.5,
    idleStableDurationS: 0.75,
    minStartFuelKg: 0.012,
    maxStartEgtC: 180,
    wetStartFuelLimitKg: 0.00018
  }
};
