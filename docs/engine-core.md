# Engine Core Scaffold

This document describes the first minijet-2 engine core slice.

## Scope

The core is intentionally independent from DOM, Canvas, audio, and UI code. It can run in tests, a future Vite app, or any fixed-step simulation loop.

Implemented:

- `EngineSpec`, `EngineInputs`, `AmbientState`, `EngineState`, and `EngineTelemetry`
- ISA-style atmosphere approximation
- Compressor corrected speed, corrected mass flow, pressure ratio, load torque, efficiency, and surge margin
- Fuel pump lag, delivered fuel flow, battery sag, and fuel depletion
- Combustion light-off, fuel-air ratio, wet fuel accumulation, turbine inlet temperature
- Turbine torque from gas power, starter torque, friction, windage, and spool inertia
- EGT/metal/sensor lag
- Nozzle pressure ratio, exhaust velocity, pressure thrust, and total thrust estimate
- ECU start sequence: off, ready, glow, start, ignition, ramp, run, cool, lockout
- ECU start permissive diagnostics and start block reasons
- Glow-stage pump priming without combustor wetting
- Light-off readiness and idle stabilization tracking
- ECU acceleration fuel limiting so throttle is a request, not direct fuel dumping
- Protections for low battery, fuel starvation, hot start, over-temp, overspeed, flameout, and wet start
- Airflow-limited full-power fuel scheduling to avoid rich blowout at altitude
- Performance trace telemetry for fuel-air-spool balance
- Scenario runner for deterministic tests

## Entry Points

Engine core:

- `src/engine/index.ts`
- `createInitialEngineState(spec)`
- `stepEngine(state, inputs, spec, dtS)`
- `toTelemetry(state, spec)`
- `runScenario(initialState, spec, steps, dtS)`
- `microTurbineSpec`

Instrumentation, visualization, audio, and scenarios:

- `src/instruments/index.ts`
- `src/state/telemetry.ts`
- `src/render/engineCutaway/index.ts`
- `src/audio/index.ts`
- `src/engine/faults/index.ts`
- `src/engine/scenarios/presets.ts`
- `src/qa/index.ts`

## Test Coverage

Run:

```bash
npm.cmd test
```

The current tests prove:

- no master power keeps the engine off
- starter torque spins the spool during START
- ignition requires enough spool RPM and fuel
- normal start reaches idle RUN
- throttle changes create spool and EGT lag
- fuel starvation and low battery enter protective states
- hot engines block start with an ECU reason
- glow priming builds pump pressure without fuel wetting
- ramp waits for idle stabilization before entering RUN
- full throttle increases pressure ratio, mass flow, thrust, and surge margin
- high-altitude full throttle stays inside combustion limits through airflow fuel limiting
- performance telemetry exposes fuel-air-spool balance
- instrument snapshots produce GSU-ready rows from sensor telemetry
- graph buffers retain bounded rolling telemetry history
- cutaway visualization state responds to idle vs full-power telemetry
- audio layer states scale with load and faults
- recovery guidance maps faults/start blocks to operator actions
- scenario presets cover nominal, environmental, and failure cases
- calibration suite gates scenario envelopes and expected faults

## Model Notes

This is a calibrated lumped-parameter model, not CFD or a full Brayton-cycle solver.

Important simplifications:

- Compressor and turbine maps are compact equations rather than lookup tables.
- Combustion temperature uses a calibrated `temperatureGain` so telemetry lands in plausible RC turbine ranges.
- ECU fuel scheduling prevents rich blowout during rapid throttle increases.
- Sensor values are lagged separately from physical state so UI can show believable instrument delay.

Performance telemetry currently exposes:

- corrected speed and corrected mass flow
- compressor efficiency and surge margin
- turbine, starter, friction, and net spool torque
- spool acceleration
- nozzle pressure ratio and pressure thrust

Useful next diagnostic additions:

- fuel schedule limit reason
- combustion stability margin
- over-temp and flameout margins

