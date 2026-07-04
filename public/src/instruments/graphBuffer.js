import { InstrumentChannelId,                                                                } from "./types.js";

export const GRAPH_CHANNELS                 = [
  { id: InstrumentChannelId.Rpm, label: "RPM", unit: "%", color: "#58d68d", min: 0, max: 1 },
  { id: InstrumentChannelId.Egt, label: "EGT", unit: "%", color: "#ff7a59", min: 0, max: 1 },
  { id: InstrumentChannelId.FuelFlow, label: "FUEL", unit: "%", color: "#f5c542", min: 0, max: 1 },
  { id: InstrumentChannelId.PumpPressure, label: "PUMP", unit: "%", color: "#5dade2", min: 0, max: 1 },
  { id: InstrumentChannelId.Thrust, label: "THRUST", unit: "%", color: "#d7b7ff", min: 0, max: 1 },
  { id: InstrumentChannelId.Battery, label: "BAT", unit: "%", color: "#9ea7ad", min: 0, max: 1 },
  { id: InstrumentChannelId.PressureRatio, label: "PR", unit: "%", color: "#72d6c9", min: 0, max: 1 },
  { id: InstrumentChannelId.MassFlow, label: "AIR", unit: "%", color: "#a7c7ff", min: 0, max: 1 },
  { id: InstrumentChannelId.SurgeMargin, label: "SURGE", unit: "%", color: "#f08fb2", min: 0, max: 1 }
];

export function createTelemetryGraphBuffer(maxSamples = 600)                       {
  return {
    maxSamples,
    channels: GRAPH_CHANNELS,
    samples: []
  };
}

export function appendGraphSample(
  buffer                      ,
  sample             
)                       {
  const samples = [...buffer.samples, sample];
  const overflow = samples.length - buffer.maxSamples;

  return {
    ...buffer,
    samples: overflow > 0 ? samples.slice(overflow) : samples
  };
}

export function getGraphSeries(
  buffer                      ,
  channelId                     
)                                          {
  return buffer.samples.map((sample) => ({
    timeS: sample.timeS,
    value: sample.values[channelId]
  }));
}

export function latestGraphSample(buffer                      )                     {
  return buffer.samples.length > 0 ? buffer.samples[buffer.samples.length - 1] : null;
}