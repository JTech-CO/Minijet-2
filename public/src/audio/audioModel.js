                                                                      
import { EngineMode, FaultCode } from "../engine/index.js";
import { clamp } from "../engine/model/units.js";
import { AudioLayerId,                                                            } from "./types.js";

function layer(
  id              ,
  gain        ,
  frequencyHz        ,
  filterHz        ,
  detuneCents = 0,
  noiseMix = 0,
  pulseRateHz = 0
)                  {
  return {
    id,
    gain: clamp(gain, 0, 1),
    frequencyHz,
    filterHz,
    detuneCents,
    noiseMix: clamp(noiseMix, 0, 1),
    pulseRateHz
  };
}

function faultCue(fault           )           {
  switch (fault) {
    case FaultCode.LowBattery:
      return { id: "fault-low-battery", label: "LOW BATTERY", gain: 0.95, priority: 100 };
    case FaultCode.FuelStarvation:
      return { id: "fault-fuel-starvation", label: "FUEL OUT", gain: 0.85, priority: 90 };
    case FaultCode.HotStart:
      return { id: "fault-hot-start", label: "HOT START", gain: 1, priority: 110 };
    case FaultCode.OverTemp:
      return { id: "fault-over-temp", label: "OVER TEMP", gain: 1, priority: 105 };
    case FaultCode.Overspeed:
      return { id: "fault-overspeed", label: "OVERSPEED", gain: 1, priority: 105 };
    case FaultCode.Flameout:
      return { id: "fault-flameout", label: "FLAMEOUT", gain: 0.9, priority: 95 };
    case FaultCode.WetStart:
      return { id: "fault-wet-start", label: "WET START", gain: 0.8, priority: 80 };
  }
}

export function createEngineAudioState(
  telemetry                 ,
  spec            
)                   {
  const rpmNorm = clamp(telemetry.rpm / spec.spool.maxRpm, 0, 1.2);
  const fuelNorm = clamp(telemetry.fuelFlowGPerMin / (spec.fuel.maxFlowKgPerS * 60000), 0, 1.2);
  const thrustNorm = clamp(telemetry.thrustN / 25, 0, 1.2);
  const egtNorm = clamp(telemetry.egtC / spec.combustor.hotStartTempC, 0, 1.2);
  const surgeRisk = clamp((0.18 - telemetry.performance.surgeMargin) / 0.38, 0, 1);
  const mixtureOffset = clamp(Math.abs(telemetry.fuelAirRatio - 0.012) / 0.022, 0, 1);
  const instabilityNorm = telemetry.mode === EngineMode.Run ? clamp(Math.max(surgeRisk, mixtureOffset * 0.5), 0, 1) : 0;
  const starterActive = telemetry.ecu.starterDuty > 0 || telemetry.mode === EngineMode.Start;
  const coolingActive = telemetry.mode === EngineMode.Cool && telemetry.egtC > 90;
  const masterGain = telemetry.mode === EngineMode.Off && telemetry.rpm < 200 ? 0 : 1;

  const layers                                        = {
    [AudioLayerId.Starter]: layer(
      AudioLayerId.Starter,
      starterActive ? 0.45 + telemetry.ecu.starterDuty * 0.35 : coolingActive ? 0.2 : 0,
      90 + rpmNorm * 520,
      900 + rpmNorm * 2200,
      0,
      0.15,
      starterActive ? 18 + rpmNorm * 30 : 0
    ),
    [AudioLayerId.CompressorWhine]: layer(
      AudioLayerId.CompressorWhine,
      rpmNorm > 0.05 ? clamp(0.08 + rpmNorm * 0.82, 0, 1) : 0,
      520 + rpmNorm * 5200,
      1800 + telemetry.compressorPressureRatio * 1450,
      instabilityNorm * 18,
      0.05 + rpmNorm * 0.1
    ),
    [AudioLayerId.CombustionRoar]: layer(
      AudioLayerId.CombustionRoar,
      telemetry.isCombustionLit ? clamp(0.18 + fuelNorm * 0.72 + egtNorm * 0.18, 0, 1) : 0,
      70 + fuelNorm * 180,
      650 + egtNorm * 4200,
      instabilityNorm * 28,
      0.48 + fuelNorm * 0.32
    ),
    [AudioLayerId.ExhaustRush]: layer(
      AudioLayerId.ExhaustRush,
      clamp(thrustNorm * 0.85 + rpmNorm * 0.18, 0, 1),
      110 + telemetry.exhaustVelocityMps * 0.35,
      950 + telemetry.exhaustVelocityMps * 8,
      instabilityNorm * 12,
      0.55 + thrustNorm * 0.35
    ),
    [AudioLayerId.Pump]: layer(
      AudioLayerId.Pump,
      clamp(telemetry.ecu.pumpDuty * 0.6, 0, 1),
      160 + telemetry.pumpPressureBar * 55,
      1200,
      0,
      0.18,
      28 + telemetry.pumpPressureBar * 2
    ),
    [AudioLayerId.Instability]: layer(
      AudioLayerId.Instability,
      instabilityNorm,
      45 + instabilityNorm * 90,
      500 + instabilityNorm * 1700,
      instabilityNorm * 70,
      0.75,
      5 + instabilityNorm * 16
    ),
    [AudioLayerId.CoolingTicks]: layer(
      AudioLayerId.CoolingTicks,
      coolingActive ? clamp((telemetry.egtC - 80) / 420, 0, 1) : 0,
      950 + egtNorm * 1200,
      3200,
      0,
      0.08,
      coolingActive ? 1 + egtNorm * 8 : 0
    ),
    [AudioLayerId.Warning]: layer(
      AudioLayerId.Warning,
      telemetry.faults.length > 0 ? 0.9 : 0,
      880,
      2400,
      0,
      0,
      telemetry.faults.length > 0 ? 2.5 : 0
    )
  };

  const cues = telemetry.faults.map(faultCue).sort((a, b) => b.priority - a.priority);

  return {
    mode: telemetry.mode,
    masterGain,
    layers,
    cues,
    activeFaults: [...telemetry.faults]
  };
}