                                                                         
import { approachExp } from "./units.js";

export function updateSensors(state             , spec            , dtS        )                {
  return {
    rpm: approachExp(state.sensors.rpm, state.spoolRpm, dtS, spec.sensors.rpmLagS),
    egtC: approachExp(state.sensors.egtC, state.egtC, dtS, spec.sensors.egtLagS),
    pumpPressureBar: approachExp(
      state.sensors.pumpPressureBar,
      state.pumpPressureBar,
      dtS,
      spec.sensors.pumpLagS
    ),
    batteryVoltageV: approachExp(
      state.sensors.batteryVoltageV,
      state.batteryVoltageV,
      dtS,
      spec.sensors.batteryLagS
    ),
    thrustN: approachExp(state.sensors.thrustN, state.thrustN, dtS, 0.25)
  };
}
