                                                                             
import { STANDARD_TEMPERATURE_K, clamp } from "./units.js";

export function computeCompressor(
  spoolRpm        ,
  ambient              ,
  spec            ,
  inletDistortion = 0
)                   {
  const theta = ambient.temperatureK / STANDARD_TEMPERATURE_K;
  const rpmNorm = clamp(spoolRpm / spec.spool.maxRpm, 0, 1.25);
  const correctedSpeedNorm = clamp(rpmNorm / Math.sqrt(theta), 0, 1.25);
  const distortionLoss = 1 - clamp(inletDistortion, 0, 1) * 0.3;
  const densityEffect = Math.pow(ambient.densityRatio, 0.92);
  const flowShape = correctedSpeedNorm * (0.25 + 0.75 * correctedSpeedNorm);
  const correctedMassFlowNorm = clamp(flowShape * distortionLoss, 0, 1.25);

  const compressorEfficiency = clamp(
    0.54 + 0.26 * Math.exp(-Math.pow((correctedSpeedNorm - 0.72) / 0.34, 2)) - clamp(inletDistortion, 0, 1) * 0.08,
    0.48,
    0.82
  );
  const pressureRiseNorm = Math.pow(clamp(correctedSpeedNorm, 0, 1.05), 1.58);
  const pressureRatio =
    1 +
    (spec.compressor.pressureRatioAtMax - 1) *
      pressureRiseNorm *
      (0.9 + 0.1 * clamp(correctedMassFlowNorm, 0, 1)) *
      distortionLoss;
  const massFlowKgPerS =
    spec.compressor.referenceMassFlowKgPerS * densityEffect * correctedMassFlowNorm;
  const torqueNm =
    spec.compressor.torqueAtMaxNm *
    ambient.densityRatio *
    pressureRiseNorm *
    (0.32 + 0.68 * clamp(correctedMassFlowNorm, 0, 1.1)) /
    compressorEfficiency;
  const surgeLine = 0.08 + 0.46 * pressureRiseNorm;
  const surgeMargin = clamp((correctedMassFlowNorm - surgeLine) / 0.42, -1, 1);

  return {
    massFlowKgPerS,
    pressureRatio,
    torqueNm,
    correctedSpeedNorm,
    correctedMassFlowNorm,
    efficiency: compressorEfficiency,
    surgeMargin
  };
}