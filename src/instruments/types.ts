import type { EngineMode, FaultCode, StartBlockReason } from "../engine/index.ts";

export const InstrumentChannelId = {
  Rpm: "rpm",
  Egt: "egt",
  FuelFlow: "fuelFlow",
  PumpPressure: "pumpPressure",
  Thrust: "thrust",
  Battery: "battery",
  PressureRatio: "pressureRatio",
  MassFlow: "massFlow",
  SurgeMargin: "surgeMargin"
} as const;

export type InstrumentChannelId = (typeof InstrumentChannelId)[keyof typeof InstrumentChannelId];

export const InstrumentStatus = {
  Nominal: "nominal",
  Caution: "caution",
  Danger: "danger"
} as const;

export type InstrumentStatus = (typeof InstrumentStatus)[keyof typeof InstrumentStatus];

export interface InstrumentValue {
  id: InstrumentChannelId;
  label: string;
  value: number;
  unit: string;
  normalized: number;
  formatted: string;
  status: InstrumentStatus;
}

export interface Annunciator {
  id: string;
  label: string;
  status: InstrumentStatus;
}

export interface GsuRow {
  label: string;
  value: string;
  status: InstrumentStatus;
}

export interface GraphChannel {
  id: InstrumentChannelId;
  label: string;
  unit: string;
  color: string;
  min: number;
  max: number;
}

export interface GraphSample {
  timeS: number;
  values: Record<InstrumentChannelId, number>;
}

export interface InstrumentSnapshot {
  timeS: number;
  mode: EngineMode;
  modeLabel: string;
  statusText: string;
  masterCaution: boolean;
  faults: FaultCode[];
  startBlockReason: StartBlockReason;
  values: Record<InstrumentChannelId, InstrumentValue>;
  gsuRows: GsuRow[];
  graphSample: GraphSample;
  annunciators: Annunciator[];
}

export interface TelemetryGraphBuffer {
  maxSamples: number;
  channels: GraphChannel[];
  samples: GraphSample[];
}