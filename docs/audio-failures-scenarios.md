# Audio, Failures, And Scenarios

Phase 5 adds runtime-neutral polish layers for audio, fault recovery, and scenario selection.

## Audio Model

Entry point:

- `src/audio/index.ts`
- `createEngineAudioState(telemetry, spec)`

The audio model does not create WebAudio or Tone.js nodes. It maps `EngineTelemetry` into layer parameters that a later audio runtime can consume:

- starter
- compressor whine
- combustion roar
- exhaust rush
- pump
- instability
- cooling ticks
- warning

Each layer exposes gain, frequency, filter, detune, noise mix, and pulse rate. Faults also emit prioritized warning cues.

## Failure Recovery

Entry point:

- `src/engine/faults/index.ts`
- `getFaultRecoveryGuidance(fault)`
- `getStartBlockGuidance(reason)`
- `getActiveRecoveryGuidance(telemetry)`

Guidance currently covers:

- low battery
- fuel starvation
- hot start
- over-temp
- overspeed
- flameout
- wet start
- start block reasons such as throttle gate, hot engine, low fuel, and spool still turning

Each recovery item includes severity, explanation, operator actions, and reset condition.

## Scenario Presets

Entry point:

- `src/engine/scenarios/presets.ts`
- `SCENARIO_PRESETS`
- `getScenarioPreset(id)`
- `runScenarioPreset(preset, spec)`

Current presets:

- normal start
- high altitude
- hot day
- cold start
- low battery
- low fuel runout
- bubble ingestion

These presets are suitable for tests, demo menus, UI scenario buttons, and future documentation examples.

## Test Coverage

Run:

```bash
npm.cmd test
```

Phase 5 tests prove:

- audio layers scale with engine load
- fault audio emits warning cues
- recovery guidance explains faults and start blocks
- scenario presets cover nominal, environmental, and failure cases
- active recovery guidance picks the latest telemetry issue