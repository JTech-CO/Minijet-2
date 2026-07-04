                                                                               
import { EngineMode, FaultCode } from "../model/types.js";
import { isRunningMode, isStartMode } from "./states.js";

function addFault(state             , fault                                            )       {
  if (!state.faults.includes(fault)) {
    state.faults.push(fault);
  }
}

export function applyProtections(
  state             ,
  inputs              ,
  spec            
)              {
  const next              = {
    ...state,
    faults: [...state.faults],
    sensors: { ...state.sensors }
  };

  if (next.batteryVoltageV < spec.electrical.lowBatteryV) {
    next.mode = EngineMode.Lockout;
    next.modeElapsedS = 0;
    next.commandedFuelFlowKgPerS = 0;
    next.fuelFlowKgPerS = 0;
    next.isCombustionLit = false;
    addFault(next, FaultCode.LowBattery);
    return next;
  }

  if (next.fuelRemainingKg <= 0 && isRunningMode(next.mode)) {
    next.mode = EngineMode.Cool;
    next.modeElapsedS = 0;
    next.isCombustionLit = false;
    addFault(next, FaultCode.FuelStarvation);
  }

  if (next.spoolRpm > spec.spool.overspeedRpm) {
    next.mode = EngineMode.Cool;
    next.modeElapsedS = 0;
    next.isCombustionLit = false;
    addFault(next, FaultCode.Overspeed);
  }

  if (isStartMode(next.mode) && next.egtC > spec.combustor.hotStartTempC) {
    next.mode = EngineMode.Cool;
    next.modeElapsedS = 0;
    next.isCombustionLit = false;
    addFault(next, FaultCode.HotStart);
  }

  if (next.mode === EngineMode.Run && next.egtC > spec.combustor.maxContinuousEgtC) {
    next.mode = EngineMode.Cool;
    next.modeElapsedS = 0;
    next.isCombustionLit = false;
    addFault(next, FaultCode.OverTemp);
  }

  const unstableCombustion =
    next.mode === EngineMode.Run &&
    next.commandedFuelFlowKgPerS > spec.fuel.idleFlowKgPerS * 0.7 &&
    !next.isCombustionLit &&
    inputs.trimRun;

  if (unstableCombustion) {
    next.mode = EngineMode.Cool;
    next.modeElapsedS = 0;
    addFault(next, FaultCode.Flameout);
  }

  return next;
}
