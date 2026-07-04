import { createInitialEngineState } from "../model/engineStep.js";
                                                                               
import { runScenario, standardInputs,                   } from "./scenarioRunner.js";

export const ScenarioPresetId = {
  NormalStart: "normal-start",
  HighAltitude: "high-altitude",
  HotDay: "hot-day",
  ColdStart: "cold-start",
  LowBattery: "low-battery",
  LowFuel: "low-fuel",
  BubbleIngestion: "bubble-ingestion"
}         ;

                                                                                        

                                 
                       
                
                      
                                   
                        
                                                                                
 

function startSteps(ambient                         , throttleAfterStart = 0)                 {
  return [
    { durationS: 0.45, inputs: standardInputs({ master: true, trimRun: true, throttle: 1, ambient }) },
    { durationS: 18, inputs: standardInputs({ master: true, trimRun: true, throttle: 0, ambient }) },
    { durationS: 6, inputs: standardInputs({ master: true, trimRun: true, throttle: throttleAfterStart, ambient }) }
  ];
}

export const SCENARIO_PRESETS                   = [
  {
    id: ScenarioPresetId.NormalStart,
    label: "Normal start",
    description: "Standard day start, idle stabilization, and moderate run.",
    ambient: { temperatureC: 15, altitudeM: 0 },
    steps: startSteps({ temperatureC: 15, altitudeM: 0 }, 0.35)
  },
  {
    id: ScenarioPresetId.HighAltitude,
    label: "High altitude",
    description: "Reduced-density run with airflow-limited fuel scheduling.",
    ambient: { temperatureC: 15, altitudeM: 1800 },
    steps: startSteps({ temperatureC: 15, altitudeM: 1800 }, 1)
  },
  {
    id: ScenarioPresetId.HotDay,
    label: "Hot day",
    description: "High ambient temperature run with lower density and higher EGT tendency.",
    ambient: { temperatureC: 35, altitudeM: 0 },
    steps: startSteps({ temperatureC: 35, altitudeM: 0 }, 1)
  },
  {
    id: ScenarioPresetId.ColdStart,
    label: "Cold start",
    description: "Cold ambient start with longer thermal lag before stable run.",
    ambient: { temperatureC: -5, altitudeM: 0 },
    steps: startSteps({ temperatureC: -5, altitudeM: 0 }, 0.35)
  },
  {
    id: ScenarioPresetId.LowBattery,
    label: "Low battery",
    description: "Start attempt with insufficient battery authority.",
    ambient: { temperatureC: 15, altitudeM: 0 },
    configureInitialState: (state, spec) => ({
      ...state,
      batteryVoltageV: spec.electrical.lowBatteryV - 0.15,
      sensors: { ...state.sensors, batteryVoltageV: spec.electrical.lowBatteryV - 0.15 }
    }),
    steps: [
      { durationS: 0.45, inputs: standardInputs({ master: true, trimRun: true, throttle: 1 }) },
      { durationS: 1, inputs: standardInputs({ master: true, trimRun: true, throttle: 0 }) }
    ]
  },
  {
    id: ScenarioPresetId.LowFuel,
    label: "Low fuel runout",
    description: "Starts with too little fuel and runs into starvation.",
    ambient: { temperatureC: 15, altitudeM: 0 },
    configureInitialState: (state) => ({ ...state, fuelRemainingKg: 0.016 }),
    steps: [
      { durationS: 0.45, inputs: standardInputs({ master: true, trimRun: true, throttle: 1 }) },
      { durationS: 18, inputs: standardInputs({ master: true, trimRun: true, throttle: 0 }) },
      { durationS: 30, inputs: standardInputs({ master: true, trimRun: true, throttle: 1 }) }
    ]
  },
  {
    id: ScenarioPresetId.BubbleIngestion,
    label: "Bubble ingestion",
    description: "A high-throttle run with severe fuel bubbles causing pump delivery instability.",
    ambient: { temperatureC: 15, altitudeM: 0 },
    steps: [
      ...startSteps({ temperatureC: 15, altitudeM: 0 }, 0.1),
      { durationS: 1.2, inputs: standardInputs({ master: true, trimRun: true, throttle: 0, fuelBubble: 1 }) }
    ]
  }
];

export function getScenarioPreset(id                  )                 {
  const preset = SCENARIO_PRESETS.find((candidate) => candidate.id === id);
  if (!preset) throw new Error(`Unknown scenario preset: ${id}`);
  return preset;
}

export function createScenarioInitialState(preset                , spec            )              {
  const state = createInitialEngineState(spec, preset.ambient.temperatureC);
  return preset.configureInitialState ? preset.configureInitialState(state, spec) : state;
}

export function runScenarioPreset(
  preset                ,
  spec            ,
  dtS = 0.02
)              {
  return runScenario(createScenarioInitialState(preset, spec), spec, preset.steps, dtS);
}