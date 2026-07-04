                                                                                   
import { clamp, radPerSecToRpm, rpmToRadPerSec } from "./units.js";
import { computeBatteryAuthority } from "./fuelSystem.js";

export function updateSpool(
  state             ,
  command            ,
  turbineTorqueNm        ,
  spec            ,
  dtS        
)              {
  const rpmNorm = clamp(state.spoolRpm / spec.spool.maxRpm, 0, 1.25);
  const starterTorqueNm =
    (command.starterOn || command.coolingStarterOn) && state.spoolRpm < spec.spool.starterCutoffRpm
      ? spec.spool.starterTorqueNm * computeBatteryAuthority(state.batteryVoltageV, spec)
      : 0;
  const appliedStarterTorqueNm = command.coolingStarterOn ? starterTorqueNm * 0.45 : starterTorqueNm;
  const frictionTorqueNm =
    spec.spool.bearingFrictionNm + spec.spool.windageFrictionNm * rpmNorm * rpmNorm;
  const netSpoolTorqueNm =
    turbineTorqueNm +
    appliedStarterTorqueNm -
    state.compressorTorqueNm -
    frictionTorqueNm;
  const angularAccelRadS2 = netSpoolTorqueNm / spec.spool.inertiaKgM2;
  const spoolOmegaRadS = Math.max(0, rpmToRadPerSec(state.spoolRpm) + angularAccelRadS2 * dtS);
  const spoolAccelerationRpmPerS = radPerSecToRpm(angularAccelRadS2);

  return {
    spoolOmegaRadS,
    spoolRpm: radPerSecToRpm(spoolOmegaRadS),
    starterTorqueNm: appliedStarterTorqueNm,
    frictionTorqueNm,
    netSpoolTorqueNm,
    spoolAccelerationRpmPerS
  };
}