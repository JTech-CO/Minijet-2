# Model Assumptions And Limits

minijet-2 uses a calibrated lumped-parameter engine model. It is designed for interactive educational simulation, not engineering certification or component design.

## Intended Realism Level

The model aims to preserve these relationships:

- fuel flow raises turbine inlet temperature
- airflow and fuel-air ratio determine combustion stability
- turbine torque accelerates the spool against compressor load and friction
- compressor speed changes mass flow and pressure ratio
- nozzle pressure ratio and gas temperature produce exhaust velocity and thrust
- ECU scheduling prevents common start and run failures
- sensors lag behind raw physical state

## Simplifications

The model intentionally does not include:

- CFD
- real compressor/turbine map tables
- blade geometry
- multi-spool dynamics
- bearing heat and lubrication physics
- detailed starter motor electrical curves
- detailed fuel atomization
- real combustor acoustic modes
- real nozzle choking calculations
- structural stress or fatigue

## Calibration Strategy

The model is tuned to plausible micro turbine ranges:

- idle/moderate run around 70k-80k RPM for the normal-start preset
- high power around 120k-130k RPM
- EGT generally below continuous limit during normal run
- hot-start protection around 850 C
- visible spool and EGT lag after throttle changes
- reduced-density cases stay stable through airflow fuel limiting

## Known Tradeoffs

- The normal-start preset ends at a moderate run rather than pure idle so that UI/audio/cutaway states have visible activity.
- The compressor and turbine equations are compact fitted curves, not lookup maps.
- EGT includes a low-speed heat-soak correction to keep small-turbine idle/moderate readings plausible.
- Bubble ingestion is modeled as delivered-fuel loss, not true two-phase pump dynamics.
- Audio is currently a runtime-neutral parameter model; no WebAudio/Tone.js node graph is instantiated yet.
- Visualization is currently a renderer-neutral cutaway state; no Canvas/SVG renderer is instantiated yet.

## QA Policy

Any model change that affects outputs should be checked against `src/qa/calibration.ts`.

Update calibration bands only when the changed behavior is intentional and the new range remains plausible. Do not widen a band just to hide a regression.