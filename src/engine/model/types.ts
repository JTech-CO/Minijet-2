export const EngineMode = {
  Off: "off",
  Ready: "ready",
  Glow: "glow",
  Start: "start",
  Ignition: "ignition",
  Ramp: "ramp",
  Run: "run",
  Cool: "cool",
  Lockout: "lockout"
} as const;

export type EngineMode = (typeof EngineMode)[keyof typeof EngineMode];

export const FaultCode = {
  LowBattery: "low-battery",
  FuelStarvation: "fuel-starvation",
  HotStart: "hot-start",
  OverTemp: "over-temp",
  Overspeed: "overspeed",
  Flameout: "flameout",
  WetStart: "wet-start"
} as const;

export type FaultCode = (typeof FaultCode)[keyof typeof FaultCode];

export const StartBlockReason = {
  None: "none",
  MasterOff: "master-off",
  TrimOff: "trim-off",
  ThrottleHighGateRequired: "throttle-high-gate-required",
  ThrottleLowGateRequired: "throttle-low-gate-required",
  BatteryLow: "battery-low",
  FuelLow: "fuel-low",
  EngineHot: "engine-hot",
  WetFuelRisk: "wet-fuel-risk",
  SpoolStillTurning: "spool-still-turning"
} as const;

export type StartBlockReason = (typeof StartBlockReason)[keyof typeof StartBlockReason];

export interface AmbientInput {
  temperatureC: number;
  altitudeM: number;
}

export interface AmbientState {
  temperatureC: number;
  temperatureK: number;
  pressurePa: number;
  densityKgPerM3: number;
  densityRatio: number;
  speedOfSoundMps: number;
}

export interface EngineInputs {
  master: boolean;
  trimRun: boolean;
  throttle: number;
  ambient: AmbientInput;
  pumpPrime?: boolean;
  inletDistortion?: number;
  fuelBubble?: number;
}

export interface EngineSensors {
  rpm: number;
  egtC: number;
  pumpPressureBar: number;
  batteryVoltageV: number;
  thrustN: number;
}

export interface EcuStatus {
  startPermissive: boolean;
  startBlockReason: StartBlockReason;
  lightOffReady: boolean;
  idleStable: boolean;
  starterDuty: number;
  glowPlugDuty: number;
  pumpDuty: number;
  fuelScheduleNorm: number;
}

export interface EnginePerformanceTrace {
  correctedSpeedNorm: number;
  correctedMassFlowNorm: number;
  compressorEfficiency: number;
  surgeMargin: number;
  turbineTorqueNm: number;
  starterTorqueNm: number;
  frictionTorqueNm: number;
  netSpoolTorqueNm: number;
  spoolAccelerationRpmPerS: number;
  nozzlePressureRatio: number;
  pressureThrustN: number;
}

export interface EngineState {
  mode: EngineMode;
  modeElapsedS: number;
  startGateArmed: boolean;
  idleStableS: number;
  spoolRpm: number;
  spoolOmegaRadS: number;
  combustorTempC: number;
  turbineInletTempC: number;
  egtC: number;
  metalTempC: number;
  massFlowKgPerS: number;
  compressorPressureRatio: number;
  compressorTorqueNm: number;
  fuelFlowKgPerS: number;
  commandedFuelFlowKgPerS: number;
  fuelAirRatio: number;
  pumpPressureBar: number;
  batteryVoltageV: number;
  fuelRemainingKg: number;
  thrustN: number;
  exhaustVelocityMps: number;
  wetFuelKg: number;
  isCombustionLit: boolean;
  faults: FaultCode[];
  ecu: EcuStatus;
  performance: EnginePerformanceTrace;
  sensors: EngineSensors;
}

export interface EngineTelemetry {
  mode: EngineMode;
  faults: FaultCode[];
  rpm: number;
  rpmNorm: number;
  egtC: number;
  metalTempC: number;
  turbineInletTempC: number;
  fuelFlowGPerMin: number;
  fuelAirRatio: number;
  massFlowKgPerS: number;
  compressorPressureRatio: number;
  pumpPressureBar: number;
  batteryVoltageV: number;
  fuelRemainingPct: number;
  thrustN: number;
  exhaustVelocityMps: number;
  isCombustionLit: boolean;
  ecu: EcuStatus;
  performance: EnginePerformanceTrace;
}

export interface EngineSpec {
  name: string;
  spool: {
    idleRpm: number;
    maxRpm: number;
    ignitionRpm: number;
    selfSustainRpm: number;
    starterCutoffRpm: number;
    overspeedRpm: number;
    inertiaKgM2: number;
    starterTorqueNm: number;
    bearingFrictionNm: number;
    windageFrictionNm: number;
  };
  compressor: {
    referenceMassFlowKgPerS: number;
    pressureRatioAtMax: number;
    torqueAtMaxNm: number;
  };
  combustor: {
    lowerHeatingValueJPerKg: number;
    efficiency: number;
    temperatureGain: number;
    lightOffTempC: number;
    leanBlowoutFar: number;
    richBlowoutFar: number;
    hotStartTempC: number;
    maxContinuousEgtC: number;
  };
  turbine: {
    maxTorqueNm: number;
    extractionEfficiency: number;
  };
  fuel: {
    capacityKg: number;
    idleFlowKgPerS: number;
    maxFlowKgPerS: number;
    startFlowKgPerS: number;
    pumpLagS: number;
    maxPumpPressureBar: number;
  };
  electrical: {
    nominalBatteryV: number;
    lowBatteryV: number;
    resetBatteryV: number;
    pumpMinVoltageV: number;
    starterCurrentA: number;
    pumpCurrentA: number;
    batteryInternalResistanceOhm: number;
    drainPerSecondV: number;
  };
  thermal: {
    glowTargetC: number;
    egtLagS: number;
    combustorLagS: number;
    metalHeatLagS: number;
    metalCoolLagS: number;
  };
  sensors: {
    rpmLagS: number;
    egtLagS: number;
    pumpLagS: number;
    batteryLagS: number;
  };
  ecu: {
    glowDurationS: number;
    primePressureBar: number;
    primeDurationS: number;
    minStartDurationS: number;
    startTimeoutS: number;
    ignitionTimeoutS: number;
    idleStableDurationS: number;
    minStartFuelKg: number;
    maxStartEgtC: number;
    wetStartFuelLimitKg: number;
  };
}

export interface EcuCommand {
  glowPlugOn: boolean;
  starterOn: boolean;
  coolingStarterOn: boolean;
  requestedFuelFlowKgPerS: number;
  requestedPumpPressureBar: number;
}

export interface CompressorResult {
  massFlowKgPerS: number;
  pressureRatio: number;
  torqueNm: number;
  correctedSpeedNorm: number;
  correctedMassFlowNorm: number;
  efficiency: number;
  surgeMargin: number;
}

export interface CombustionResult {
  isLit: boolean;
  turbineInletTempC: number;
  fuelAirRatio: number;
  wetFuelKg: number;
}

export interface TurbineResult {
  torqueNm: number;
  shaftPowerW: number;
  thermalPowerW: number;
}

export interface SpoolResult {
  spoolOmegaRadS: number;
  spoolRpm: number;
  starterTorqueNm: number;
  frictionTorqueNm: number;
  netSpoolTorqueNm: number;
  spoolAccelerationRpmPerS: number;
}

export interface NozzleResult {
  thrustN: number;
  exhaustVelocityMps: number;
  pressureThrustN: number;
  nozzlePressureRatio: number;
}
