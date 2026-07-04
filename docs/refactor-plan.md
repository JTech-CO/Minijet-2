# minijet-2 Refactor Plan

## 1. Original Audit

Source inspected:

- Repository: https://github.com/JTech-CO/Mini-Jet-Engine-Sim
- Local reference clone: `original/`
- Baseline commit: `8531763`

The original project is a static browser application built with HTML, CSS, ES modules, Tone.js, Tailwind CDN, and Font Awesome CDN. Its strongest parts are the hardware-like interaction model and the compact module split:

- `src/sim/`: state machine, simple dynamics, environment, failures, afterburner
- `src/state/`: global store, actions, selectors
- `src/ui/`: DOM cache, event handlers, readout updates
- `src/render/`: canvas particles, graph, SVG wiring, RAF loop
- `src/audio/`: Tone.js synth layers for starter, whine, roar, valve, cooling tick
- `src/styles/`: skeuomorphic controller, ECU, GSU, battery, fuel tank, panel styling

Current simulation behavior:

- The ECU-like state sequence is `OFF -> READY -> WAIT -> GLOW -> START -> IGN -> RAMP -> RUN -> COOL`, plus `LOCKOUT`.
- The main simulation loop runs every 50 ms through `setInterval`.
- The visual loop runs separately with `requestAnimationFrame`.
- RPM is modeled as a first-order interpolation toward `targetRpm`.
- EGT is modeled as a first-order interpolation toward a target temperature derived from RPM, density, and afterburner state.
- Environment is a scalar density multiplier based on low/high temperature and low/high altitude presets.
- Fuel consumption is a simple decrement when pump/priming is active.
- Battery voltage drains linearly with pump load.
- Failure modes are rule-based and partly random: low battery lockout, flameout, hot start, fuel depletion.
- Visuals combine inline SVG engine geometry, Canvas exhaust particles, animated SVG wiring, and CSS-made physical controls.

## 2. What To Preserve

The original should not be thrown away wholesale. These parts are worth preserving as product identity:

- The RC turbine/ECU ritual: master power, trim, throttle gate, glow, starter, ignition, ramp, cool-down.
- The GSU terminal feel: compact numeric RPM/EGT/pump/battery telemetry and graph mode.
- Skeuomorphic controls: LiPo battery pack, ECU box, fuel tank, throttle controller, LEDs, wiring.
- Audio feedback as a core part of state perception, not decoration.
- Failure-mode education: low battery, flameout, hot start, fuel starvation.
- Separation between sim loop, RAF rendering, audio, UI events, and state.

## 3. Current Limits

The original feels good, but its realism ceiling is low because the engine itself is not modeled as an engine.

- There is only one spool variable, `rpm`; no compressor/turbine work balance.
- Throttle maps directly to target RPM instead of fuel flow, pump pressure, ECU schedule, and spool response.
- EGT follows RPM rather than fuel-air ratio, combustion heat, turbine extraction, and sensor lag.
- Air density is a rough multiplier, not pressure/temperature/altitude from an atmosphere model.
- Fuel, pump, battery, combustion, and thermal behavior are mostly independent rules.
- Afterburner exists as a high-power visual/audio mode, but it is not realistic for a typical RC micro turbine. It should become an optional "experimental/full-size turbojet" mode or be replaced by richer exhaust/nozzle effects.
- Visual exhaust particles are driven by RPM/EGT only; they do not represent mass flow, fuel flow, temperature, or thrust.
- Random events use uncontrolled randomness, which makes testing and tuning harder.
- UI updates read directly from global mutable state, so deeper model changes will spread unless we introduce a cleaner simulation output layer.

## 4. minijet-2 Goal

Build a more realistic real-time miniature jet engine simulator while keeping the original's tactile RC-turbine charm.

The target is not CFD or a professional gas-turbine solver. It should be a deterministic, calibrated, lumped-parameter engine model that behaves plausibly:

- Fuel flow creates heat.
- Heat and airflow create turbine work.
- Turbine work accelerates the spool against compressor load, friction, and inertia.
- Compressor speed changes pressure ratio and mass flow.
- Nozzle flow creates thrust and exhaust velocity.
- Sensors lag behind physical quantities.
- ECU logic prevents or causes believable start, hot start, flameout, overspeed, and cool-down behavior.

## 5. Proposed Architecture

Use TypeScript and a small build/test setup for minijet-2 unless we intentionally keep a no-build static app. The current project is small enough for vanilla JS, but the next model will benefit from explicit units and types.

Recommended stack:

- Vite for local dev/build.
- TypeScript for state, units, specs, and simulation contracts.
- Vitest for deterministic model tests.
- Canvas/SVG for 2D cutaway rendering, with the option to add Three.js later only if 3D becomes a real requirement.
- Tone.js retained for audio synthesis.

Suggested structure:

```text
src/
  app/
    bootstrap.ts
    loop.ts
  engine/
    specs/
      microTurbine.ts
    model/
      types.ts
      units.ts
      atmosphere.ts
      fuelSystem.ts
      compressor.ts
      combustor.ts
      turbine.ts
      nozzle.ts
      spool.ts
      sensors.ts
      engineStep.ts
    ecu/
      states.ts
      schedules.ts
      protections.ts
      startSequence.ts
    faults/
      faultModel.ts
      faultRules.ts
  state/
    store.ts
    actions.ts
    selectors.ts
    telemetry.ts
  ui/
    controls/
    panels/
    events/
  render/
    engineCutaway/
    telemetryGraph/
    wiring/
  audio/
    engineAudio.ts
    layers/
  scenarios/
    presets.ts
    scenarioRunner.ts
```

## 6. Simulation Model

Use a fixed-step integrator and keep render/audio interpolation separate.

Core state:

- `spoolRpm`
- `spoolOmega`
- `combustorTemp`
- `turbineInletTemp`
- `egt`
- `massFlow`
- `fuelFlow`
- `fuelAirRatio`
- `compressorPressureRatio`
- `pumpPressure`
- `batteryVoltage`
- `fuelRemaining`
- `thrust`
- `exhaustVelocity`
- `thermalMassTemp`
- `sensorRpm`, `sensorEgt`, `sensorPump`, `sensorBattery`

Inputs:

- master power
- throttle command
- trim/run command
- starter command
- glow plug command
- pump command or ECU pump schedule
- ambient temperature
- altitude
- optional inlet disturbance/fuel bubbles

Environment:

- Replace preset density multipliers with a simple ISA-style atmosphere approximation.
- Derive ambient pressure, temperature, density, and speed of sound.
- Keep user-facing presets, but map them to physical values.

Fuel and combustion:

- Throttle should request fuel flow, not RPM.
- Pump voltage/pressure and ECU limits determine delivered fuel.
- Combustor heat should be based on fuel flow and an efficiency factor.
- Combustion stability should depend on spool speed, airflow, fuel-air ratio, and temperature.

Spool dynamics:

- Compute turbine torque from hot gas energy.
- Compute compressor load from pressure ratio and mass flow.
- Apply starter torque during START.
- Apply friction and inertia.
- Integrate angular acceleration into spool speed.

Thermal model:

- EGT should lag actual gas temperature.
- Metal temperature should heat and cool slowly.
- Hot-start risk should come from high fuel flow at low airflow, not a random EGT bump.

Fault model:

- Low battery: starter/pump authority drops before full lockout.
- Hot start: excessive fuel with insufficient airflow during ignition.
- Wet start: fuel accumulates without successful light-off.
- Flameout: mixture outside stable combustion envelope or rapid throttle transient at low compressor margin.
- Overspeed: ECU cuts fuel if spool exceeds limit.
- Overtemp: ECU reduces fuel or forces shutdown.
- Fuel bubbles: pump cavitation/noisy delivered fuel flow.

## 7. Visual Refactor

The original skeuomorphic UI should evolve from "hardware collage" into "bench test rig plus engine cutaway."

Keep:

- Controller, ECU, battery, fuel tank, GSU terminal, LEDs, wiring.

Upgrade:

- Replace the simple engine SVG silhouette with a cutaway model showing inlet, compressor, combustor, turbine, and nozzle.
- Drive compressor/turbine rotation from spool RPM.
- Drive flame color/length from fuel flow, combustor temperature, and exhaust velocity.
- Drive exhaust particles from mass flow and EGT.
- Show pressure/temperature zones through subtle overlays rather than decorative gradients.
- Add optional labels/toggles for educational overlays, but keep the default screen as an instrumented simulator, not a tutorial page.

## 8. Audio Refactor

Retain Tone.js, but map audio layers to physical variables:

- Starter whirr: starter torque and spool RPM below self-sustaining speed.
- Compressor whine: spool RPM and compressor pressure ratio.
- Combustion roar: fuel flow, turbine inlet temperature, and mass flow.
- Exhaust noise: thrust and exhaust velocity.
- Instability: fuel bubbles, compressor surge margin, flameout onset.
- Cool-down ticks: metal temperature and cooling rate.

The goal is for the sound to predict engine state before the numbers do.

## 9. Implementation Milestones

### Phase 0: Baseline Capture

- Keep `original/` as a reference clone.
- Create minijet-2 project scaffold.
- Port enough UI to reproduce current startup, run, shutdown, readouts, and audio.
- Add screenshot/behavior notes for original so future changes have a comparison point.

### Phase 1: Typed Engine Core

- Define units, engine spec, inputs, state, telemetry, and fault types.
- Implement fixed-step simulation loop independent from DOM.
- Add deterministic seeded randomness.
- Add tests for idle, max throttle, shutdown, no-fuel, and low-battery cases.

Status: initial scaffold completed in `src/engine/`. See `docs/engine-core.md`.

### Phase 2: Realistic Start Sequence

- Rebuild ECU as a state machine with guard conditions.
- Model glow plug, starter torque, pump priming, light-off, ramp, idle stabilization, and cool-down.
- Replace random ignition/hot-start behavior with conditions derived from airflow, fuel flow, and temperature.

Status: initial implementation completed. ECU diagnostics now expose start permissive, block reason, light-off readiness, actuator duty, pump priming, and idle stabilization.

### Phase 3: Fuel-Air-Spool Model

- Implement atmosphere, mass flow, pressure ratio, fuel flow, combustion heat, turbine torque, compressor load, and nozzle thrust.
- Tune the model to plausible RC turbine ranges:
  - idle around 35k RPM
  - max around 120k-160k RPM
  - EGT normal operating band around 450-750 C
  - hot-start threshold around 850 C
  - visible spool lag and EGT lag

Status: initial implementation completed. Compressor corrected speed/flow, efficiency, surge margin, gas-power turbine torque, pressure-ratio nozzle thrust, airflow fuel limiting, and performance trace telemetry are now implemented.

### Phase 4: Instruments And Visualization

- Build a telemetry adapter so UI reads stable sensor outputs instead of raw internal values.
- Upgrade GSU graph to plot RPM, EGT, fuel flow, pump pressure, thrust, and battery.
- Replace engine drawing with a cutaway visualization driven by mass flow, temperature, and spool state.

Status: initial implementation completed. Instrument snapshots, GSU rows, graph samples/buffers, and renderer-neutral engine cutaway state are implemented. See `docs/instruments-visualization.md`.

### Phase 5: Audio And Failure Polish

- Retune audio layers against the new telemetry.
- Add scenario presets: normal day, high altitude, hot day, cold start, low battery, low fuel, bubble ingestion.
- Add failure recovery flows that teach the operator what went wrong.

Status: initial implementation completed. Runtime-neutral audio layer states, fault/start-block recovery guidance, and scenario presets are implemented. See `docs/audio-failures-scenarios.md`.

### Phase 6: Calibration And QA

- Add simulation regression tests.
- Add UI smoke tests for startup/run/shutdown.
- Verify 60 FPS rendering and stable audio startup.
- Document the model assumptions and realism limits.

Status: initial implementation completed for the runtime-neutral core. Calibration cases, QA report formatting, scenario envelope tests, and model assumption docs are implemented. Browser UI smoke, FPS, and WebAudio startup checks remain for the future app shell. See `docs/calibration-qa.md` and `docs/model-assumptions.md`.

## 10. First Concrete Build Step

Start minijet-2 by creating the typed simulation kernel first, before rebuilding the UI.

Minimum first slice:

1. `EngineSpec`, `EngineInputs`, `AmbientState`, `EngineState`, `EngineTelemetry`.
2. Fixed-step `stepEngine(state, inputs, spec, dt)` with atmosphere, fuel flow, spool inertia, thermal lag, and basic ECU states.
3. Tests proving:
   - engine remains off with no master power,
   - starter spins spool during START,
   - ignition requires enough spool RPM and fuel,
   - idle stabilizes near target,
   - throttle changes create spool/EGT lag,
   - fuel starvation and low battery produce protective states.

Once that behaves well, the existing UI ideas can be reattached without letting DOM code dictate the physics.
