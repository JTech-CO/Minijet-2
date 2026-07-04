import test from "node:test";
import assert from "node:assert/strict";
import {
  EngineMode,
  createInitialEngineState,
  microTurbineSpec,
  runScenario,
  standardInputs,
  toTelemetry
} from "../src/engine/index.ts";
import {
  InstrumentChannelId,
  InstrumentStatus,
  appendGraphSample,
  createInstrumentSnapshot,
  createTelemetryGraphBuffer,
  getGraphSeries,
  latestGraphSample
} from "../src/instruments/index.ts";
import { createEngineCutawayState } from "../src/render/engineCutaway/index.ts";

const spec = microTurbineSpec;

function runToIdle() {
  return runScenario(
    createInitialEngineState(spec),
    spec,
    [
      { durationS: 0.45, inputs: standardInputs({ master: true, trimRun: true, throttle: 1 }) },
      { durationS: 18, inputs: standardInputs({ master: true, trimRun: true, throttle: 0 }) }
    ],
    0.02
  );
}

function runToFullPower() {
  return runScenario(
    runToIdle(),
    spec,
    [{ durationS: 8, inputs: standardInputs({ master: true, trimRun: true, throttle: 1 }) }],
    0.02
  );
}

test("instrument snapshot uses sensor telemetry and GSU-ready rows", () => {
  const state = runToIdle();
  const telemetry = toTelemetry(state, spec);
  const snapshot = createInstrumentSnapshot(telemetry, spec, 18.45);

  assert.equal(snapshot.mode, EngineMode.Run);
  assert.equal(snapshot.statusText, "RUN STABLE");
  assert.equal(snapshot.values.rpm.value, telemetry.rpm);
  assert.equal(snapshot.values.egt.status, InstrumentStatus.Nominal);
  assert.ok(snapshot.values.rpm.formatted.length > 0);
  assert.ok(snapshot.values.egt.formatted.endsWith(" C"));
  assert.equal(snapshot.gsuRows.length, 5);
  assert.equal(snapshot.graphSample.values.rpm, snapshot.values.rpm.normalized);
});

test("graph buffer keeps a bounded rolling telemetry history", () => {
  let buffer = createTelemetryGraphBuffer(3);
  const idle = toTelemetry(runToIdle(), spec);
  const full = toTelemetry(runToFullPower(), spec);

  buffer = appendGraphSample(buffer, createInstrumentSnapshot(idle, spec, 1).graphSample);
  buffer = appendGraphSample(buffer, createInstrumentSnapshot(full, spec, 2).graphSample);
  buffer = appendGraphSample(buffer, createInstrumentSnapshot(idle, spec, 3).graphSample);
  buffer = appendGraphSample(buffer, createInstrumentSnapshot(full, spec, 4).graphSample);

  assert.equal(buffer.samples.length, 3);
  assert.equal(buffer.samples[0].timeS, 2);
  assert.equal(latestGraphSample(buffer)?.timeS, 4);

  const rpmSeries = getGraphSeries(buffer, InstrumentChannelId.Rpm);
  assert.equal(rpmSeries.length, 3);
  assert.ok(rpmSeries[2].value > rpmSeries[1].value);
});

test("cutaway state maps telemetry into visual zones", () => {
  const idleTelemetry = toTelemetry(runToIdle(), spec);
  const fullTelemetry = toTelemetry(runToFullPower(), spec);
  const idleCutaway = createEngineCutawayState(idleTelemetry, spec);
  const fullCutaway = createEngineCutawayState(fullTelemetry, spec);

  assert.equal(fullCutaway.zones.length, 5);
  assert.ok(fullCutaway.compressorRotor.blurNorm > idleCutaway.compressorRotor.blurNorm);
  assert.ok(fullCutaway.flame.lit);
  assert.ok(fullCutaway.flame.lengthNorm > idleCutaway.flame.lengthNorm);
  assert.ok(fullCutaway.exhaust.thrustNorm > idleCutaway.exhaust.thrustNorm);
  assert.ok(fullCutaway.overlay.pressureRatioNorm > idleCutaway.overlay.pressureRatioNorm);
});