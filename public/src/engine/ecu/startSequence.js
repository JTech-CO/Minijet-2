import { evaluateStartReadiness } from "./diagnostics.js";
                                                                                                           
import { EngineMode, FaultCode } from "../model/types.js";
import { clamp } from "../model/units.js";

                                 
                            
                       
                          
                               
 

export function updateStartSequence(
  state             ,
  inputs              ,
  spec            ,
  dtS        
)                 {
  const throttle = clamp(inputs.throttle, 0, 1);
  let mode = state.mode;
  let modeElapsedS = state.modeElapsedS + dtS;
  let startGateArmed = state.startGateArmed;
  const addedFaults                  = [];

  if (!inputs.master) {
    mode = EngineMode.Off;
    modeElapsedS = 0;
    startGateArmed = false;
    return { mode, modeElapsedS, startGateArmed, addedFaults };
  }

  if (mode === EngineMode.Lockout) {
    return { mode, modeElapsedS, startGateArmed: false, addedFaults };
  }

  const transitionTo = (nextMode                     ) => {
    if (nextMode !== mode) {
      mode = nextMode;
      modeElapsedS = 0;
    }
  };

  switch (mode) {
    case EngineMode.Off:
      startGateArmed = false;
      if (inputs.trimRun) transitionTo(EngineMode.Ready);
      break;
    case EngineMode.Ready:
      if (!inputs.trimRun) {
        transitionTo(EngineMode.Off);
        startGateArmed = false;
      } else {
        if (throttle > 0.95) startGateArmed = true;
        if (startGateArmed && throttle < 0.05) {
          const readiness = evaluateStartReadiness(
            { ...state, startGateArmed },
            inputs,
            spec,
            false
          );
          if (readiness.startPermissive) transitionTo(EngineMode.Glow);
        }
      }
      break;
    case EngineMode.Glow:
      if (!inputs.trimRun) {
        transitionTo(EngineMode.Cool);
      } else if (modeElapsedS >= spec.ecu.glowDurationS) {
        transitionTo(EngineMode.Start);
      }
      break;
    case EngineMode.Start:
      if (!inputs.trimRun) {
        transitionTo(EngineMode.Cool);
      } else if (state.spoolRpm >= spec.spool.ignitionRpm && modeElapsedS >= spec.ecu.minStartDurationS) {
        transitionTo(EngineMode.Ignition);
      } else if (modeElapsedS >= spec.ecu.startTimeoutS) {
        transitionTo(EngineMode.Cool);
        addedFaults.push(FaultCode.WetStart);
      }
      break;
    case EngineMode.Ignition:
      if (!inputs.trimRun) {
        transitionTo(EngineMode.Cool);
      } else if (
        state.isCombustionLit &&
        state.egtC > 95 &&
        state.spoolRpm >= spec.spool.selfSustainRpm
      ) {
        transitionTo(EngineMode.Ramp);
      } else if (modeElapsedS >= spec.ecu.ignitionTimeoutS) {
        transitionTo(EngineMode.Cool);
        addedFaults.push(FaultCode.WetStart);
      }
      break;
    case EngineMode.Ramp:
      if (!inputs.trimRun) {
        transitionTo(EngineMode.Cool);
      } else if (state.idleStableS >= spec.ecu.idleStableDurationS) {
        transitionTo(EngineMode.Run);
      }
      break;
    case EngineMode.Run:
      if (!inputs.trimRun) transitionTo(EngineMode.Cool);
      break;
    case EngineMode.Cool:
      startGateArmed = false;
      if (state.spoolRpm < 800 && state.egtC < inputs.ambient.temperatureC + 35) {
        transitionTo(inputs.trimRun ? EngineMode.Ready : EngineMode.Off);
      }
      break;
  }

  return { mode, modeElapsedS, startGateArmed, addedFaults };
}
