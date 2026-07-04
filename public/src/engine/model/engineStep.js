import { buildEcuStatus, createIdleEcuStatus } from "../ecu/diagnostics.js";
import { applyProtections } from "../ecu/protections.js";
import { scheduleEcuCommand } from "../ecu/schedules.js";
import { updateStartSequence } from "../ecu/startSequence.js";
import { computeAtmosphere } from "./atmosphere.js";
import { updateCombustor } from "./combustor.js";
import { computeCompressor } from "./compressor.js";
import { computeElectricalSystem, updateFuelSystem } from "./fuelSystem.js";
import { computeNozzle } from "./nozzle.js";
import { updateSensors } from "./sensors.js";
import { updateSpool } from "./spool.js";
import { updateThermalState } from "./thermal.js";
import { computeTurbineTorque } from "./turbine.js";
                                                                                                                 
import { EngineMode } from "./types.js";
import { clamp, rpmToRadPerSec } from "./units.js";

function createZeroPerformanceTrace()                         {
  return {
    correctedSpeedNorm: 0,
    correctedMassFlowNorm: 0,
    compressorEfficiency: 0,
    surgeMargin: 0,
    turbineTorqueNm: 0,
    starterTorqueNm: 0,
    frictionTorqueNm: 0,
    netSpoolTorqueNm: 0,
    spoolAccelerationRpmPerS: 0,
    nozzlePressureRatio: 1,
    pressureThrustN: 0
  };
}

export function createInitialEngineState(spec            , ambientTemperatureC = 15)              {
  return {
    mode: EngineMode.Off,
    modeElapsedS: 0,
    startGateArmed: false,
    idleStableS: 0,
    spoolRpm: 0,
    spoolOmegaRadS: 0,
    combustorTempC: ambientTemperatureC,
    turbineInletTempC: ambientTemperatureC,
    egtC: ambientTemperatureC,
    metalTempC: ambientTemperatureC,
    massFlowKgPerS: 0,
    compressorPressureRatio: 1,
    compressorTorqueNm: 0,
    fuelFlowKgPerS: 0,
    commandedFuelFlowKgPerS: 0,
    fuelAirRatio: 0,
    pumpPressureBar: 0,
    batteryVoltageV: spec.electrical.nominalBatteryV,
    fuelRemainingKg: spec.fuel.capacityKg,
    thrustN: 0,
    exhaustVelocityMps: 0,
    wetFuelKg: 0,
    isCombustionLit: false,
    faults: [],
    ecu: createIdleEcuStatus(),
    performance: createZeroPerformanceTrace(),
    sensors: {
      rpm: 0,
      egtC: ambientTemperatureC,
      pumpPressureBar: 0,
      batteryVoltageV: spec.electrical.nominalBatteryV,
      thrustN: 0
    }
  };
}

export function stepEngine(
  previous             ,
  inputs              ,
  spec            ,
  dtS        
)              {
  const safeDtS = clamp(dtS, 0.001, 0.1);
  const ambient = computeAtmosphere(inputs.ambient);
  const sequence = updateStartSequence(previous, inputs, spec, safeDtS);
  let next              = {
    ...previous,
    mode: sequence.mode,
    modeElapsedS: sequence.modeElapsedS,
    startGateArmed: sequence.startGateArmed,
    faults: [...previous.faults, ...sequence.addedFaults],
    sensors: { ...previous.sensors }
  };

  next = applyProtections(next, inputs, spec);

  const command = scheduleEcuCommand(next, inputs, spec);
  const electrical = computeElectricalSystem(next, command, spec, safeDtS);
  next.batteryVoltageV = electrical;

  const compressor = computeCompressor(
    next.spoolRpm,
    ambient,
    spec,
    inputs.inletDistortion ?? 0
  );
  next.massFlowKgPerS = compressor.massFlowKgPerS;
  next.compressorPressureRatio = compressor.pressureRatio;
  next.compressorTorqueNm = compressor.torqueNm;
  next.performance = {
    ...next.performance,
    correctedSpeedNorm: compressor.correctedSpeedNorm,
    correctedMassFlowNorm: compressor.correctedMassFlowNorm,
    compressorEfficiency: compressor.efficiency,
    surgeMargin: compressor.surgeMargin
  };

  const fuel = updateFuelSystem(next, inputs, command, spec, safeDtS);
  next = { ...next, ...fuel };

  const combustion = updateCombustor(next, ambient, command, spec, safeDtS);
  next.isCombustionLit = combustion.isLit;
  next.fuelAirRatio = combustion.fuelAirRatio;
  next.wetFuelKg = combustion.wetFuelKg;

  const thermal = updateThermalState(next, ambient, combustion, command, spec, safeDtS);
  next = { ...next, ...thermal };

  const turbine = computeTurbineTorque(next, spec);
  const spool = updateSpool(next, command, turbine.torqueNm, spec, safeDtS);
  next.spoolOmegaRadS = spool.spoolOmegaRadS;
  next.spoolRpm = spool.spoolRpm;

  const nozzle = computeNozzle(next, ambient, spec);
  next.thrustN = nozzle.thrustN;
  next.exhaustVelocityMps = nozzle.exhaustVelocityMps;
  next.performance = {
    ...next.performance,
    turbineTorqueNm: turbine.torqueNm,
    starterTorqueNm: spool.starterTorqueNm,
    frictionTorqueNm: spool.frictionTorqueNm,
    netSpoolTorqueNm: spool.netSpoolTorqueNm,
    spoolAccelerationRpmPerS: spool.spoolAccelerationRpmPerS,
    nozzlePressureRatio: nozzle.nozzlePressureRatio,
    pressureThrustN: nozzle.pressureThrustN
  };

  const idleStableNow =
    (next.mode === EngineMode.Ramp || next.mode === EngineMode.Run) &&
    next.isCombustionLit &&
    next.spoolRpm >= spec.spool.idleRpm * 0.92 &&
    next.spoolRpm <= spec.spool.idleRpm * 1.18 &&
    next.egtC > 180 &&
    next.egtC < spec.combustor.maxContinuousEgtC;
  next.idleStableS = idleStableNow ? previous.idleStableS + safeDtS : 0;

  if (!next.isCombustionLit && next.mode !== EngineMode.Glow) {
    next.turbineInletTempC = Math.max(ambient.temperatureC, next.turbineInletTempC);
  }

  next.sensors = updateSensors(next, spec, safeDtS);
  next = applyProtections(next, inputs, spec);

  if (next.mode === EngineMode.Off) {
    next.spoolOmegaRadS = rpmToRadPerSec(next.spoolRpm);
    next.isCombustionLit = false;
    next.commandedFuelFlowKgPerS = 0;
    next.fuelFlowKgPerS = 0;
    next.idleStableS = 0;
  }

  const statusCommand = scheduleEcuCommand(next, inputs, spec);
  next.ecu = buildEcuStatus(next, inputs, spec, statusCommand);

  return next;
}

export function toTelemetry(state             , spec            )                  {
  return {
    mode: state.mode,
    faults: [...state.faults],
    rpm: state.sensors.rpm,
    rpmNorm: clamp(state.sensors.rpm / spec.spool.maxRpm, 0, 1.2),
    egtC: state.sensors.egtC,
    metalTempC: state.metalTempC,
    turbineInletTempC: state.turbineInletTempC,
    fuelFlowGPerMin: state.fuelFlowKgPerS * 60000,
    fuelAirRatio: state.fuelAirRatio,
    massFlowKgPerS: state.massFlowKgPerS,
    compressorPressureRatio: state.compressorPressureRatio,
    pumpPressureBar: state.sensors.pumpPressureBar,
    batteryVoltageV: state.sensors.batteryVoltageV,
    fuelRemainingPct: clamp(state.fuelRemainingKg / spec.fuel.capacityKg, 0, 1) * 100,
    thrustN: state.sensors.thrustN,
    exhaustVelocityMps: state.exhaustVelocityMps,
    isCombustionLit: state.isCombustionLit,
    ecu: { ...state.ecu },
    performance: { ...state.performance }
  };
}
