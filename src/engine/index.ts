export { microTurbineSpec } from "./specs/microTurbine.ts";
export { createInitialEngineState, stepEngine, toTelemetry } from "./model/engineStep.ts";
export { computeAtmosphere } from "./model/atmosphere.ts";
export { runScenario, standardInputs } from "./scenarios/scenarioRunner.ts";
export {
  SCENARIO_PRESETS,
  ScenarioPresetId,
  createScenarioInitialState,
  getScenarioPreset,
  runScenarioPreset
} from "./scenarios/presets.ts";
export {
  RecoverySeverity,
  getActiveRecoveryGuidance,
  getFaultRecoveryGuidance,
  getStartBlockGuidance
} from "./faults/index.ts";
export { EngineMode, FaultCode, StartBlockReason } from "./model/types.ts";
export type {
  AmbientInput,
  AmbientState,
  EcuStatus,
  EnginePerformanceTrace,
  EngineInputs,
  EngineSensors,
  EngineSpec,
  EngineState,
  EngineTelemetry,
  StartBlockReason as StartBlockReasonType
} from "./model/types.ts";
export type { ScenarioPreset } from "./scenarios/presets.ts";
export type { RecoveryAction, RecoveryGuidance, RecoverySeverityType } from "./faults/index.ts";
