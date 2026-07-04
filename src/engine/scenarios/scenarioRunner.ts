import { stepEngine } from "../model/engineStep.ts";
import type { EngineInputs, EngineSpec, EngineState } from "../model/types.ts";

export interface ScenarioStep {
  durationS: number;
  inputs: EngineInputs;
}

export function runScenario(
  initialState: EngineState,
  spec: EngineSpec,
  steps: ScenarioStep[],
  dtS = 0.02
): EngineState {
  let state = initialState;

  for (const step of steps) {
    const iterations = Math.ceil(step.durationS / dtS);
    for (let i = 0; i < iterations; i += 1) {
      state = stepEngine(state, step.inputs, spec, dtS);
    }
  }

  return state;
}

export function standardInputs(overrides: Partial<EngineInputs> = {}): EngineInputs {
  return {
    master: false,
    trimRun: false,
    throttle: 0,
    ambient: {
      temperatureC: 15,
      altitudeM: 0
    },
    ...overrides,
    ambient: {
      temperatureC: overrides.ambient?.temperatureC ?? 15,
      altitudeM: overrides.ambient?.altitudeM ?? 0
    }
  };
}
