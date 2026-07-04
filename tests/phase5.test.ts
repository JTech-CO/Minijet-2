import test from "node:test";
import assert from "node:assert/strict";
import {
  FaultCode,
  RecoverySeverity,
  ScenarioPresetId,
  getActiveRecoveryGuidance,
  getFaultRecoveryGuidance,
  getScenarioPreset,
  getStartBlockGuidance,
  microTurbineSpec,
  runScenarioPreset,
  toTelemetry
} from "../src/engine/index.ts";
import { StartBlockReason } from "../src/engine/index.ts";
import { AudioLayerId, createEngineAudioState } from "../src/audio/index.ts";

const spec = microTurbineSpec;

test("audio model scales whine, roar, and exhaust with engine load", () => {
  const idle = runScenarioPreset(getScenarioPreset(ScenarioPresetId.NormalStart), spec);
  const highPower = runScenarioPreset(getScenarioPreset(ScenarioPresetId.HighAltitude), spec);
  const idleAudio = createEngineAudioState(toTelemetry(idle, spec), spec);
  const highPowerAudio = createEngineAudioState(toTelemetry(highPower, spec), spec);

  assert.ok(highPowerAudio.layers.compressorWhine.gain > idleAudio.layers.compressorWhine.gain);
  assert.ok(highPowerAudio.layers.combustionRoar.gain > idleAudio.layers.combustionRoar.gain);
  assert.ok(highPowerAudio.layers.exhaustRush.gain > idleAudio.layers.exhaustRush.gain);
  assert.ok(highPowerAudio.layers.compressorWhine.frequencyHz > idleAudio.layers.compressorWhine.frequencyHz);
  assert.equal(highPowerAudio.masterGain, 1);
});

test("fault audio exposes warning cues and instability layer", () => {
  const bubble = runScenarioPreset(getScenarioPreset(ScenarioPresetId.BubbleIngestion), spec);
  const audio = createEngineAudioState(toTelemetry(bubble, spec), spec);

  assert.ok(bubble.faults.includes(FaultCode.Flameout));
  assert.ok(audio.layers.warning.gain > 0);
  assert.ok(audio.cues.some((cue) => cue.id === "fault-flameout"));
  assert.deepEqual(audio.activeFaults, bubble.faults);
});

test("recovery guidance explains faults and start blocks", () => {
  const flameout = getFaultRecoveryGuidance(FaultCode.Flameout);
  const hotStart = getFaultRecoveryGuidance(FaultCode.HotStart);
  const throttleGate = getStartBlockGuidance(StartBlockReason.ThrottleHighGateRequired);

  assert.equal(flameout.severity, RecoverySeverity.Caution);
  assert.ok(flameout.actions.some((action) => action.label === "THROTTLE IDLE"));
  assert.equal(hotStart.severity, RecoverySeverity.Critical);
  assert.ok(throttleGate);
  assert.equal(throttleGate?.title, "START GATE");
});

test("scenario presets cover nominal, environmental, and failure cases", () => {
  const normal = runScenarioPreset(getScenarioPreset(ScenarioPresetId.NormalStart), spec);
  const highAltitude = runScenarioPreset(getScenarioPreset(ScenarioPresetId.HighAltitude), spec);
  const lowBattery = runScenarioPreset(getScenarioPreset(ScenarioPresetId.LowBattery), spec);
  const lowFuel = runScenarioPreset(getScenarioPreset(ScenarioPresetId.LowFuel), spec);
  const bubble = runScenarioPreset(getScenarioPreset(ScenarioPresetId.BubbleIngestion), spec);

  assert.equal(normal.faults.length, 0);
  assert.equal(highAltitude.faults.length, 0);
  assert.ok(highAltitude.spoolRpm > normal.spoolRpm);
  assert.ok(lowBattery.faults.includes(FaultCode.LowBattery));
  assert.ok(lowFuel.faults.includes(FaultCode.FuelStarvation));
  assert.ok(bubble.faults.includes(FaultCode.Flameout));
});

test("active recovery guidance selects the latest telemetry issue", () => {
  const lowFuel = runScenarioPreset(getScenarioPreset(ScenarioPresetId.LowFuel), spec);
  const guidance = getActiveRecoveryGuidance(toTelemetry(lowFuel, spec));

  assert.ok(guidance);
  assert.equal(guidance?.code, FaultCode.FuelStarvation);
  assert.equal(guidance?.severity, RecoverySeverity.Critical);
});