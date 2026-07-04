import type { EngineSpec, EngineTelemetry } from "../../engine/index.ts";
import { clamp } from "../../engine/model/units.ts";
import type { CutawayZoneState, EngineCutawayState, FlameVisualState } from "./types.ts";

function heatColor(tempNorm: number): string {
  if (tempNorm > 0.82) return "white-blue";
  if (tempNorm > 0.62) return "yellow-white";
  if (tempNorm > 0.36) return "orange";
  if (tempNorm > 0.15) return "dull-red";
  return "cold-metal";
}

function flameState(telemetry: EngineTelemetry, spec: EngineSpec): FlameVisualState {
  const fuelNorm = clamp(telemetry.fuelFlowGPerMin / (spec.fuel.maxFlowKgPerS * 60000), 0, 1);
  const tempNorm = clamp((telemetry.turbineInletTempC - 120) / 900, 0, 1);
  const flowNorm = clamp(telemetry.massFlowKgPerS / spec.compressor.referenceMassFlowKgPerS, 0, 1.2);
  const lit = telemetry.isCombustionLit && telemetry.fuelFlowGPerMin > 0;

  return {
    lit,
    lengthNorm: lit ? clamp(0.22 + fuelNorm * 0.55 + flowNorm * 0.18, 0, 1) : 0,
    intensityNorm: lit ? clamp(tempNorm * 0.72 + fuelNorm * 0.28, 0, 1) : 0,
    temperatureNorm: tempNorm,
    color: lit ? heatColor(tempNorm) : "none"
  };
}

export function createEngineCutawayState(
  telemetry: EngineTelemetry,
  spec: EngineSpec
): EngineCutawayState {
  const rpmNorm = clamp(telemetry.rpm / spec.spool.maxRpm, 0, 1.2);
  const massFlowNorm = clamp(telemetry.massFlowKgPerS / spec.compressor.referenceMassFlowKgPerS, 0, 1.2);
  const pressureRatioNorm = clamp(
    (telemetry.compressorPressureRatio - 1) / (spec.compressor.pressureRatioAtMax - 1),
    0,
    1.2
  );
  const egtNorm = clamp(telemetry.egtC / spec.combustor.hotStartTempC, 0, 1.2);
  const titNorm = clamp(telemetry.turbineInletTempC / 1000, 0, 1.2);
  const thrustNorm = clamp(telemetry.thrustN / 25, 0, 1.2);
  const surgeMarginNorm = clamp((telemetry.performance.surgeMargin + 0.2) / 1.2, 0, 1.2);
  const flame = flameState(telemetry, spec);

  const zones: CutawayZoneState[] = [
    {
      id: "inlet",
      label: "INLET",
      pressureNorm: 0,
      temperatureNorm: 0,
      flowNorm: massFlowNorm,
      activityNorm: massFlowNorm
    },
    {
      id: "compressor",
      label: "COMPRESSOR",
      pressureNorm: pressureRatioNorm,
      temperatureNorm: clamp(pressureRatioNorm * 0.35, 0, 1),
      flowNorm: massFlowNorm,
      activityNorm: rpmNorm
    },
    {
      id: "combustor",
      label: "COMBUSTOR",
      pressureNorm: pressureRatioNorm * 0.82,
      temperatureNorm: flame.temperatureNorm,
      flowNorm: massFlowNorm,
      activityNorm: flame.intensityNorm
    },
    {
      id: "turbine",
      label: "TURBINE",
      pressureNorm: pressureRatioNorm * 0.52,
      temperatureNorm: titNorm,
      flowNorm: massFlowNorm,
      activityNorm: rpmNorm
    },
    {
      id: "nozzle",
      label: "NOZZLE",
      pressureNorm: clamp((telemetry.performance.nozzlePressureRatio - 1) / (spec.compressor.pressureRatioAtMax - 1), 0, 1.2),
      temperatureNorm: egtNorm,
      flowNorm: clamp(telemetry.exhaustVelocityMps / 700, 0, 1.2),
      activityNorm: thrustNorm
    }
  ];

  return {
    mode: telemetry.mode,
    zones,
    compressorRotor: {
      rpm: telemetry.rpm,
      revolutionsPerSecond: telemetry.rpm / 60,
      blurNorm: clamp(rpmNorm * 1.35, 0, 1),
      direction: 1
    },
    turbineRotor: {
      rpm: telemetry.rpm,
      revolutionsPerSecond: telemetry.rpm / 60,
      blurNorm: clamp(rpmNorm * 1.5, 0, 1),
      direction: -1
    },
    flame,
    exhaust: {
      velocityNorm: clamp(telemetry.exhaustVelocityMps / 700, 0, 1.2),
      densityNorm: massFlowNorm,
      temperatureNorm: egtNorm,
      thrustNorm,
      pressureGlowNorm: clamp(telemetry.performance.pressureThrustN / 2.5, 0, 1.2)
    },
    overlay: {
      massFlowNorm,
      pressureRatioNorm,
      surgeMarginNorm,
      thrustNorm,
      egtNorm
    }
  };
}