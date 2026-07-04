                                                                                           
import { EngineMode } from "../model/types.js";
import { clamp, lerp, smoothstep } from "../model/units.js";

export function scheduleEcuCommand(
  state             ,
  inputs              ,
  spec            
)             {
  const throttle = clamp(inputs.throttle, 0, 1);
  const targetRunRpm = spec.spool.idleRpm + (spec.spool.maxRpm - spec.spool.idleRpm) * Math.pow(throttle, 1.25);
  const openLoopFuelFromThrottle =
    spec.fuel.idleFlowKgPerS +
    (spec.fuel.maxFlowKgPerS - spec.fuel.idleFlowKgPerS) * Math.pow(throttle, 1.35);
  const runGovernorError = (targetRunRpm - state.spoolRpm) / (spec.spool.maxRpm - spec.spool.idleRpm);
  const runGovernorGain = throttle < 0.05 ? 4.2 : 2.2;
  const fuelFromThrottle = openLoopFuelFromThrottle * clamp(1 + runGovernorError * runGovernorGain, 0.52, 1.28);

  let requestedFuelFlowKgPerS = 0;
  let requestedPumpPressureBar = 0;
  let glowPlugOn = false;
  let starterOn = false;
  let coolingStarterOn = false;
  const autoPrimeActive = state.mode === EngineMode.Glow && state.modeElapsedS <= spec.ecu.primeDurationS;
  const primeRequested = Boolean(inputs.pumpPrime || autoPrimeActive);

  switch (state.mode) {
    case EngineMode.Off:
    case EngineMode.Ready:
      requestedPumpPressureBar = inputs.pumpPrime ? spec.ecu.primePressureBar : 0;
      break;
    case EngineMode.Glow:
      glowPlugOn = true;
      requestedPumpPressureBar = primeRequested ? spec.ecu.primePressureBar : 0;
      break;
    case EngineMode.Start:
      glowPlugOn = true;
      starterOn = true;
      requestedFuelFlowKgPerS =
        state.spoolRpm > spec.spool.ignitionRpm * 0.7 ? spec.fuel.startFlowKgPerS * 0.35 : 0;
      break;
    case EngineMode.Ignition:
      glowPlugOn = true;
      starterOn = state.spoolRpm < spec.spool.selfSustainRpm;
      requestedFuelFlowKgPerS = spec.fuel.startFlowKgPerS;
      break;
    case EngineMode.Ramp:
      starterOn = state.spoolRpm < spec.spool.selfSustainRpm;
      requestedFuelFlowKgPerS = lerp(
        spec.fuel.startFlowKgPerS,
        spec.fuel.idleFlowKgPerS * 1.18,
        state.spoolRpm / spec.spool.idleRpm
      );
      break;
    case EngineMode.Run:
      {
        const accelSchedule = smoothstep(
          spec.spool.idleRpm * 0.85,
          spec.spool.maxRpm * 0.9,
          state.spoolRpm
        );
        const scheduledMaxFuel = lerp(
          spec.fuel.idleFlowKgPerS * 2.4,
          spec.fuel.maxFlowKgPerS,
          accelSchedule
        );
        const targetFarLimit = 0.012 + 0.016 * throttle;
        const airflowFuelLimit = Math.max(spec.fuel.idleFlowKgPerS * 0.72, state.massFlowKgPerS * targetFarLimit);
        requestedFuelFlowKgPerS = clamp(
          fuelFromThrottle,
          spec.fuel.idleFlowKgPerS * 0.52,
          Math.min(scheduledMaxFuel, airflowFuelLimit)
        );
      }
      break;
    case EngineMode.Cool:
      coolingStarterOn = state.egtC > 120 && state.spoolRpm < 9000;
      break;
    case EngineMode.Lockout:
      break;
  }

  requestedPumpPressureBar =
    requestedFuelFlowKgPerS <= 0
      ? clamp(requestedPumpPressureBar, 0, spec.fuel.maxPumpPressureBar)
      : clamp(
          (requestedFuelFlowKgPerS / spec.fuel.maxFlowKgPerS) * spec.fuel.maxPumpPressureBar,
          0,
          spec.fuel.maxPumpPressureBar
        );

  return {
    glowPlugOn,
    starterOn,
    coolingStarterOn,
    requestedFuelFlowKgPerS,
    requestedPumpPressureBar
  };
}
