import type { EngineTelemetry, FaultCode as FaultCodeType, StartBlockReason as StartBlockReasonType } from "../index.ts";
import { FaultCode, StartBlockReason } from "../index.ts";

export const RecoverySeverity = {
  Info: "info",
  Caution: "caution",
  Critical: "critical"
} as const;

export type RecoverySeverity = (typeof RecoverySeverity)[keyof typeof RecoverySeverity];

export interface RecoveryAction {
  label: string;
  detail: string;
}

export interface RecoveryGuidance {
  code: FaultCodeType | StartBlockReasonType;
  title: string;
  severity: RecoverySeverity;
  explanation: string;
  actions: RecoveryAction[];
  resetCondition: string;
}

export function getFaultRecoveryGuidance(fault: FaultCodeType): RecoveryGuidance {
  switch (fault) {
    case FaultCode.LowBattery:
      return {
        code: fault,
        title: "LOW BATTERY",
        severity: RecoverySeverity.Critical,
        explanation: "Battery voltage is below ECU authority. Starter and pump output are no longer reliable.",
        actions: [
          { label: "MASTER OFF", detail: "Remove load from starter and pump." },
          { label: "RECONNECT BATTERY", detail: "Restore battery above reset voltage before arming again." }
        ],
        resetCondition: "Battery voltage above reset threshold and engine OFF."
      };
    case FaultCode.FuelStarvation:
      return {
        code: fault,
        title: "FUEL STARVATION",
        severity: RecoverySeverity.Critical,
        explanation: "Delivered fuel reached zero while the engine was lit.",
        actions: [
          { label: "THROTTLE IDLE", detail: "Do not command more fuel until the tank is restored." },
          { label: "TRIM DOWN", detail: "Let the ECU complete cool-down." },
          { label: "REFUEL", detail: "Restart only after fuel mass is restored." }
        ],
        resetCondition: "Fuel available, EGT cooled, and engine OFF or READY."
      };
    case FaultCode.HotStart:
      return {
        code: fault,
        title: "HOT START",
        severity: RecoverySeverity.Critical,
        explanation: "EGT exceeded the start limit during ignition, usually from too much heat with insufficient airflow.",
        actions: [
          { label: "TRIM DOWN", detail: "Cut fuel immediately." },
          { label: "COOL", detail: "Wait for EGT and metal temperature to fall before another start." }
        ],
        resetCondition: "EGT below start limit and wet fuel cleared."
      };
    case FaultCode.OverTemp:
      return {
        code: fault,
        title: "OVER TEMP",
        severity: RecoverySeverity.Critical,
        explanation: "EGT exceeded the continuous operating limit in RUN.",
        actions: [
          { label: "THROTTLE IDLE", detail: "Reduce fuel demand and turbine inlet temperature." },
          { label: "TRIM DOWN", detail: "Enter cool-down if EGT does not recover." }
        ],
        resetCondition: "EGT below continuous limit with stable idle or engine OFF."
      };
    case FaultCode.Overspeed:
      return {
        code: fault,
        title: "OVERSPEED",
        severity: RecoverySeverity.Critical,
        explanation: "Spool speed exceeded the mechanical safety limit.",
        actions: [
          { label: "FUEL CUT", detail: "ECU should remove fuel and let the rotor coast down." },
          { label: "INSPECT", detail: "Do not restart until the simulated rotor is stopped." }
        ],
        resetCondition: "RPM near zero and operator re-arms from OFF."
      };
    case FaultCode.Flameout:
      return {
        code: fault,
        title: "FLAMEOUT",
        severity: RecoverySeverity.Caution,
        explanation: "Combustion became unstable or extinguished while fuel was being commanded.",
        actions: [
          { label: "THROTTLE IDLE", detail: "Reduce fuel demand and recover compressor margin." },
          { label: "TRIM DOWN", detail: "Let the ECU cool down before relight." }
        ],
        resetCondition: "Throttle idle, trim down, and EGT cooled."
      };
    case FaultCode.WetStart:
      return {
        code: fault,
        title: "WET START",
        severity: RecoverySeverity.Caution,
        explanation: "Fuel accumulated without a confirmed light-off.",
        actions: [
          { label: "STOP START", detail: "Prevent additional fuel from entering the combustor." },
          { label: "VENTILATE", detail: "Motor the engine or wait until wet fuel clears." }
        ],
        resetCondition: "Wet fuel below limit and combustor cooled."
      };
  }
}

export function getStartBlockGuidance(reason: StartBlockReasonType): RecoveryGuidance | null {
  switch (reason) {
    case StartBlockReason.None:
      return null;
    case StartBlockReason.MasterOff:
      return {
        code: reason,
        title: "MASTER OFF",
        severity: RecoverySeverity.Info,
        explanation: "The ECU is not powered.",
        actions: [{ label: "MASTER ON", detail: "Power the ECU before arming start." }],
        resetCondition: "Master switch on."
      };
    case StartBlockReason.TrimOff:
      return {
        code: reason,
        title: "TRIM OFF",
        severity: RecoverySeverity.Info,
        explanation: "The run/trim command is not armed.",
        actions: [{ label: "TRIM UP", detail: "Arm the ECU start sequence." }],
        resetCondition: "Trim/run command active."
      };
    case StartBlockReason.ThrottleHighGateRequired:
      return {
        code: reason,
        title: "START GATE",
        severity: RecoverySeverity.Info,
        explanation: "The RC turbine start ritual requires a high throttle gate before returning to idle.",
        actions: [{ label: "THROTTLE HIGH", detail: "Move throttle above 95% to arm the start gate." }],
        resetCondition: "Start gate armed."
      };
    case StartBlockReason.ThrottleLowGateRequired:
      return {
        code: reason,
        title: "THROTTLE HIGH",
        severity: RecoverySeverity.Info,
        explanation: "Start gate is armed but throttle must return to idle before glow/start.",
        actions: [{ label: "THROTTLE IDLE", detail: "Move throttle below 5%." }],
        resetCondition: "Throttle below idle gate."
      };
    case StartBlockReason.BatteryLow:
      return getFaultRecoveryGuidance(FaultCode.LowBattery);
    case StartBlockReason.FuelLow:
      return {
        code: reason,
        title: "FUEL LOW",
        severity: RecoverySeverity.Caution,
        explanation: "There is not enough fuel mass for a reliable start.",
        actions: [{ label: "REFUEL", detail: "Restore fuel before running the pump." }],
        resetCondition: "Fuel above minimum start mass."
      };
    case StartBlockReason.EngineHot:
      return {
        code: reason,
        title: "ENGINE HOT",
        severity: RecoverySeverity.Caution,
        explanation: "The engine is too hot for another start attempt.",
        actions: [{ label: "WAIT COOL", detail: "Allow EGT and metal temperature to fall." }],
        resetCondition: "EGT below start threshold."
      };
    case StartBlockReason.WetFuelRisk:
      return getFaultRecoveryGuidance(FaultCode.WetStart);
    case StartBlockReason.SpoolStillTurning:
      return {
        code: reason,
        title: "SPOOL TURNING",
        severity: RecoverySeverity.Info,
        explanation: "The rotor is still above the safe restart speed.",
        actions: [{ label: "WAIT", detail: "Restart after RPM falls near zero." }],
        resetCondition: "Spool speed below restart threshold."
      };
  }
}

export function getActiveRecoveryGuidance(telemetry: EngineTelemetry): RecoveryGuidance | null {
  if (telemetry.faults.length > 0) {
    return getFaultRecoveryGuidance(telemetry.faults[telemetry.faults.length - 1]);
  }

  return getStartBlockGuidance(telemetry.ecu.startBlockReason);
}