                                                                                                      
import { StartBlockReason } from "../model/types.js";
import { clamp } from "../model/units.js";

export function evaluateStartReadiness(
  state             ,
  inputs              ,
  spec            ,
  includeThrottleGate = true
)                                                          {
  const throttle = clamp(inputs.throttle, 0, 1);

  if (!inputs.master) {
    return { startPermissive: false, startBlockReason: StartBlockReason.MasterOff };
  }
  if (!inputs.trimRun) {
    return { startPermissive: false, startBlockReason: StartBlockReason.TrimOff };
  }
  if (state.batteryVoltageV < spec.electrical.lowBatteryV + 0.2) {
    return { startPermissive: false, startBlockReason: StartBlockReason.BatteryLow };
  }
  if (state.fuelRemainingKg < spec.ecu.minStartFuelKg) {
    return { startPermissive: false, startBlockReason: StartBlockReason.FuelLow };
  }
  if (state.egtC > spec.ecu.maxStartEgtC) {
    return { startPermissive: false, startBlockReason: StartBlockReason.EngineHot };
  }
  if (state.wetFuelKg > spec.ecu.wetStartFuelLimitKg) {
    return { startPermissive: false, startBlockReason: StartBlockReason.WetFuelRisk };
  }
  if (state.spoolRpm > spec.spool.ignitionRpm * 0.35) {
    return { startPermissive: false, startBlockReason: StartBlockReason.SpoolStillTurning };
  }
  if (includeThrottleGate && !state.startGateArmed && throttle <= 0.95) {
    return { startPermissive: false, startBlockReason: StartBlockReason.ThrottleHighGateRequired };
  }
  if (includeThrottleGate && state.startGateArmed && throttle >= 0.05) {
    return { startPermissive: false, startBlockReason: StartBlockReason.ThrottleLowGateRequired };
  }

  return { startPermissive: true, startBlockReason: StartBlockReason.None };
}

export function evaluateLightOffReady(state             , spec            )          {
  const mixtureStable =
    state.fuelAirRatio >= spec.combustor.leanBlowoutFar &&
    state.fuelAirRatio <= spec.combustor.richBlowoutFar;

  return (
    state.spoolRpm >= spec.spool.ignitionRpm &&
    state.combustorTempC >= spec.combustor.lightOffTempC &&
    state.fuelFlowKgPerS > spec.fuel.startFlowKgPerS * 0.45 &&
    mixtureStable
  );
}

export function buildEcuStatus(
  state             ,
  inputs              ,
  spec            ,
  command            
)            {
  const readiness = evaluateStartReadiness(state, inputs, spec);

  return {
    startPermissive: readiness.startPermissive,
    startBlockReason: readiness.startBlockReason,
    lightOffReady: evaluateLightOffReady(state, spec),
    idleStable: state.idleStableS >= spec.ecu.idleStableDurationS,
    starterDuty: command.starterOn ? 1 : command.coolingStarterOn ? 0.45 : 0,
    glowPlugDuty: command.glowPlugOn ? 1 : 0,
    pumpDuty: clamp(command.requestedPumpPressureBar / spec.fuel.maxPumpPressureBar, 0, 1),
    fuelScheduleNorm: clamp(command.requestedFuelFlowKgPerS / spec.fuel.maxFlowKgPerS, 0, 1)
  };
}

export function createIdleEcuStatus()            {
  return {
    startPermissive: false,
    startBlockReason: StartBlockReason.MasterOff,
    lightOffReady: false,
    idleStable: false,
    starterDuty: 0,
    glowPlugDuty: 0,
    pumpDuty: 0,
    fuelScheduleNorm: 0
  };
}