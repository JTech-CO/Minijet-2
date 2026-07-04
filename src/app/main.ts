import {
  SCENARIO_PRESETS,
  createInitialEngineState,
  getActiveRecoveryGuidance,
  getScenarioPreset,
  microTurbineSpec,
  runScenarioPreset,
  standardInputs,
  stepEngine,
  toTelemetry,
  type EngineInputs,
  type EngineState
} from "../engine/index.ts";
import { createEngineAudioState, AudioLayerId } from "../audio/index.ts";
import {
  GRAPH_CHANNELS,
  InstrumentChannelId,
  InstrumentStatus,
  appendGraphSample,
  createInstrumentSnapshot,
  createTelemetryGraphBuffer,
  type InstrumentSnapshot,
  type TelemetryGraphBuffer
} from "../instruments/index.ts";
import { createEngineCutawayState } from "../render/engineCutaway/index.ts";

const spec = microTurbineSpec;
const FIXED_DT_S = 0.02;
const GRAPH_INTERVAL_S = 0.1;
const GRAPH_CHANNEL_IDS = [
  InstrumentChannelId.Rpm,
  InstrumentChannelId.Egt,
  InstrumentChannelId.FuelFlow,
  InstrumentChannelId.Thrust,
  InstrumentChannelId.PressureRatio,
  InstrumentChannelId.SurgeMargin
];

type Language = "en" | "ko";
type ModalKind = "manual" | "theory";

interface ModalSection {
  title: string;
  body?: string;
  items?: string[];
}

interface ModalContent {
  kicker: string;
  title: string;
  sections: ModalSection[];
}

const TRANSLATIONS: Record<Language, Record<string, string>> = {
  en: {
    "top.station": "JET ENGINE OPERATIONS BENCH",
    "top.objective": "Realistic turbine operation trainer",
    "top.manual": "Manual",
    "top.theory": "How it works",
    "panel.controller": "CONTROLLER",
    "panel.engineEyebrow": "SIMULATION BENCH",
    "panel.gsu": "GSU TERMINAL",
    "panel.control": "CONTROL",
    "panel.telemetry": "TELEMETRY",
    "panel.audio": "AUDIO MODEL",
    "control.scenario": "SCENARIO",
    "control.resetTitle": "Reset simulation",
    "zone.inlet": "INLET",
    "zone.comp": "COMP",
    "zone.burner": "BURNER",
    "zone.turb": "TURB",
    "zone.nozzle": "NOZZLE",
    "status.nominal": "NOMINAL"
  },
  ko: {
    "top.station": "제트엔진 운용 벤치",
    "top.objective": "현실적 터빈 운용 훈련",
    "top.manual": "운용 매뉴얼",
    "top.theory": "작동 원리",
    "panel.controller": "컨트롤러",
    "panel.engineEyebrow": "시뮬레이션 벤치",
    "panel.gsu": "GSU 터미널",
    "panel.control": "제어",
    "panel.telemetry": "텔레메트리",
    "panel.audio": "오디오 모델",
    "control.scenario": "시나리오",
    "control.resetTitle": "시뮬레이션 리셋",
    "zone.inlet": "흡입구",
    "zone.comp": "압축기",
    "zone.burner": "연소실",
    "zone.turb": "터빈",
    "zone.nozzle": "노즐",
    "status.nominal": "정상"
  }
};

const SCENARIO_LABELS: Record<Language, Record<string, string>> = {
  en: {
    "normal-start": "Normal start",
    "high-altitude": "High altitude",
    "hot-day": "Hot day",
    "cold-start": "Cold start",
    "low-battery": "Low battery",
    "low-fuel": "Low fuel runout",
    "bubble-ingestion": "Bubble ingestion"
  },
  ko: {
    "normal-start": "표준 시동",
    "high-altitude": "고고도 운전",
    "hot-day": "고온 대기 운전",
    "cold-start": "저온 시동",
    "low-battery": "배터리 저전압",
    "low-fuel": "연료 부족 정지",
    "bubble-ingestion": "연료 기포 유입"
  }
};

const MODAL_CONTENT: Record<Language, Record<ModalKind, ModalContent>> = {
  en: {
    manual: {
      kicker: "OPERATIONS REFERENCE",
      title: "Miniature Jet Engine Manual",
      sections: [
        {
          title: "Objective",
          body:
            "This simulator is tuned for realistic jet engine operation and handling: ECU gates, spool inertia, pump pressure, EGT limits, surge margin, and fault recovery are exposed as operating instruments instead of arcade controls."
        },
        {
          title: "Start sequence",
          items: [
            "Set MASTER on and command TRIM UP to arm the ECU run circuit.",
            "Advance throttle briefly to the start command region, then return to idle while the starter, glow plug, and pump spool the engine.",
            "Watch RPM, EGT, pump pressure, and battery voltage. The ECU waits for stable idle before entering RUN.",
            "After RUN, increase throttle gradually and keep EGT and surge margin inside the green band."
          ]
        },
        {
          title: "Fault discipline",
          items: [
            "Low battery blocks starter authority before light-off.",
            "Fuel starvation or bubbles destabilize pump delivery and can trigger flameout cues.",
            "High EGT or weak surge margin should be recovered by reducing throttle and waiting for spool stabilization."
          ]
        }
      ]
    },
    theory: {
      kicker: "ENGINE PRINCIPLES",
      title: "How The Micro Turbine Works",
      sections: [
        {
          title: "Air path",
          body:
            "The inlet feeds the compressor. Compressor pressure ratio and mass flow rise with spool speed, but density, altitude, and throttle scheduling limit how much fuel can be burned safely."
        },
        {
          title: "Combustion and turbine work",
          body:
            "Fuel flow raises combustor temperature. The turbine extracts part of that energy to keep the compressor spinning; the remaining pressure and heat accelerate through the nozzle as thrust."
        },
        {
          title: "ECU behavior",
          body:
            "The ECU does not simply map throttle to RPM. It gates glow, starter, pump pressure, acceleration rate, over-temperature protection, and recovery guidance so the engine behaves like a small turbine powerplant."
        }
      ]
    }
  },
  ko: {
    manual: {
      kicker: "운용 기준서",
      title: "소형 제트엔진 운용 매뉴얼",
      sections: [
        {
          title: "목적",
          body:
            "이 시뮬레이터는 제트엔진 운용 및 조작의 현실성 구현을 목표로 합니다. ECU 게이트, 스풀 관성, 펌프 압력, EGT 제한, 서지 마진, 고장 복구를 단순 버튼 효과가 아니라 운용 계기로 노출합니다."
        },
        {
          title: "시동 절차",
          items: [
            "MASTER를 켜고 TRIM UP으로 ECU의 운전 회로를 준비합니다.",
            "스로틀을 잠시 시동 명령 영역까지 올린 뒤 아이들로 내리면 스타터, 글로우 플러그, 펌프가 순차적으로 엔진을 가속합니다.",
            "RPM, EGT, 펌프 압력, 배터리 전압을 함께 확인합니다. ECU는 안정 아이들이 확인된 뒤 RUN으로 전환합니다.",
            "RUN 이후에는 스로틀을 서서히 올리고 EGT와 서지 마진이 안전 범위에 머무는지 확인합니다."
          ]
        },
        {
          title: "고장 대응",
          items: [
            "저전압 배터리는 라이트오프 전에 스타터 권한을 제한합니다.",
            "연료 부족이나 기포 유입은 펌프 유량을 불안정하게 만들어 플레임아웃 징후를 만들 수 있습니다.",
            "EGT가 높거나 서지 마진이 약하면 스로틀을 낮추고 스풀이 안정될 때까지 기다립니다."
          ]
        }
      ]
    },
    theory: {
      kicker: "엔진 작동 원리",
      title: "마이크로 터빈은 어떻게 작동하는가",
      sections: [
        {
          title: "공기 흐름",
          body:
            "흡입구로 들어온 공기는 압축기에서 압축됩니다. 스풀 속도가 올라가면 압력비와 질량 유량이 증가하지만, 대기 밀도, 고도, 스로틀 스케줄링이 안전하게 태울 수 있는 연료량을 제한합니다."
        },
        {
          title: "연소와 터빈 일",
          body:
            "연료 유량은 연소실 온도를 올립니다. 터빈은 그 에너지 일부를 회수해 압축기를 계속 돌리고, 남은 압력과 열은 노즐을 지나며 추력으로 바뀝니다."
        },
        {
          title: "ECU 제어",
          body:
            "ECU는 스로틀을 RPM에 단순 대응시키지 않습니다. 글로우, 스타터, 펌프 압력, 가속률, 과열 보호, 복구 안내를 단계적으로 제어해 소형 터빈 파워플랜트처럼 동작하게 만듭니다."
        }
      ]
    }
  }
};

function el(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing #${id}`);
  return element;
}

function inputEl(id: string): HTMLInputElement {
  return el(id) as HTMLInputElement;
}

function selectEl(id: string): HTMLSelectElement {
  return el(id) as HTMLSelectElement;
}

const masterBtn = el("master-btn") as HTMLButtonElement;
const resetBtn = el("reset-btn") as HTMLButtonElement;
const trimUpBtn = el("trim-up-btn") as HTMLButtonElement;
const trimDownBtn = el("trim-down-btn") as HTMLButtonElement;
const throttleInput = inputEl("throttle-input");
const throttleValue = el("throttle-value");
const throttleHandle = el("throttle-handle");
const scenarioSelect = selectEl("scenario-select");
const scenarioRunBtn = el("scenario-run-btn") as HTMLButtonElement;
const gsuScreen = el("gsu-screen");
const metricsGrid = el("metrics-grid");
const graphCanvas = el("graph-canvas") as HTMLCanvasElement;
const telemetryResetBtn = el("telemetry-reset-btn") as HTMLButtonElement;
const modePill = el("mode-pill");
const topMode = el("top-mode");
const statusText = el("status-text");
const simTimeEl = el("sim-time");
const annunciator = el("annunciator");
const actionList = el("action-list");
const audioMeters = el("audio-meters");
const audioMaster = el("audio-master");
const langToggle = el("lang-toggle") as HTMLButtonElement;
const manualBtn = el("manual-btn") as HTMLButtonElement;
const theoryBtn = el("theory-btn") as HTMLButtonElement;
const modalBackdrop = el("modal-backdrop");
const modalKicker = el("modal-kicker");
const modalTitle = el("modal-title");
const modalBody = el("modal-body");
const modalClose = el("modal-close") as HTMLButtonElement;

const leds = {
  trim: el("trim-led"),
  pwr: el("pwr-led"),
  glow: el("glow-led"),
  start: el("start-led"),
  fuel: el("fuel-led")
};

const svg = {
  compressorRotor: el("compressor-rotor") as unknown as SVGGElement,
  compressorBlur: el("compressor-blur") as unknown as SVGEllipseElement,
  turbineRotor: el("turbine-rotor") as unknown as SVGGElement,
  turbineBlur: el("turbine-blur") as unknown as SVGEllipseElement,
  inletFlow: el("inlet-flow") as unknown as SVGPathElement,
  inletParticles: Array.from(document.querySelectorAll<SVGCircleElement>("#inlet-particles circle")),
  exhaustParticles: Array.from(document.querySelectorAll<SVGCircleElement>("#exhaust-particles circle")),
  smokeParticles: Array.from(document.querySelectorAll<SVGEllipseElement>("#smoke-particles ellipse")),
  compressorZone: el("compressor-zone") as unknown as SVGPathElement,
  combustorZone: el("combustor-zone") as unknown as SVGPathElement,
  turbineZone: el("turbine-zone") as unknown as SVGPathElement,
  nozzleZone: el("nozzle-zone") as unknown as SVGPathElement,
  flameCore: el("flame-core") as unknown as SVGEllipseElement,
  flameTail: el("flame-tail") as unknown as SVGPathElement,
  exhaustPlume: el("exhaust-plume") as unknown as SVGPathElement,
  exhaustFlame: el("exhaust-flame") as unknown as SVGPathElement,
  afterburnerCore: el("afterburner-core") as unknown as SVGEllipseElement
};
let language: Language = "ko";
let activeModal: ModalKind | null = null;
let engineState: EngineState = createInitialEngineState(spec);
let inputs: EngineInputs = standardInputs();
let graphBuffer: TelemetryGraphBuffer = createTelemetryGraphBuffer(900);
let simTimeS = 0;
let graphElapsedS = 0;
let accumulatorS = 0;
let lastFrameMs = performance.now();

function t(key: string): string {
  return TRANSLATIONS[language][key] ?? TRANSLATIONS.en[key] ?? key;
}

function scenarioLabel(id: string, fallback: string): string {
  return SCENARIO_LABELS[language][id] ?? SCENARIO_LABELS.en[id] ?? fallback;
}

function populateScenarioSelect() {
  const selected = scenarioSelect.value;
  scenarioSelect.innerHTML = "";
  for (const preset of SCENARIO_PRESETS) {
    const option = document.createElement("option");
    option.value = preset.id;
    option.textContent = scenarioLabel(preset.id, preset.label);
    scenarioSelect.appendChild(option);
  }

  if (selected) scenarioSelect.value = selected;
}

function renderModal(kind: ModalKind) {
  const content = MODAL_CONTENT[language][kind];
  modalKicker.textContent = content.kicker;
  modalTitle.textContent = content.title;
  modalBody.innerHTML = "";

  for (const section of content.sections) {
    const sectionEl = document.createElement("section");
    const heading = document.createElement("h3");
    heading.textContent = section.title;
    sectionEl.appendChild(heading);

    if (section.body) {
      const paragraph = document.createElement("p");
      paragraph.textContent = section.body;
      sectionEl.appendChild(paragraph);
    }

    if (section.items) {
      const list = document.createElement("ol");
      for (const item of section.items) {
        const listItem = document.createElement("li");
        listItem.textContent = item;
        list.appendChild(listItem);
      }
      sectionEl.appendChild(list);
    }

    modalBody.appendChild(sectionEl);
  }
}

function openModal(kind: ModalKind) {
  activeModal = kind;
  renderModal(kind);
  modalBackdrop.hidden = false;
}

function closeModal() {
  activeModal = null;
  modalBackdrop.hidden = true;
}

function applyLanguage() {
  document.documentElement.lang = language;
  langToggle.textContent = language === "en" ? "KR" : "EN";

  for (const element of document.querySelectorAll("[data-i18n]")) {
    const key = element.getAttribute("data-i18n");
    if (key) element.textContent = t(key);
  }

  for (const element of document.querySelectorAll<HTMLElement>("[data-i18n-title]")) {
    const key = element.getAttribute("data-i18n-title");
    if (key) element.title = t(key);
  }

  populateScenarioSelect();
  if (activeModal) renderModal(activeModal);
}

function setLed(element: HTMLElement, on: boolean, variant: "on" | "hot" | "fault" = "on") {
  element.className = "led";
  if (on) element.classList.add(variant);
}

function statusClass(status: string): string {
  if (status === InstrumentStatus.Danger) return "danger";
  if (status === InstrumentStatus.Caution) return "caution";
  return "nominal";
}

function initMetrics() {
  metricsGrid.innerHTML = "";
  const ids = [
    InstrumentChannelId.Rpm,
    InstrumentChannelId.Egt,
    InstrumentChannelId.FuelFlow,
    InstrumentChannelId.PumpPressure,
    InstrumentChannelId.Thrust,
    InstrumentChannelId.SurgeMargin
  ];

  for (const id of ids) {
    const card = document.createElement("div");
    card.className = "metric";
    card.dataset.metric = id;
    card.innerHTML = `<label>${id.toUpperCase()}</label><strong>0</strong><div class="bar"></div>`;
    metricsGrid.appendChild(card);
  }
}

function initAudioMeters() {
  audioMeters.innerHTML = "";
  for (const id of Object.values(AudioLayerId)) {
    const row = document.createElement("div");
    row.className = "audio-meter";
    row.dataset.layer = id;
    row.innerHTML = `<span>${id}</span><div class="track"><div class="fill"></div></div><strong>0.00</strong>`;
    audioMeters.appendChild(row);
  }
}

function setModeClass(element: HTMLElement, snapshot: InstrumentSnapshot) {
  element.className = element === topMode ? "top-mode" : "mode-pill";
  if (snapshot.faults.length > 0) element.classList.add("fault");
  else if (snapshot.modeLabel === "RUN") element.classList.add("run");
  else if (snapshot.masterCaution) element.classList.add("warn");
}

function updateControlClasses(snapshot: InstrumentSnapshot) {
  masterBtn.classList.toggle("active", inputs.master);
  setLed(leds.trim, inputs.trimRun);
  setLed(leds.pwr, inputs.master);
  setLed(leds.glow, snapshot.values.pumpPressure.value > 0 && engineState.ecu.glowPlugDuty > 0, "hot");
  setLed(leds.start, engineState.ecu.starterDuty > 0, "on");
  setLed(leds.fuel, engineState.fuelFlowKgPerS > 0, "hot");

  modePill.textContent = snapshot.modeLabel;
  topMode.textContent = snapshot.modeLabel;
  setModeClass(modePill, snapshot);
  setModeClass(topMode, snapshot);
}

function updateGsu(snapshot: InstrumentSnapshot) {
  gsuScreen.innerHTML = snapshot.gsuRows
    .map((row) => `<div class="gsu-row ${statusClass(row.status)}"><span>${row.label}</span><span>${row.value}</span></div>`)
    .join("");
}

function updateMetrics(snapshot: InstrumentSnapshot) {
  for (const metric of metricsGrid.querySelectorAll<HTMLElement>(".metric")) {
    const id = metric.dataset.metric as InstrumentChannelId;
    const value = snapshot.values[id];
    if (!value) continue;

    metric.className = `metric ${statusClass(value.status)}`;
    const label = metric.querySelector("label");
    const strong = metric.querySelector("strong");
    const bar = metric.querySelector<HTMLElement>(".bar");
    if (label) label.textContent = value.label;
    if (strong) strong.textContent = value.formatted;
    if (bar) bar.style.width = `${Math.min(value.normalized, 1) * 100}%`;
  }
}

function updateRecovery(snapshot: InstrumentSnapshot) {
  const guidance = getActiveRecoveryGuidance(toTelemetry(engineState, spec));

  annunciator.className = "annunciator";
  if (!guidance) {
    annunciator.textContent = snapshot.annunciators[0]?.label ?? t("status.nominal");
    actionList.textContent = "";
    return;
  }

  annunciator.textContent = guidance.title;
  if (guidance.severity === "critical") annunciator.classList.add("critical");
  else if (guidance.severity === "caution") annunciator.classList.add("caution");
  actionList.innerHTML = guidance.actions
    .slice(0, 2)
    .map((action) => `<div><strong>${action.label}</strong> ${action.detail}</div>`)
    .join("");
}

function updateCutaway(snapshot: InstrumentSnapshot) {
  const telemetry = toTelemetry(engineState, spec);
  const cutaway = createEngineCutawayState(telemetry, spec);
  const zoneById = Object.fromEntries(cutaway.zones.map((zone) => [zone.id, zone]));
  const rpmNorm = Math.max(0, Math.min(telemetry.rpmNorm, 1.2));
  const flowNorm = Math.max(0, Math.min(cutaway.overlay.massFlowNorm, 1.2));
  const thrustNorm = Math.max(0, Math.min(cutaway.exhaust.thrustNorm, 1.2));
  const exhaustVelocityNorm = Math.max(0, Math.min(cutaway.exhaust.velocityNorm, 1.2));
  const flameNorm = Math.max(0, Math.min(cutaway.flame.intensityNorm, 1));
  const afterburnerNorm = telemetry.isCombustionLit
    ? Math.max(0, Math.min((exhaustVelocityNorm - 0.18) / 0.82, 1))
    : 0;
  const smokeNorm = Math.max(
    telemetry.faults.length > 0 ? 0.42 : 0,
    telemetry.isCombustionLit ? flowNorm * 0.08 : flowNorm * 0.3
  );
  const compressorAngle = (simTimeS * cutaway.compressorRotor.revolutionsPerSecond * 360) % 360;
  const turbineAngle = (simTimeS * cutaway.turbineRotor.revolutionsPerSecond * -360) % 360;

  svg.compressorRotor.setAttribute("transform", `translate(315 178) rotate(${compressorAngle})`);
  svg.turbineRotor.setAttribute("transform", `translate(662 178) rotate(${turbineAngle})`);
  svg.compressorRotor.style.opacity = String(0.62 + cutaway.compressorRotor.blurNorm * 0.38);
  svg.turbineRotor.style.opacity = String(0.62 + cutaway.turbineRotor.blurNorm * 0.38);
  svg.compressorBlur.style.opacity = String(cutaway.compressorRotor.blurNorm * 0.48);
  svg.turbineBlur.style.opacity = String(cutaway.turbineRotor.blurNorm * 0.5);

  svg.inletFlow.style.opacity = String(0.06 + flowNorm * 0.18);
  svg.inletFlow.style.strokeWidth = String(1.5 + flowNorm * 2.5);
  svg.inletFlow.style.strokeDashoffset = String(-simTimeS * (24 + flowNorm * 115));

  svg.inletParticles.forEach((particle, index) => {
    const phase = (simTimeS * (0.16 + flowNorm * 1.45) + index * 0.071) % 1;
    const lane = (index % 6) - 2.5;
    const contraction = 1 - phase * 0.48;
    const x = 22 + phase * 206;
    const y = 178 + lane * 8.5 * contraction + Math.sin(simTimeS * 4.8 + index * 0.9) * (1.4 + flowNorm * 3.2);
    const radius = 1.1 + (index % 4) * 0.28 + flowNorm * 1.05;
    const opacity = flowNorm > 0.02 ? (0.13 + flowNorm * 0.68) * (0.72 + phase * 0.28) : 0.025;

    particle.setAttribute("cx", x.toFixed(1));
    particle.setAttribute("cy", y.toFixed(1));
    particle.setAttribute("r", radius.toFixed(2));
    particle.style.opacity = String(Math.min(opacity, 0.95));
  });

  svg.compressorZone.style.opacity = String(0.1 + zoneById.compressor.activityNorm * 0.34 + flowNorm * 0.08);
  svg.combustorZone.style.opacity = String(0.08 + zoneById.combustor.activityNorm * 0.52);
  svg.turbineZone.style.opacity = String(0.09 + zoneById.turbine.temperatureNorm * 0.42 + rpmNorm * 0.08);
  svg.nozzleZone.style.opacity = String(0.08 + zoneById.nozzle.activityNorm * 0.42);

  svg.flameCore.style.opacity = String(flameNorm * 0.9);
  svg.flameCore.setAttribute("rx", String(18 + cutaway.flame.lengthNorm * 106));
  svg.flameCore.setAttribute("ry", String(6 + flameNorm * 28));
  svg.flameTail.style.opacity = String(flameNorm * 0.52);
  svg.flameTail.style.transform = `scaleX(${0.38 + cutaway.flame.lengthNorm * 0.78}) scaleY(${0.7 + flameNorm * 0.34})`;

  const exhaustOpacity = telemetry.isCombustionLit ? Math.min(0.9, 0.12 + thrustNorm * 0.42 + afterburnerNorm * 0.32) : 0.02;
  svg.exhaustPlume.style.opacity = String(exhaustOpacity);
  svg.exhaustPlume.style.transform = `scaleX(${0.55 + exhaustVelocityNorm * 0.88}) scaleY(${0.58 + thrustNorm * 0.24})`;
  svg.exhaustFlame.style.opacity = String(afterburnerNorm * 0.72);
  svg.exhaustFlame.style.transform = `scaleX(${0.42 + afterburnerNorm * 0.72}) scaleY(${0.45 + afterburnerNorm * 0.36})`;
  svg.afterburnerCore.style.opacity = String(afterburnerNorm * 0.9);
  svg.afterburnerCore.setAttribute("rx", String(12 + afterburnerNorm * 96));
  svg.afterburnerCore.setAttribute("ry", String(5 + afterburnerNorm * 23));

  svg.exhaustParticles.forEach((particle, index) => {
    const phase = (simTimeS * (0.38 + exhaustVelocityNorm * 1.9) + index * 0.113) % 1;
    const spread = (7 + phase * 34) * (0.45 + afterburnerNorm * 0.65 + thrustNorm * 0.18);
    const x = 850 + phase * (128 + exhaustVelocityNorm * 38);
    const y = 178 + Math.sin(simTimeS * 6 + index * 1.7) * spread + ((index % 5) - 2) * spread * 0.22;
    const radius = 0.9 + phase * 2.7 + afterburnerNorm * 1.3;
    const opacity = telemetry.isCombustionLit ? (0.16 + afterburnerNorm * 0.72 + thrustNorm * 0.18) * (1 - phase) : 0;

    particle.setAttribute("cx", x.toFixed(1));
    particle.setAttribute("cy", y.toFixed(1));
    particle.setAttribute("r", radius.toFixed(2));
    particle.style.opacity = String(Math.max(0, Math.min(opacity, 0.92)));
    particle.style.fill = afterburnerNorm > 0.45 ? "#eaffff" : phase < 0.45 ? "#fff1a6" : "#ff8c48";
  });

  svg.smokeParticles.forEach((particle, index) => {
    const phase = (simTimeS * (0.06 + exhaustVelocityNorm * 0.32) + index * 0.173) % 1;
    const x = 846 + phase * 138;
    const y = 178 + Math.sin(simTimeS * 1.4 + index) * (8 + phase * 18) + ((index % 4) - 1.5) * 5;
    const rx = 5 + phase * 24 + smokeNorm * 12;
    const ry = 3 + phase * 13 + smokeNorm * 7;
    const opacity = Math.max(0, Math.min(smokeNorm * (1 - phase) * 0.52, 0.42));

    particle.setAttribute("cx", x.toFixed(1));
    particle.setAttribute("cy", y.toFixed(1));
    particle.setAttribute("rx", rx.toFixed(1));
    particle.setAttribute("ry", ry.toFixed(1));
    particle.style.opacity = String(opacity);
  });

  el("air-overlay").textContent = telemetry.massFlowKgPerS.toFixed(3);
  el("pr-overlay").textContent = telemetry.compressorPressureRatio.toFixed(2);
  el("surge-overlay").textContent = telemetry.performance.surgeMargin.toFixed(2);
  el("thrust-overlay").textContent = `${telemetry.thrustN.toFixed(1)}N`;
}
function updateAudio() {
  const audio = createEngineAudioState(toTelemetry(engineState, spec), spec);
  audioMaster.textContent = audio.masterGain.toFixed(1);

  for (const row of audioMeters.querySelectorAll<HTMLElement>(".audio-meter")) {
    const id = row.dataset.layer as AudioLayerId;
    const layer = audio.layers[id];
    const fill = row.querySelector<HTMLElement>(".fill");
    const value = row.querySelector("strong");
    if (fill) fill.style.width = `${layer.gain * 100}%`;
    if (value) value.textContent = layer.gain.toFixed(2);
  }
}

function resizeCanvas(canvas: HTMLCanvasElement) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.floor(rect.width * dpr));
  const height = Math.max(1, Math.floor(rect.height * dpr));

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  return { width, height, dpr };
}

function drawGraph() {
  const ctx = graphCanvas.getContext("2d");
  if (!ctx) return;

  const { width, height, dpr } = resizeCanvas(graphCanvas);
  ctx.clearRect(0, 0, width, height);
  ctx.save();
  ctx.scale(dpr, dpr);

  const cssWidth = width / dpr;
  const cssHeight = height / dpr;
  const left = 44;
  const right = cssWidth - 14;
  const top = 20;
  const bottom = cssHeight - 28;
  const plotWidth = Math.max(1, right - left);
  const plotHeight = Math.max(1, bottom - top);

  ctx.fillStyle = "#050705";
  ctx.fillRect(0, 0, cssWidth, cssHeight);

  const tubeGlow = ctx.createRadialGradient(cssWidth * 0.5, cssHeight * 0.48, 4, cssWidth * 0.5, cssHeight * 0.48, cssWidth * 0.7);
  tubeGlow.addColorStop(0, "rgba(98,211,127,0.12)");
  tubeGlow.addColorStop(0.45, "rgba(114,213,225,0.035)");
  tubeGlow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = tubeGlow;
  ctx.fillRect(0, 0, cssWidth, cssHeight);

  ctx.lineWidth = 1;
  for (let x = left; x <= right; x += plotWidth / 10) {
    ctx.strokeStyle = "rgba(114,213,225,0.07)";
    ctx.beginPath();
    ctx.moveTo(Math.round(x) + 0.5, top);
    ctx.lineTo(Math.round(x) + 0.5, bottom);
    ctx.stroke();
  }

  for (let y = top; y <= bottom; y += plotHeight / 8) {
    ctx.strokeStyle = "rgba(114,213,225,0.055)";
    ctx.beginPath();
    ctx.moveTo(left, Math.round(y) + 0.5);
    ctx.lineTo(right, Math.round(y) + 0.5);
    ctx.stroke();
  }

  for (let x = left; x <= right; x += plotWidth / 5) {
    ctx.strokeStyle = "rgba(98,211,127,0.12)";
    ctx.beginPath();
    ctx.moveTo(Math.round(x) + 0.5, top);
    ctx.lineTo(Math.round(x) + 0.5, bottom);
    ctx.stroke();
  }

  for (let y = top; y <= bottom; y += plotHeight / 4) {
    ctx.strokeStyle = "rgba(98,211,127,0.11)";
    ctx.beginPath();
    ctx.moveTo(left, Math.round(y) + 0.5);
    ctx.lineTo(right, Math.round(y) + 0.5);
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(236,236,227,0.18)";
  ctx.strokeRect(left, top, plotWidth, plotHeight);

  if (graphBuffer.samples.length === 0) {
    ctx.fillStyle = "rgba(160,165,150,0.62)";
    ctx.fillText("0", 12, bottom - 6);
    ctx.fillText("50", 8, top + plotHeight * 0.5 - 5);
    ctx.fillText("100", 4, top - 5);

    ctx.fillStyle = "rgba(255,255,255,0.028)";
    for (let y = 0; y < cssHeight; y += 3) {
      ctx.fillRect(0, y, cssWidth, 1);
    }

    ctx.restore();
    return;
  }

  const samples = graphBuffer.samples;
  for (const channel of GRAPH_CHANNELS.filter((candidate) => GRAPH_CHANNEL_IDS.includes(candidate.id))) {
    ctx.strokeStyle = channel.color;
    ctx.shadowColor = channel.color;
    ctx.shadowBlur = 7;
    ctx.lineWidth = 1.8;
    ctx.beginPath();

    samples.forEach((sample, index) => {
      const x = left + (samples.length <= 1 ? 0 : (index / (samples.length - 1)) * plotWidth);
      const y = bottom - Math.min(sample.values[channel.id], 1) * plotHeight;
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });

    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  ctx.font = "10px ui-monospace, monospace";
  ctx.textBaseline = "top";
  let legendX = 48;
  for (const channel of GRAPH_CHANNELS.filter((candidate) => GRAPH_CHANNEL_IDS.includes(candidate.id))) {
    ctx.fillStyle = channel.color;
    ctx.fillRect(legendX, 7, 9, 5);
    ctx.fillStyle = "rgba(236,236,227,0.76)";
    ctx.fillText(channel.label, legendX + 13, 4);
    legendX += channel.label.length * 8 + 30;
  }

  ctx.fillStyle = "rgba(160,165,150,0.62)";
  ctx.fillText("0", 12, bottom - 6);
  ctx.fillText("50", 8, top + plotHeight * 0.5 - 5);
  ctx.fillText("100", 4, top - 5);

  ctx.fillStyle = "rgba(255,255,255,0.028)";
  for (let y = 0; y < cssHeight; y += 3) {
    ctx.fillRect(0, y, cssWidth, 1);
  }

  ctx.restore();
}
function updateThrottleVisual() {
  const throttleNorm = Math.max(0, Math.min(inputs.throttle, 1));
  throttleValue.textContent = Math.round(throttleNorm * 100).toString();
  throttleHandle.style.top = `${88 - throttleNorm * 76}%`;
}

function render() {
  const telemetry = toTelemetry(engineState, spec);
  const snapshot = createInstrumentSnapshot(telemetry, spec, simTimeS);

  updateThrottleVisual();
  statusText.textContent = snapshot.statusText;
  simTimeEl.textContent = `${simTimeS.toFixed(1)}s`;
  updateControlClasses(snapshot);
  updateGsu(snapshot);
  updateMetrics(snapshot);
  updateRecovery(snapshot);
  updateCutaway(snapshot);
  updateAudio();
  drawGraph();
}

function isTelemetryActive(): boolean {
  return (
    engineState.spoolRpm > 300 ||
    engineState.ecu.starterDuty > 0 ||
    engineState.isCombustionLit ||
    engineState.fuelFlowKgPerS > 0.000001 ||
    engineState.thrustN > 0.05
  );
}

function resetTelemetryGraph() {
  graphBuffer = createTelemetryGraphBuffer(900);
  simTimeS = 0;
  graphElapsedS = 0;
  render();
}

function recordGraphSample() {
  const telemetry = toTelemetry(engineState, spec);
  const snapshot = createInstrumentSnapshot(telemetry, spec, simTimeS);
  graphBuffer = appendGraphSample(graphBuffer, snapshot.graphSample);
}

function setInputsFromScenarioLastStep(presetId: string) {
  const preset = getScenarioPreset(presetId as never);
  const lastStep = preset.steps[preset.steps.length - 1];
  inputs = { ...lastStep.inputs, ambient: { ...lastStep.inputs.ambient } };
  throttleInput.value = String(Math.round(inputs.throttle * 100));
}

function resetSimulation() {
  const preset = getScenarioPreset(scenarioSelect.value as never);
  inputs = standardInputs({ ambient: preset.ambient });
  engineState = createInitialEngineState(spec, preset.ambient.temperatureC);
  graphBuffer = createTelemetryGraphBuffer(900);
  simTimeS = 0;
  graphElapsedS = 0;
  accumulatorS = 0;
  throttleInput.value = "0";
  render();
}

function runSelectedScenario() {
  const preset = getScenarioPreset(scenarioSelect.value as never);
  engineState = runScenarioPreset(preset, spec);
  setInputsFromScenarioLastStep(preset.id);
  const active = isTelemetryActive();
  simTimeS = active ? preset.steps.reduce((sum, step) => sum + step.durationS, 0) : 0;
  graphBuffer = createTelemetryGraphBuffer(900);
  graphElapsedS = 0;
  if (active) recordGraphSample();
  render();
}

function stepSimulation(dtS: number) {
  accumulatorS += Math.min(dtS, 0.12);

  while (accumulatorS >= FIXED_DT_S) {
    engineState = stepEngine(engineState, inputs, spec, FIXED_DT_S);
    const active = isTelemetryActive();

    if (active) {
      simTimeS += FIXED_DT_S;
      graphElapsedS += FIXED_DT_S;

      if (graphBuffer.samples.length === 0 || graphElapsedS >= GRAPH_INTERVAL_S) {
        graphElapsedS = 0;
        recordGraphSample();
      }
    } else {
      if (graphBuffer.samples.length === 0) simTimeS = 0;
      graphElapsedS = 0;
    }

    accumulatorS -= FIXED_DT_S;
  }
}

function frame(nowMs: number) {
  const dtS = (nowMs - lastFrameMs) / 1000;
  lastFrameMs = nowMs;
  stepSimulation(dtS);
  render();
  requestAnimationFrame(frame);
}

function bindEvents() {
  masterBtn.addEventListener("click", () => {
    inputs = { ...inputs, master: !inputs.master };
  });
  resetBtn.addEventListener("click", resetSimulation);
  telemetryResetBtn.addEventListener("click", resetTelemetryGraph);
  trimUpBtn.addEventListener("click", () => {
    inputs = { ...inputs, trimRun: true };
  });
  trimDownBtn.addEventListener("click", () => {
    inputs = { ...inputs, trimRun: false };
  });
  throttleInput.addEventListener("input", () => {
    inputs = { ...inputs, throttle: Number(throttleInput.value) / 100 };
    updateThrottleVisual();
  });
  scenarioRunBtn.addEventListener("click", runSelectedScenario);
  langToggle.addEventListener("click", () => {
    language = language === "en" ? "ko" : "en";
    applyLanguage();
    render();
  });
  manualBtn.addEventListener("click", () => openModal("manual"));
  theoryBtn.addEventListener("click", () => openModal("theory"));
  modalClose.addEventListener("click", closeModal);
  modalBackdrop.addEventListener("click", (event) => {
    if (event.target === modalBackdrop) closeModal();
  });
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && activeModal) closeModal();
  });
}

applyLanguage();
initMetrics();
initAudioMeters();
bindEvents();
resetSimulation();
requestAnimationFrame((nowMs) => {
  lastFrameMs = nowMs;
  requestAnimationFrame(frame);
});









