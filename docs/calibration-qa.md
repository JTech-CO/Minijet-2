# Calibration And QA

Phase 6 adds executable calibration gates for the minijet-2 simulation model.

## Entry Points

- `src/qa/index.ts`
- `DEFAULT_CALIBRATION_CASES`
- `runCalibrationCase(case, spec)`
- `runCalibrationSuite(cases, spec)`
- `formatCalibrationReport(suite)`

## What Is Calibrated

The default suite checks every scenario preset against expected envelopes:

- normal start
- high altitude
- hot day
- cold start
- low battery
- low fuel runout
- bubble ingestion flameout

Metrics checked by the suite:

- RPM
- EGT
- thrust
- fuel-air ratio
- fuel remaining
- battery voltage
- compressor pressure ratio
- mass flow
- surge margin

The suite also checks expected final mode, required faults, and forbidden faults.

## Current Baseline

A passing run should report:

```text
Calibration PASS: 7 cases
PASS normal-start-envelope mode=run faults=none rpm=76073 egt=548 thrust=5.8
PASS high-altitude-envelope mode=run faults=none rpm=123955 egt=682 thrust=17.2
PASS hot-day-envelope mode=run faults=none rpm=128520 egt=705 thrust=18.6
PASS cold-start-envelope mode=run faults=none rpm=72435 egt=548 thrust=6.2
PASS low-battery-protection mode=lockout faults=low-battery rpm=0 egt=15 thrust=0.0
PASS low-fuel-runout mode=cool faults=fuel-starvation rpm=3498 egt=15 thrust=0.0
PASS bubble-ingestion-flameout mode=cool faults=flameout rpm=40397 egt=200 thrust=1.0
```

Small numeric drift is acceptable if caused by intentional retuning. In that case update both the model rationale and calibration bands together.

## Test Coverage

Run:

```bash
npm.cmd test
```

Phase 6 tests prove:

- default calibration suite passes all scenario envelopes
- failure reports identify the out-of-range metric
- every scenario preset has calibration coverage

## How To Use During Tuning

When changing compressor, turbine, fuel, thermal, or ECU scheduling:

1. Run the full test suite.
2. Read any calibration failure message.
3. Decide whether the model change is intended.
4. If intended, update the calibration band and document why.
5. If unintended, retune the model until the existing band passes.

Calibration bands should remain wide enough for useful tuning but narrow enough to catch broken behavior.