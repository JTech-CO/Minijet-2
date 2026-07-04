                                                                                    
import { approachExp, clamp, smoothstep } from "./units.js";

export function computeBatteryAuthority(voltageV        , spec            )         {
  return smoothstep(spec.electrical.pumpMinVoltageV, spec.electrical.nominalBatteryV, voltageV);
}

export function updateFuelSystem(
  state             ,
  inputs              ,
  command            ,
  spec            ,
  dtS        
)                                                                                                          {
  const batteryAuthority = computeBatteryAuthority(state.batteryVoltageV, spec);
  const bubbleLoss = 1 - clamp(inputs.fuelBubble ?? 0, 0, 1) * 0.65;
  const hasFuel = state.fuelRemainingKg > 0;
  const requestedFuel = hasFuel ? command.requestedFuelFlowKgPerS : 0;
  const commandedFuelFlowKgPerS = clamp(requestedFuel, 0, spec.fuel.maxFlowKgPerS);
  const deliveredFuelFlowKgPerS = commandedFuelFlowKgPerS * batteryAuthority * bubbleLoss;
  const pumpPressureTargetBar = hasFuel ? command.requestedPumpPressureBar * batteryAuthority : 0;
  const pumpPressureBar = approachExp(
    state.pumpPressureBar,
    pumpPressureTargetBar,
    dtS,
    spec.fuel.pumpLagS
  );
  const fuelRemainingKg = Math.max(0, state.fuelRemainingKg - deliveredFuelFlowKgPerS * dtS);

  return {
    fuelFlowKgPerS: fuelRemainingKg > 0 ? deliveredFuelFlowKgPerS : 0,
    commandedFuelFlowKgPerS,
    pumpPressureBar,
    fuelRemainingKg
  };
}

export function computeElectricalSystem(
  state             ,
  command            ,
  spec            ,
  dtS        
)         {
  const pumpLoad = command.requestedPumpPressureBar / spec.fuel.maxPumpPressureBar;
  const starterLoad = command.starterOn || command.coolingStarterOn ? 1 : 0;
  const currentA = pumpLoad * spec.electrical.pumpCurrentA + starterLoad * spec.electrical.starterCurrentA;
  const sagV = currentA * spec.electrical.batteryInternalResistanceOhm;
  const drainV = spec.electrical.drainPerSecondV * dtS * (1 + currentA / 20);
  const loadTargetV = spec.electrical.nominalBatteryV - sagV;
  const terminalVoltageV = approachExp(state.batteryVoltageV, loadTargetV, dtS, 0.18);

  return clamp(terminalVoltageV - drainV, 0, spec.electrical.nominalBatteryV);
}
