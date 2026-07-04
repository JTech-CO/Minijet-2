import type { EngineSpec, EngineTelemetry } from "../engine/index.ts";
import { EngineMode, FaultCode, StartBlockReason } from "../engine/index.ts";
import { clamp } from "../engine/model/units.ts";
import {
  InstrumentChannelId,
  InstrumentStatus,
  type Annunciator,
  type GraphSample,
  type GsuRow,
  type InstrumentSnapshot,
  type InstrumentStatus as InstrumentStatusType,
  type InstrumentValue
} from "./types.ts";

function fixed(value: number, digits: number): string {
  return value.toFixed(digits);
}

function formatInteger(value: number): string {
  return Math.round(value).toLocaleString("en-US");
}

function modeLabel(mode: EngineTelemetry["mode"]): string {
  switch (mode) {
    case EngineMode.Off:
      return "OFF";
    case EngineMode.Ready:
      return "READY";
    case EngineMode.Glow:
      return "GLOW";
    case EngineMode.Start:
      return "START";
    case EngineMode.Ignition:
      return "IGNITION";
    case EngineMode.Ramp:
      return "RAMP";
    case EngineMode.Run:
      return "RUN";
    case EngineMode.Cool:
      return "COOL";
    case EngineMode.Lockout:
      return "LOCKOUT";
  }
}

function statusText(telemetry: EngineTelemetry): string {
  if (telemetry.faults.length > 0) return telemetry.faults[telemetry.faults.length - 1].toUpperCase();
  if (telemetry.mode === EngineMode.Ready && !telemetry.ecu.startPermissive) {
    return telemetry.ecu.startBlockReason.toUpperCase();
  }
  if (telemetry.mode === EngineMode.Ignition && telemetry.ecu.lightOffReady) return "LIGHT-OFF READY";
  if (telemetry.mode === EngineMode.Run && telemetry.ecu.idleStable) return "RUN STABLE";
  return modeLabel(telemetry.mode);
}

function value(
  id: InstrumentChannelId,
  label: string,
  rawValue: number,
  unit: string,
  normalized: number,
  formatted: string,
  status: InstrumentStatusType = InstrumentStatus.Nominal
): InstrumentValue {
  return {
    id,
    label,
    value: rawValue,
    unit,
    normalized: clamp(normalized, 0, 1),
    formatted,
    status
  };
}

function egtStatus(telemetry: EngineTelemetry, spec: EngineSpec): InstrumentStatusType {
  if (telemetry.egtC >= spec.combustor.maxContinuousEgtC) return InstrumentStatus.Danger;
  if (telemetry.egtC >= spec.combustor.maxContinuousEgtC * 0.9) return InstrumentStatus.Caution;
  return InstrumentStatus.Nominal;
}

function rpmStatus(telemetry: EngineTelemetry, spec: EngineSpec): InstrumentStatusType {
  if (telemetry.rpm >= spec.spool.overspeedRpm * 0.98) return InstrumentStatus.Danger;
  if (telemetry.rpm >= spec.spool.maxRpm * 0.95) return InstrumentStatus.Caution;
  return InstrumentStatus.Nominal;
}

function batteryStatus(telemetry: EngineTelemetry, spec: EngineSpec): InstrumentStatusType {
  if (telemetry.batteryVoltageV <= spec.electrical.lowBatteryV) return InstrumentStatus.Danger;
  if (telemetry.batteryVoltageV <= spec.electrical.lowBatteryV + 0.35) return InstrumentStatus.Caution;
  return InstrumentStatus.Nominal;
}

function surgeStatus(telemetry: EngineTelemetry): InstrumentStatusType {
  if (telemetry.performance.surgeMargin <= 0) return InstrumentStatus.Danger;
  if (telemetry.performance.surgeMargin <= 0.15) return InstrumentStatus.Caution;
  return InstrumentStatus.Nominal;
}

function buildAnnunciators(telemetry: EngineTelemetry): Annunciator[] {
  const annunciators: Annunciator[] = telemetry.faults.map((fault) => ({
    id: `fault:${fault}`,
    label: fault.toUpperCase(),
    status: InstrumentStatus.Danger
  }));

  if (telemetry.mode === EngineMode.Ready && telemetry.ecu.startBlockReason !== StartBlockReason.None) {
    annunciators.push({
      id: `start:${telemetry.ecu.startBlockReason}`,
      label: telemetry.ecu.startBlockReason.toUpperCase(),
      status: InstrumentStatus.Caution
    });
  }
  if (telemetry.ecu.lightOffReady) {
    annunciators.push({ id: "light-off-ready", label: "LIGHT-OFF", status: InstrumentStatus.Nominal });
  }
  if (telemetry.performance.surgeMargin <= 0.15 && telemetry.mode === EngineMode.Run) {
    annunciators.push({ id: "surge-margin", label: "SURGE MARGIN", status: surgeStatus(telemetry) });
  }

  return annunciators;
}

export function createGraphSample(telemetry: EngineTelemetry, spec: EngineSpec, timeS: number): GraphSample {
  return {
    timeS,
    values: {
      [InstrumentChannelId.Rpm]: clamp(telemetry.rpm / spec.spool.maxRpm, 0, 1.2),
      [InstrumentChannelId.Egt]: clamp(telemetry.egtC / spec.combustor.hotStartTempC, 0, 1.2),
      [InstrumentChannelId.FuelFlow]: clamp(telemetry.fuelFlowGPerMin / (spec.fuel.maxFlowKgPerS * 60000), 0, 1.2),
      [InstrumentChannelId.PumpPressure]: clamp(telemetry.pumpPressureBar / spec.fuel.maxPumpPressureBar, 0, 1.2),
      [InstrumentChannelId.Thrust]: clamp(telemetry.thrustN / 25, 0, 1.2),
      [InstrumentChannelId.Battery]: clamp((telemetry.batteryVoltageV - spec.electrical.lowBatteryV) / (spec.electrical.nominalBatteryV - spec.electrical.lowBatteryV), 0, 1.2),
      [InstrumentChannelId.PressureRatio]: clamp((telemetry.compressorPressureRatio - 1) / (spec.compressor.pressureRatioAtMax - 1), 0, 1.2),
      [InstrumentChannelId.MassFlow]: clamp(telemetry.massFlowKgPerS / spec.compressor.referenceMassFlowKgPerS, 0, 1.2),
      [InstrumentChannelId.SurgeMargin]: clamp((telemetry.performance.surgeMargin + 0.2) / 1.2, 0, 1.2)
    }
  };
}

export function createInstrumentSnapshot(
  telemetry: EngineTelemetry,
  spec: EngineSpec,
  timeS: number
): InstrumentSnapshot {
  const values: InstrumentSnapshot["values"] = {
    [InstrumentChannelId.Rpm]: value(
      InstrumentChannelId.Rpm,
      "RPM",
      telemetry.rpm,
      "rpm",
      telemetry.rpm / spec.spool.maxRpm,
      formatInteger(telemetry.rpm),
      rpmStatus(telemetry, spec)
    ),
    [InstrumentChannelId.Egt]: value(
      InstrumentChannelId.Egt,
      "EGT",
      telemetry.egtC,
      "C",
      telemetry.egtC / spec.combustor.hotStartTempC,
      `${formatInteger(telemetry.egtC)} C`,
      egtStatus(telemetry, spec)
    ),
    [InstrumentChannelId.FuelFlow]: value(
      InstrumentChannelId.FuelFlow,
      "FUEL",
      telemetry.fuelFlowGPerMin,
      "g/min",
      telemetry.fuelFlowGPerMin / (spec.fuel.maxFlowKgPerS * 60000),
      `${fixed(telemetry.fuelFlowGPerMin, 1)} g/min`
    ),
    [InstrumentChannelId.PumpPressure]: value(
      InstrumentChannelId.PumpPressure,
      "PUMP",
      telemetry.pumpPressureBar,
      "bar",
      telemetry.pumpPressureBar / spec.fuel.maxPumpPressureBar,
      `${fixed(telemetry.pumpPressureBar, 2)} bar`
    ),
    [InstrumentChannelId.Thrust]: value(
      InstrumentChannelId.Thrust,
      "THRUST",
      telemetry.thrustN,
      "N",
      telemetry.thrustN / 25,
      `${fixed(telemetry.thrustN, 1)} N`
    ),
    [InstrumentChannelId.Battery]: value(
      InstrumentChannelId.Battery,
      "BAT",
      telemetry.batteryVoltageV,
      "V",
      (telemetry.batteryVoltageV - spec.electrical.lowBatteryV) / (spec.electrical.nominalBatteryV - spec.electrical.lowBatteryV),
      `${fixed(telemetry.batteryVoltageV, 2)} V`,
      batteryStatus(telemetry, spec)
    ),
    [InstrumentChannelId.PressureRatio]: value(
      InstrumentChannelId.PressureRatio,
      "PR",
      telemetry.compressorPressureRatio,
      ":1",
      (telemetry.compressorPressureRatio - 1) / (spec.compressor.pressureRatioAtMax - 1),
      `${fixed(telemetry.compressorPressureRatio, 2)}:1`
    ),
    [InstrumentChannelId.MassFlow]: value(
      InstrumentChannelId.MassFlow,
      "AIR",
      telemetry.massFlowKgPerS,
      "kg/s",
      telemetry.massFlowKgPerS / spec.compressor.referenceMassFlowKgPerS,
      `${fixed(telemetry.massFlowKgPerS, 3)} kg/s`
    ),
    [InstrumentChannelId.SurgeMargin]: value(
      InstrumentChannelId.SurgeMargin,
      "SURGE",
      telemetry.performance.surgeMargin,
      "margin",
      (telemetry.performance.surgeMargin + 0.2) / 1.2,
      fixed(telemetry.performance.surgeMargin, 2),
      surgeStatus(telemetry)
    )
  };

  const gsuRows: GsuRow[] = [
    { label: "RPM", value: values.rpm.formatted, status: values.rpm.status },
    { label: "EGT", value: values.egt.formatted, status: values.egt.status },
    { label: "PUMP", value: values.pumpPressure.formatted, status: values.pumpPressure.status },
    { label: "BAT", value: values.battery.formatted, status: values.battery.status },
    { label: "THRUST", value: values.thrust.formatted, status: values.thrust.status }
  ];

  const annunciators = buildAnnunciators(telemetry);

  return {
    timeS,
    mode: telemetry.mode,
    modeLabel: modeLabel(telemetry.mode),
    statusText: statusText(telemetry),
    masterCaution: annunciators.some((annunciator) => annunciator.status !== InstrumentStatus.Nominal),
    faults: [...telemetry.faults],
    startBlockReason: telemetry.ecu.startBlockReason,
    values,
    gsuRows,
    graphSample: createGraphSample(telemetry, spec, timeS),
    annunciators
  };
}