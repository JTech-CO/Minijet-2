import test from "node:test";
import assert from "node:assert/strict";
import {
  EngineMode,
  FaultCode,
  StartBlockReason,
  createInitialEngineState,
  microTurbineSpec,
  runScenario,
  standardInputs,
  stepEngine,
  toTelemetry
} from "../src/engine/index.ts";
import type { EngineInputs, EngineState } from "../src/engine/index.ts";

const spec = microTurbineSpec;

function simulate(state: EngineState, inputs: EngineInputs, seconds: number, dtS = 0.02): EngineState {
  return runScenario(state, spec, [{ durationS: seconds, inputs }], dtS);
}

function runNormalStart(): EngineState {
  let state = createInitialEngineState(spec);
  state = simulate(state, standardInputs({ master: true, trimRun: true, throttle: 1 }), 0.45);
  state = simulate(state, standardInputs({ master: true, trimRun: true, throttle: 0 }), 18);
  return state;
}

test("engine remains off without master power", () => {
  const state = simulate(
    createInitialEngineState(spec),
    standardInputs({ master: false, trimRun: true, throttle: 1 }),
    5
  );

  assert.equal(state.mode, EngineMode.Off);
  assert.equal(state.fuelFlowKgPerS, 0);
  assert.ok(state.spoolRpm < 1);
});

test("starter spins the spool during the START phase", () => {
  let state = createInitialEngineState(spec);
  state = simulate(state, standardInputs({ master: true, trimRun: true, throttle: 1 }), 0.45);
  state = simulate(state, standardInputs({ master: true, trimRun: true, throttle: 0 }), 1.8);

  assert.equal(state.mode, EngineMode.Start);
  assert.ok(state.spoolRpm > 1000);
});

test("ignition requires sufficient spool rpm and delivered fuel", () => {
  const coldStart = {
    ...createInitialEngineState(spec),
    mode: EngineMode.Ignition,
    spoolRpm: 5000,
    combustorTempC: 220
  };
  const coldStep = stepEngine(
    coldStart,
    standardInputs({ master: true, trimRun: true, throttle: 0 }),
    spec,
    0.02
  );

  assert.equal(coldStep.isCombustionLit, false);

  let ready = {
    ...createInitialEngineState(spec),
    mode: EngineMode.Ignition,
    spoolRpm: spec.spool.ignitionRpm + 2500,
    combustorTempC: spec.combustor.lightOffTempC + 35
  };
  ready = simulate(ready, standardInputs({ master: true, trimRun: true, throttle: 0 }), 0.8);

  assert.equal(ready.isCombustionLit, true);
});

test("normal start reaches a stable idle run", () => {
  const state = runNormalStart();

  assert.equal(state.mode, EngineMode.Run);
  assert.ok(state.spoolRpm > spec.spool.idleRpm * 0.86);
  assert.ok(state.spoolRpm < spec.spool.idleRpm * 1.18);
  assert.ok(state.egtC > 350);
  assert.ok(state.egtC < spec.combustor.maxContinuousEgtC);
});

test("throttle increase produces spool and EGT lag", () => {
  const idle = runNormalStart();
  const firstResponse = simulate(idle, standardInputs({ master: true, trimRun: true, throttle: 1 }), 0.35);
  const laterResponse = simulate(firstResponse, standardInputs({ master: true, trimRun: true, throttle: 1 }), 4);

  assert.ok(firstResponse.spoolRpm > idle.spoolRpm);
  assert.ok(firstResponse.spoolRpm < spec.spool.maxRpm * 0.65);
  assert.ok(laterResponse.spoolRpm > firstResponse.spoolRpm);
  assert.ok(firstResponse.egtC - idle.egtC < 160);
});

test("fuel starvation and low battery enter protective states", () => {
  const running = {
    ...runNormalStart(),
    fuelRemainingKg: 0.000001
  };
  const starved = simulate(running, standardInputs({ master: true, trimRun: true, throttle: 0.2 }), 0.4);

  assert.equal(starved.mode, EngineMode.Cool);
  assert.ok(starved.faults.includes(FaultCode.FuelStarvation));

  const lowBattery = {
    ...createInitialEngineState(spec),
    batteryVoltageV: 6.05
  };
  const locked = stepEngine(lowBattery, standardInputs({ master: true, trimRun: true }), spec, 0.02);

  assert.equal(locked.mode, EngineMode.Lockout);
  assert.ok(locked.faults.includes(FaultCode.LowBattery));
});

test("hot engine blocks the start gate with an ECU reason", () => {
  const hotReady = {
    ...createInitialEngineState(spec),
    mode: EngineMode.Ready,
    startGateArmed: true,
    egtC: spec.ecu.maxStartEgtC + 80,
    metalTempC: spec.ecu.maxStartEgtC + 80
  };
  const blocked = stepEngine(
    hotReady,
    standardInputs({ master: true, trimRun: true, throttle: 0 }),
    spec,
    0.02
  );

  assert.equal(blocked.mode, EngineMode.Ready);
  assert.equal(blocked.ecu.startPermissive, false);
  assert.equal(blocked.ecu.startBlockReason, StartBlockReason.EngineHot);
});

test("glow phase primes pump pressure without wetting the combustor", () => {
  let state = createInitialEngineState(spec);
  state = simulate(state, standardInputs({ master: true, trimRun: true, throttle: 1 }), 0.45);
  state = simulate(state, standardInputs({ master: true, trimRun: true, throttle: 0 }), 0.5);

  assert.equal(state.mode, EngineMode.Glow);
  assert.equal(state.ecu.glowPlugDuty, 1);
  assert.ok(state.ecu.pumpDuty > 0);
  assert.ok(state.pumpPressureBar > 0);
  assert.equal(state.fuelFlowKgPerS, 0);
  assert.equal(state.wetFuelKg, 0);
});

test("ramp waits for idle stabilization before entering RUN", () => {
  const ramp = {
    ...createInitialEngineState(spec),
    mode: EngineMode.Ramp,
    spoolRpm: spec.spool.idleRpm * 0.96,
    spoolOmegaRadS: 0,
    combustorTempC: 620,
    turbineInletTempC: 640,
    egtC: 430,
    metalTempC: 240,
    isCombustionLit: true,
    idleStableS: 0
  };

  const firstStep = stepEngine(
    ramp,
    standardInputs({ master: true, trimRun: true, throttle: 0 }),
    spec,
    0.02
  );
  assert.equal(firstStep.mode, EngineMode.Ramp);
  assert.ok(firstStep.idleStableS > 0);

  const stable = simulate(
    ramp,
    standardInputs({ master: true, trimRun: true, throttle: 0 }),
    spec.ecu.idleStableDurationS + 0.4
  );
  assert.equal(stable.mode, EngineMode.Run);
  assert.equal(stable.ecu.idleStable, true);
});
test("full throttle increases pressure ratio, mass flow, thrust, and surge margin", () => {
  const idle = runNormalStart();
  const idleTelemetry = toTelemetry(idle, spec);
  const full = simulate(idle, standardInputs({ master: true, trimRun: true, throttle: 1 }), 8);
  const fullTelemetry = toTelemetry(full, spec);

  assert.equal(full.mode, EngineMode.Run);
  assert.ok(full.spoolRpm > idle.spoolRpm * 2.5);
  assert.ok(full.spoolRpm < spec.spool.maxRpm * 0.96);
  assert.ok(full.massFlowKgPerS > idle.massFlowKgPerS * 4);
  assert.ok(full.compressorPressureRatio > idle.compressorPressureRatio * 1.9);
  assert.ok(full.thrustN > idle.thrustN * 8);
  assert.ok(fullTelemetry.performance.surgeMargin > idleTelemetry.performance.surgeMargin);
  assert.ok(fullTelemetry.performance.nozzlePressureRatio > idleTelemetry.performance.nozzlePressureRatio);
  assert.ok(full.fuelAirRatio > spec.combustor.leanBlowoutFar);
  assert.ok(full.fuelAirRatio < spec.combustor.richBlowoutFar);
});

test("airflow fuel limiting keeps high altitude full throttle inside combustion limits", () => {
  const ambient = { temperatureC: 15, altitudeM: 1800 };
  let state = createInitialEngineState(spec, ambient.temperatureC);
  state = runScenario(
    state,
    spec,
    [
      { durationS: 0.45, inputs: standardInputs({ master: true, trimRun: true, throttle: 1, ambient }) },
      { durationS: 18, inputs: standardInputs({ master: true, trimRun: true, throttle: 0, ambient }) },
      { durationS: 8, inputs: standardInputs({ master: true, trimRun: true, throttle: 1, ambient }) }
    ],
    0.02
  );
  const telemetry = toTelemetry(state, spec);

  assert.equal(state.mode, EngineMode.Run);
  assert.equal(state.faults.includes(FaultCode.Flameout), false);
  assert.ok(state.fuelAirRatio < spec.combustor.richBlowoutFar);
  assert.ok(state.fuelAirRatio > spec.combustor.leanBlowoutFar);
  assert.ok(telemetry.performance.surgeMargin > 0.2);
  assert.ok(telemetry.performance.correctedSpeedNorm > 0.75);
});

test("performance telemetry exposes fuel-air-spool balance", () => {
  const full = simulate(runNormalStart(), standardInputs({ master: true, trimRun: true, throttle: 1 }), 8);
  const telemetry = toTelemetry(full, spec);

  assert.ok(telemetry.performance.turbineTorqueNm > 0);
  assert.ok(telemetry.performance.frictionTorqueNm > 0);
  assert.ok(telemetry.performance.compressorEfficiency > 0.6);
  assert.ok(Math.abs(telemetry.performance.netSpoolTorqueNm) < 0.01);
  assert.ok(telemetry.performance.pressureThrustN > 0);
});