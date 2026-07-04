import {
  EngineMode,
  FaultCode,
  SCENARIO_PRESETS,
  ScenarioPresetId,
  microTurbineSpec,
  runScenarioPreset,
  toTelemetry,
  type EngineSpec,
  type EngineState,
  type EngineTelemetry
} from "../engine/index.ts";

export const CalibrationMetricId = {
  Rpm: "rpm",
  EgtC: "egtC",
  ThrustN: "thrustN",
  FuelAirRatio: "fuelAirRatio",
  FuelRemainingPct: "fuelRemainingPct",
  BatteryVoltageV: "batteryVoltageV",
  CompressorPressureRatio: "compressorPressureRatio",
  MassFlowKgPerS: "massFlowKgPerS",
  SurgeMargin: "surgeMargin"
} as const;

export type CalibrationMetricId = (typeof CalibrationMetricId)[keyof typeof CalibrationMetricId];
export type CalibrationFaultCode = (typeof FaultCode)[keyof typeof FaultCode];
export type CalibrationEngineMode = (typeof EngineMode)[keyof typeof EngineMode];

export interface CalibrationRange {
  min: number;
  max: number;
}

export interface CalibrationCase {
  id: string;
  label: string;
  presetId: ScenarioPresetId;
  expectedMode?: CalibrationEngineMode;
  requiredFaults?: CalibrationFaultCode[];
  forbiddenFaults?: CalibrationFaultCode[];
  ranges: Partial<Record<CalibrationMetricId, CalibrationRange>>;
}

export interface CalibrationResult {
  caseId: string;
  label: string;
  presetId: ScenarioPresetId;
  passed: boolean;
  mode: CalibrationEngineMode;
  faults: CalibrationFaultCode[];
  metrics: Record<CalibrationMetricId, number>;
  failures: string[];
}

export interface CalibrationSuiteResult {
  passed: boolean;
  results: CalibrationResult[];
}

export const DEFAULT_CALIBRATION_CASES: CalibrationCase[] = [
  {
    id: "normal-start-envelope",
    label: "Normal start envelope",
    presetId: ScenarioPresetId.NormalStart,
    expectedMode: EngineMode.Run,
    forbiddenFaults: Object.values(FaultCode),
    ranges: {
      rpm: { min: 65000, max: 85000 },
      egtC: { min: 480, max: 610 },
      thrustN: { min: 4, max: 8 },
      fuelAirRatio: { min: 0.009, max: 0.016 },
      fuelRemainingPct: { min: 98, max: 100 },
      compressorPressureRatio: { min: 1.45, max: 2.15 },
      massFlowKgPerS: { min: 0.015, max: 0.028 },
      surgeMargin: { min: 0.05, max: 0.5 }
    }
  },
  {
    id: "high-altitude-envelope",
    label: "High altitude full-power envelope",
    presetId: ScenarioPresetId.HighAltitude,
    expectedMode: EngineMode.Run,
    forbiddenFaults: Object.values(FaultCode),
    ranges: {
      rpm: { min: 112000, max: 135000 },
      egtC: { min: 620, max: 735 },
      thrustN: { min: 13, max: 22 },
      fuelAirRatio: { min: 0.021, max: 0.0315 },
      compressorPressureRatio: { min: 2.35, max: 3.15 },
      massFlowKgPerS: { min: 0.032, max: 0.048 },
      surgeMargin: { min: 0.55, max: 1 }
    }
  },
  {
    id: "hot-day-envelope",
    label: "Hot day full-power envelope",
    presetId: ScenarioPresetId.HotDay,
    expectedMode: EngineMode.Run,
    forbiddenFaults: Object.values(FaultCode),
    ranges: {
      rpm: { min: 118000, max: 140000 },
      egtC: { min: 635, max: 760 },
      thrustN: { min: 14, max: 23 },
      fuelAirRatio: { min: 0.021, max: 0.031 },
      compressorPressureRatio: { min: 2.3, max: 3.15 },
      surgeMargin: { min: 0.52, max: 1 }
    }
  },
  {
    id: "cold-start-envelope",
    label: "Cold start moderate run envelope",
    presetId: ScenarioPresetId.ColdStart,
    expectedMode: EngineMode.Run,
    forbiddenFaults: Object.values(FaultCode),
    ranges: {
      rpm: { min: 62000, max: 83000 },
      egtC: { min: 480, max: 610 },
      thrustN: { min: 4.5, max: 8.2 },
      fuelAirRatio: { min: 0.0095, max: 0.017 },
      fuelRemainingPct: { min: 98, max: 100 },
      surgeMargin: { min: 0.04, max: 0.48 }
    }
  },
  {
    id: "low-battery-protection",
    label: "Low battery protection",
    presetId: ScenarioPresetId.LowBattery,
    expectedMode: EngineMode.Lockout,
    requiredFaults: [FaultCode.LowBattery],
    ranges: {
      rpm: { min: 0, max: 100 },
      egtC: { min: 10, max: 30 },
      thrustN: { min: 0, max: 0.1 },
      fuelRemainingPct: { min: 99, max: 100 }
    }
  },
  {
    id: "low-fuel-runout",
    label: "Low fuel runout protection",
    presetId: ScenarioPresetId.LowFuel,
    expectedMode: EngineMode.Cool,
    requiredFaults: [FaultCode.FuelStarvation],
    ranges: {
      rpm: { min: 0, max: 12000 },
      thrustN: { min: 0, max: 0.5 },
      fuelRemainingPct: { min: 0, max: 0.2 }
    }
  },
  {
    id: "bubble-ingestion-flameout",
    label: "Bubble ingestion flameout",
    presetId: ScenarioPresetId.BubbleIngestion,
    expectedMode: EngineMode.Cool,
    requiredFaults: [FaultCode.Flameout],
    ranges: {
      rpm: { min: 25000, max: 55000 },
      egtC: { min: 80, max: 260 },
      thrustN: { min: 0, max: 2.5 },
      surgeMargin: { min: -0.2, max: 0.2 }
    }
  }
];

export function captureCalibrationMetrics(
  state: EngineState,
  telemetry: EngineTelemetry
): Record<CalibrationMetricId, number> {
  return {
    [CalibrationMetricId.Rpm]: telemetry.rpm,
    [CalibrationMetricId.EgtC]: telemetry.egtC,
    [CalibrationMetricId.ThrustN]: telemetry.thrustN,
    [CalibrationMetricId.FuelAirRatio]: telemetry.fuelAirRatio,
    [CalibrationMetricId.FuelRemainingPct]: telemetry.fuelRemainingPct,
    [CalibrationMetricId.BatteryVoltageV]: telemetry.batteryVoltageV,
    [CalibrationMetricId.CompressorPressureRatio]: telemetry.compressorPressureRatio,
    [CalibrationMetricId.MassFlowKgPerS]: telemetry.massFlowKgPerS,
    [CalibrationMetricId.SurgeMargin]: telemetry.performance.surgeMargin
  };
}

function isWithinRange(value: number, range: CalibrationRange): boolean {
  return value >= range.min && value <= range.max;
}

export function runCalibrationCase(
  calibrationCase: CalibrationCase,
  spec: EngineSpec = microTurbineSpec
): CalibrationResult {
  const preset = SCENARIO_PRESETS.find((candidate) => candidate.id === calibrationCase.presetId);
  if (!preset) throw new Error(`Unknown calibration preset: ${calibrationCase.presetId}`);

  const state = runScenarioPreset(preset, spec);
  const telemetry = toTelemetry(state, spec);
  const metrics = captureCalibrationMetrics(state, telemetry);
  const failures: string[] = [];

  if (calibrationCase.expectedMode && state.mode !== calibrationCase.expectedMode) {
    failures.push(`mode expected ${calibrationCase.expectedMode} but got ${state.mode}`);
  }

  for (const fault of calibrationCase.requiredFaults ?? []) {
    if (!state.faults.includes(fault)) failures.push(`missing required fault ${fault}`);
  }

  for (const fault of calibrationCase.forbiddenFaults ?? []) {
    if (state.faults.includes(fault)) failures.push(`unexpected fault ${fault}`);
  }

  for (const [metricId, range] of Object.entries(calibrationCase.ranges) as Array<[CalibrationMetricId, CalibrationRange]>) {
    const actual = metrics[metricId];
    if (!isWithinRange(actual, range)) {
      failures.push(`${metricId} expected ${range.min}..${range.max} but got ${actual}`);
    }
  }

  return {
    caseId: calibrationCase.id,
    label: calibrationCase.label,
    presetId: calibrationCase.presetId,
    passed: failures.length === 0,
    mode: state.mode,
    faults: [...state.faults],
    metrics,
    failures
  };
}

export function runCalibrationSuite(
  cases: CalibrationCase[] = DEFAULT_CALIBRATION_CASES,
  spec: EngineSpec = microTurbineSpec
): CalibrationSuiteResult {
  const results = cases.map((calibrationCase) => runCalibrationCase(calibrationCase, spec));

  return {
    passed: results.every((result) => result.passed),
    results
  };
}

export function formatCalibrationReport(suite: CalibrationSuiteResult): string {
  const lines = [`Calibration ${suite.passed ? "PASS" : "FAIL"}: ${suite.results.length} cases`];

  for (const result of suite.results) {
    const faultText = result.faults.length > 0 ? result.faults.join(",") : "none";
    lines.push(
      `${result.passed ? "PASS" : "FAIL"} ${result.caseId} mode=${result.mode} faults=${faultText} rpm=${Math.round(result.metrics.rpm)} egt=${Math.round(result.metrics.egtC)} thrust=${result.metrics.thrustN.toFixed(1)}`
    );
    for (const failure of result.failures) {
      lines.push(`  - ${failure}`);
    }
  }

  return lines.join("\n");
}