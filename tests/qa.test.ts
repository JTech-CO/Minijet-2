import test from "node:test";
import assert from "node:assert/strict";
import { SCENARIO_PRESETS, ScenarioPresetId, microTurbineSpec } from "../src/engine/index.ts";
import {
  DEFAULT_CALIBRATION_CASES,
  formatCalibrationReport,
  runCalibrationCase,
  runCalibrationSuite
} from "../src/qa/index.ts";

test("default calibration suite passes all scenario envelopes", () => {
  const suite = runCalibrationSuite();
  const report = formatCalibrationReport(suite);

  assert.equal(suite.passed, true, report);
  assert.equal(suite.results.length, DEFAULT_CALIBRATION_CASES.length);
  assert.ok(report.startsWith("Calibration PASS"));
});

test("calibration report pinpoints out-of-range metrics", () => {
  const result = runCalibrationCase(
    {
      id: "forced-failure",
      label: "Forced failure",
      presetId: ScenarioPresetId.NormalStart,
      ranges: {
        rpm: { min: 1, max: 2 }
      }
    },
    microTurbineSpec
  );

  assert.equal(result.passed, false);
  assert.ok(result.failures.some((failure) => failure.includes("rpm expected")));
});

test("every scenario preset is represented by at least one calibration case", () => {
  const coveredPresetIds = new Set(DEFAULT_CALIBRATION_CASES.map((calibrationCase) => calibrationCase.presetId));

  for (const preset of SCENARIO_PRESETS) {
    assert.equal(coveredPresetIds.has(preset.id), true, `${preset.id} missing calibration coverage`);
  }
});