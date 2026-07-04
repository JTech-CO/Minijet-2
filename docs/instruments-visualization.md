# Instruments And Visualization Layer

Phase 4 adds UI-facing view models without coupling the engine core to DOM, Canvas, SVG, or audio runtime code.

## Entry Points

- `src/instruments/index.ts`
- `src/state/telemetry.ts`
- `src/render/engineCutaway/index.ts`

## Instrument Snapshot

`createInstrumentSnapshot(telemetry, spec, timeS)` adapts `EngineTelemetry` into stable UI data:

- GSU-ready rows for RPM, EGT, pump pressure, battery, and thrust
- normalized channel values for graphing
- formatted display strings
- nominal/caution/danger status per channel
- annunciators for faults, start block reasons, light-off readiness, and surge margin

The adapter intentionally uses `EngineTelemetry` sensor values instead of raw internal state, so UI readouts inherit the simulated instrument lag.

## Graph Buffer

`createTelemetryGraphBuffer`, `appendGraphSample`, and `getGraphSeries` provide a bounded rolling history for these channels:

- RPM
- EGT
- fuel flow
- pump pressure
- thrust
- battery
- compressor pressure ratio
- air mass flow
- surge margin

This is ready for a GSU graph mode or a richer dashboard graph without requiring graph code to understand engine internals.

## Engine Cutaway State

`createEngineCutawayState(telemetry, spec)` converts telemetry into a renderer-neutral cutaway model:

- inlet, compressor, combustor, turbine, and nozzle zones
- zone pressure, temperature, flow, and activity intensity
- compressor and turbine rotor speed/blur
- combustion flame length, intensity, temperature, and color band
- exhaust velocity, density, temperature, thrust, and pressure glow
- overlay values for mass flow, pressure ratio, surge margin, thrust, and EGT

A future SVG or Canvas renderer should consume this model directly instead of reading raw engine state.

## Test Coverage

Run:

```bash
npm.cmd test
```

Phase 4 tests prove:

- instrument snapshots use sensor telemetry and produce GSU-ready rows
- graph buffers keep bounded rolling history
- cutaway state responds to idle vs full-power telemetry

## Next UI Step

The next implementation can create the actual app shell:

- controller/ECU/GSU DOM components
- cutaway SVG or Canvas renderer using `EngineCutawayState`
- graph renderer using `TelemetryGraphBuffer`
- RAF loop that steps the engine, adapts telemetry, and renders the latest view models