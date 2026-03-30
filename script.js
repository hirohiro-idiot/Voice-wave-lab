// =====================================================
// Wave Voice Lab v5.0
// 周期グループ抽出 / 代表周期編集 / 全周期一括反映
// =====================================================

// ------------------------------
// DOM
// ------------------------------
const statusEl = document.getElementById("status");
const timeInfoEl = document.getElementById("timeInfo");
const fileInfoEl = document.getElementById("fileInfo");
const viewInfoEl = document.getElementById("viewInfo");
const selectionInfoEl = document.getElementById("selectionInfo");
const playbackModeInfoEl = document.getElementById("playbackModeInfo");
const playbackTimeInfoEl = document.getElementById("playbackTimeInfo");

const recordBtn = document.getElementById("recordBtn");
const audioInput = document.getElementById("audioInput");

const saveNameInput = document.getElementById("saveNameInput");
const saveCurrentBtn = document.getElementById("saveCurrentBtn");
const saveEditedAsBtn = document.getElementById("saveEditedAsBtn");
const refreshLibraryBtn = document.getElementById("refreshLibraryBtn");
const libraryList = document.getElementById("libraryList");

const rewindBtn = document.getElementById("rewindBtn");
const playBtn = document.getElementById("playBtn");
const pauseBtn = document.getElementById("pauseBtn");
const forwardBtn = document.getElementById("forwardBtn");
const stopBtn = document.getElementById("stopBtn");
const seekBar = document.getElementById("seekBar");
const currentTimeLabel = document.getElementById("currentTimeLabel");
const durationLabel = document.getElementById("durationLabel");

const loopToggleBtn = document.getElementById("loopToggleBtn");
const speedSlider = document.getElementById("speedSlider");
const speedLabel = document.getElementById("speedLabel");

const playSelectionBtn = document.getElementById("playSelectionBtn");
const zoomToSelectionBtn = document.getElementById("zoomToSelectionBtn");
const saveSelectionWavBtn = document.getElementById("saveSelectionWavBtn");
const resetSelectionBtn = document.getElementById("resetSelectionBtn");
const openEditorBtn = document.getElementById("openEditorBtn");

const scrollLeftBtn = document.getElementById("scrollLeftBtn");
const scrollRightBtn = document.getElementById("scrollRightBtn");
const zoomInBtn = document.getElementById("zoomInBtn");
const zoomOutBtn = document.getElementById("zoomOutBtn");
const fullViewBtn = document.getElementById("fullViewBtn");

const analyzeSelectionBtn = document.getElementById("analyzeSelectionBtn");
const playContinuousBtn = document.getElementById("playContinuousBtn");
const playTransientBtn = document.getElementById("playTransientBtn");
const clearAnalysisBtn = document.getElementById("clearAnalysisBtn");

const editorPanel = document.getElementById("editorPanel");
const editorRangeInfo = document.getElementById("editorRangeInfo");
const toolSelect = document.getElementById("toolSelect");
const brushSizeInput = document.getElementById("brushSize");
const strengthInput = document.getElementById("strength");
const brushSizeValue = document.getElementById("brushSizeValue");
const strengthValue = document.getElementById("strengthValue");
const undoBtn = document.getElementById("undoBtn");
const cancelEditBtn = document.getElementById("cancelEditBtn");
const applyEditBtn = document.getElementById("applyEditBtn");
const saveWavBtn = document.getElementById("saveWavBtn");

const editPlayBtn = document.getElementById("editPlayBtn");
const editPauseBtn = document.getElementById("editPauseBtn");
const editStopBtn = document.getElementById("editStopBtn");
const editLoopToggleBtn = document.getElementById("editLoopToggleBtn");

const editModeToggleBtn = document.getElementById("editModeToggleBtn");
const editZoomInBtn = document.getElementById("editZoomInBtn");
const editZoomOutBtn = document.getElementById("editZoomOutBtn");
const editFullViewBtn = document.getElementById("editFullViewBtn");
const precisionToggleBtn = document.getElementById("precisionToggleBtn");
const overlayModeBtn = document.getElementById("overlayModeBtn");

const groupInfoText = document.getElementById("groupInfoText");
const unitInfoText = document.getElementById("unitInfoText");
const playUnitBtn = document.getElementById("playUnitBtn");
const groupPlayBtn = document.getElementById("groupPlayBtn");
const clearGroupBtn = document.getElementById("clearGroupBtn");
const unitEditModeBtn = document.getElementById("unitEditModeBtn");
const applyUnitToGroupBtn = document.getElementById("applyUnitToGroupBtn");

const unitBrushSizeInput = document.getElementById("unitBrushSize");
const unitStrengthInput = document.getElementById("unitStrength");
const unitBrushSizeValue = document.getElementById("unitBrushSizeValue");
const unitStrengthValue = document.getElementById("unitStrengthValue");

const mainCanvas = document.getElementById("mainWaveCanvas");
const mainCtx = mainCanvas.getContext("2d");
const editCanvas = document.getElementById("editWaveCanvas");
const editCtx = editCanvas.getContext("2d");
const unitWaveCanvas = document.getElementById("unitWaveCanvas");
const unitWaveCtx = unitWaveCanvas.getContext("2d");

// ------------------------------
// Audio state
// ------------------------------
let audioContext = null;
let mediaStream = null;
let mediaRecorder = null;
let recordedChunks = [];
let recordingStartTime = 0;
let recordingTimerId = null;

let currentSourceNode = null;
let currentGainNode = null;

let originalAudioBuffer = null;
let editedAudioBuffer = null;

let currentMaterialName = "";
let currentMaterialSource = "";

let playerState = {
  isPlaying: false,
  mode: "none",
  lastMode: "full",
  playStartSec: 0,
  playEndSec: 0,
  pausedAtSec: 0,
  startedAtPerf: 0,
  loopEnabled: false,
  playbackRate: 1.0,
};

let playbackAnimationFrame = null;
let currentPlayheadSample = null;
let isSeeking = false;

// ------------------------------
// View state
// ------------------------------
let viewStart = 0;
let viewEnd = 0;

let selectionStart = null;
let selectionEnd = null;
let draggingSelectionHandle = null;
const selectionHandleThresholdPx = 20;

let mainPointerState = new Map();
let pinchStartDistance = 0;
let pinchStartViewStart = 0;
let pinchStartViewEnd = 0;
let panLastCenterX = 0;
let singlePointerMoved = false;
let lastTapTime = 0;
let lastTapX = 0;

// ------------------------------
// Analysis state
// ------------------------------
let analysisState = {
  continuousRegions: [],
  transientEvents: [],
};

// ------------------------------
// Group state
// ------------------------------
let groupState = {
  boundaries: [],            // sample positions [b0,b1,b2...]
  groupStartSample: null,
  groupEndSample: null,
  cycleCount: 0,
  representativeIndex: null, // cycle index
  selectedCycleStart: null,
  selectedCycleEnd: null,
  unitOriginal: null,        // Float32Array normalized unit
  unitEdited: null,          // Float32Array normalized unit
};

let unitEditorState = {
  mode: "navigate", // navigate / draw
  isPointerDown: false,
  lastX: null,
  lastY: null,
};

// ------------------------------
// Edit mode state
// ------------------------------
let isEditMode = false;
let editSession = {
  startSample: null,
  endSample: null,
  viewStartSample: null,
  viewEndSample: null,
  interactionMode: "navigate",
  precisionMode: false,
  overlayMode: "overlay",
  snapshotBeforeEdit: null,
  historyStack: [],
};

let isEditPointerDown = false;
let editLastX = null;
let editLastY = null;

let editPointerState = new Map();
let editPinchStartDistance = 0;
let editPanLastCenterX = 0;
let editPinchStartViewStart = 0;
let editPinchStartViewEnd = 0;

// ------------------------------
// Canvas scaling
// ------------------------------
let dpr = Math.max(1, window.devicePixelRatio || 1);

// ------------------------------
// IndexedDB
// ------------------------------
const DB_NAME = "wave_voice_lab_db_v500";
const DB_VERSION = 1;
const STORE_NAME = "materials";

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("updatedAt", "updatedAt", { unique: false });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbPutMaterial(material) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(material);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function dbGetAllMaterials() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => {
      const items = req.result || [];
      items.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      resolve(items);
    };
    req.onerror = () => reject(req.error);
  });
}

async function dbGetMaterial(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbDeleteMaterial(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ------------------------------
// Utilities
// ------------------------------
function setStatus(msg) {
  statusEl.textContent = msg;
}

function ensureAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
}

async function unlockAudio() {
  ensureAudioContext();
  if (audioContext.state !== "running") {
    try {
      await audioContext.resume();
    } catch (err) {
      console.error("AudioContext resume failed", err);
    }
  }
}

function formatSec(sec) {
  if (!Number.isFinite(sec)) return "0.00s";
  return `${sec.toFixed(2)}s`;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function clampSample(v) {
  return Math.max(-1, Math.min(1, v));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function resampleArrayLinear(src, targetLength) {
  if (!src || targetLength <= 0) return new Float32Array(0);
  if (src.length === targetLength) return new Float32Array(src);
  if (src.length === 1) {
    const out = new Float32Array(targetLength);
    out.fill(src[0]);
    return out;
  }

  const out = new Float32Array(targetLength);
  const maxSrc = src.length - 1;

  for (let i = 0; i < targetLength; i++) {
    const pos = (i / Math.max(1, targetLength - 1)) * maxSrc;
    const i0 = Math.floor(pos);
    const i1 = Math.min(maxSrc, i0 + 1);
    const t = pos - i0;
    out[i] = lerp(src[i0], src[i1], t);
  }
  return out;
}

function normalizedCorrelation(a, b) {
  const n = Math.min(a.length, b.length);
  if (n <= 1) return 0;

  let sum = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < n; i++) {
    sum += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return sum / (Math.sqrt(na * nb) || 1e-9);
}

function generateId() {
  return `mat_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function formatDate(ts) {
  if (!ts) return "-";
  return new Date(ts).toLocaleString();
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function updateBrushLabels() {
  brushSizeValue.textContent = brushSizeInput.value;
  strengthValue.textContent = strengthInput.value;
  unitBrushSizeValue.textContent = unitBrushSizeInput.value;
  unitStrengthValue.textContent = unitStrengthInput.value;
}

function updateSpeedLabels() {
  const rate = parseFloat(speedSlider.value);
  speedLabel.textContent = `${rate.toFixed(2)}x`;
  playerState.playbackRate = rate;
  updatePlaybackInfoText();
}

function bootStatus() {
  setStatus("JS起動完了");
}

function updatePlaybackInfoText() {
  const modeLabel =
    playerState.lastMode === "selection"
      ? "選択範囲"
      : playerState.lastMode === "edit"
      ? "編集範囲"
      : "全体";

  playbackModeInfoEl.textContent =
    `再生対象: ${modeLabel} / ループ: ${playerState.loopEnabled ? "ON" : "OFF"} / 速度: ${playerState.playbackRate.toFixed(2)}x`;
}

function setEditInteractionMode(mode) {
  editSession.interactionMode = mode;
  editModeToggleBtn.textContent =
    mode === "navigate"
      ? "表示操作中（タップで編集操作へ）"
      : "編集操作中（タップで表示操作へ）";

  isEditPointerDown = false;
  editPointerState.clear();
}

function setUnitEditMode(mode) {
  unitEditorState.mode = mode;
  unitEditorState.isPointerDown = false;
  unitEditorState.lastX = null;
  unitEditorState.lastY = null;

  unitEditModeBtn.textContent =
    mode === "navigate"
      ? "周期表示操作中（タップで周期編集へ）"
      : "周期編集操作中（タップで表示操作へ）";
}

function updatePrecisionButton() {
  precisionToggleBtn.textContent = `精密表示: ${editSession.precisionMode ? "ON" : "OFF"}`;
}

function updateOverlayButton() {
  const map = {
    overlay: "表示: 重ね",
    edited: "表示: 編集後のみ",
    original: "表示: 元のみ",
  };
  overlayModeBtn.textContent = map[editSession.overlayMode];
}

function isAllowedAudioFile(file) {
  const name = (file.name || "").toLowerCase();
  const type = (file.type || "").toLowerCase();

  const allowedExt = [
    ".wav", ".mp3", ".m4a", ".aac", ".ogg", ".oga", ".flac", ".aif", ".aiff", ".webm"
  ];

  const hasAllowedExt = allowedExt.some(ext => name.endsWith(ext));
  const isAudioMime = type.startsWith("audio/");

  return hasAllowedExt || isAudioMime;
}

recordBtn.addEventListener("click", async () => {
  if (!mediaRecorder || mediaRecorder.state === "inactive") await startRecording();
  else stopRecording();
});

brushSizeInput.addEventListener("input", updateBrushLabels);
strengthInput.addEventListener("input", updateBrushLabels);
unitBrushSizeInput.addEventListener("input", updateBrushLabels);
unitStrengthInput.addEventListener("input", updateBrushLabels);
speedSlider.addEventListener("input", updateSpeedLabels);
updateBrushLabels();
updateSpeedLabels();

// ------------------------------
// Resize
// ------------------------------
function resizeCanvas(canvas, ctx) {
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.floor(rect.width * dpr);
  canvas.height = Math.floor(rect.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function resizeAllCanvases() {
  resizeCanvas(mainCanvas, mainCtx);
  resizeCanvas(editCanvas, editCtx);
  resizeCanvas(unitWaveCanvas, unitWaveCtx);
  drawMainWaveform();
  drawEditWaveform();
  drawUnitWaveform();
}

window.addEventListener("resize", resizeAllCanvases);
setTimeout(resizeAllCanvases, 50);

// ------------------------------
// AudioBuffer helpers
// ------------------------------
function toMonoBuffer(buffer) {
  const mono = audioContext.createBuffer(1, buffer.length, buffer.sampleRate);
  const monoData = mono.getChannelData(0);

  if (buffer.numberOfChannels === 1) {
    monoData.set(buffer.getChannelData(0));
  } else {
    for (let i = 0; i < buffer.length; i++) {
      let sum = 0;
      for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
        sum += buffer.getChannelData(ch)[i];
      }
      monoData[i] = sum / buffer.numberOfChannels;
    }
  }

  return mono;
}

function cloneAudioBuffer(buffer) {
  const copy = audioContext.createBuffer(
    buffer.numberOfChannels,
    buffer.length,
    buffer.sampleRate
  );
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    copy.getChannelData(ch).set(buffer.getChannelData(ch));
  }
  return copy;
}

function audioBufferToChannelArrays(buffer) {
  const channels = [];
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    channels.push(Array.from(buffer.getChannelData(ch)));
  }
  return {
    numberOfChannels: buffer.numberOfChannels,
    sampleRate: buffer.sampleRate,
    length: buffer.length,
    channels,
  };
}

function channelArraysToAudioBuffer(data) {
  ensureAudioContext();
  const buffer = audioContext.createBuffer(
    data.numberOfChannels,
    data.length,
    data.sampleRate
  );
  for (let ch = 0; ch < data.numberOfChannels; ch++) {
    buffer.getChannelData(ch).set(new Float32Array(data.channels[ch]));
  }
  return buffer;
}

// ------------------------------
// Analysis helpers
// ------------------------------
function computeEnergy(data, start, end) {
  let sum = 0;
  for (let i = start; i < end; i++) sum += data[i] * data[i];
  return sum / Math.max(1, end - start);
}

function computeZeroCrossRate(data, start, end) {
  let count = 0;
  for (let i = start + 1; i < end; i++) {
    if ((data[i - 1] >= 0 && data[i] < 0) || (data[i - 1] < 0 && data[i] >= 0)) count++;
  }
  return count / Math.max(1, end - start);
}

function computeAutocorrPeak(data, start, end, minLag, maxLag) {
  let best = 0;

  for (let lag = minLag; lag <= maxLag; lag++) {
    let sum = 0;
    let normA = 0;
    let normB = 0;

    for (let i = start; i < end - lag; i++) {
      const a = data[i];
      const b = data[i + lag];
      sum += a * b;
      normA += a * a;
      normB += b * b;
    }

    const denom = Math.sqrt(normA * normB) || 1e-9;
    best = Math.max(best, sum / denom);
  }

  return best;
}

function estimateLocalPeriodSamples(centerSample) {
  if (!editedAudioBuffer) return null;

  const data = editedAudioBuffer.getChannelData(0);
  const sr = editedAudioBuffer.sampleRate;

  const minLag = Math.max(1, Math.floor(sr / 400));
  const maxLag = Math.max(minLag + 1, Math.floor(sr / 70));
  const win = Math.max(maxLag * 4, Math.floor(sr * 0.04));

  const start = Math.max(0, centerSample - Math.floor(win / 2));
  const end = Math.min(data.length, centerSample + Math.floor(win / 2));

  let bestLag = null;
  let bestCorr = -Infinity;

  for (let lag = minLag; lag <= maxLag; lag++) {
    let sum = 0;
    let normA = 0;
    let normB = 0;

    for (let i = start; i < end - lag; i++) {
      const a = data[i];
      const b = data[i + lag];
      sum += a * b;
      normA += a * a;
      normB += b * b;
    }

    const corr = sum / (Math.sqrt(normA * normB) || 1e-9);
    if (corr > bestCorr) {
      bestCorr = corr;
      bestLag = lag;
    }
  }

  if (bestCorr < 0.2) return null;
  return bestLag;
}

function findNearestUpwardZeroCrossing(data, target, searchRadius) {
  const start = Math.max(1, target - searchRadius);
  const end = Math.min(data.length - 1, target + searchRadius);

  let bestIndex = null;
  let bestDist = Infinity;

  for (let i = start; i <= end; i++) {
    if (data[i - 1] <= 0 && data[i] > 0) {
      const dist = Math.abs(i - target);
      if (dist < bestDist) {
        bestDist = dist;
        bestIndex = i;
      }
    }
  }
  return bestIndex;
}

function findPrevUpwardZeroCrossing(data, startIndex, minStep, maxStep) {
  const start = Math.max(1, startIndex - maxStep);
  const end = Math.max(1, startIndex - minStep);
  for (let i = end; i >= start; i--) {
    if (data[i - 1] <= 0 && data[i] > 0) return i;
  }
  return null;
}

function findNextUpwardZeroCrossing(data, startIndex, minStep, maxStep) {
  const start = Math.max(1, startIndex + minStep);
  const end = Math.min(data.length - 1, startIndex + maxStep);
  for (let i = start; i <= end; i++) {
    if (data[i - 1] <= 0 && data[i] > 0) return i;
  }
  return null;
}

function extractOneCycleAround(sample) {
  if (!editedAudioBuffer) return null;

  const data = editedAudioBuffer.getChannelData(0);
  const sr = editedAudioBuffer.sampleRate;
  const period = estimateLocalPeriodSamples(sample);
  if (!period) return null;

  const anchor = findNearestUpwardZeroCrossing(data, sample, Math.max(8, Math.floor(period * 0.6)));
  if (anchor == null) return null;

  const prev = findPrevUpwardZeroCrossing(
    data,
    anchor,
    Math.max(1, Math.floor(period * 0.5)),
    Math.max(2, Math.floor(period * 1.5))
  );

  const next = findNextUpwardZeroCrossing(
    data,
    anchor,
    Math.max(1, Math.floor(period * 0.5)),
    Math.max(2, Math.floor(period * 1.5))
  );

  let start = anchor;
  let end = next;

  if (next == null && prev != null) {
    start = prev;
    end = anchor;
  }

  if (end == null || end <= start) return null;

  return {
    startSample: start,
    endSample: end,
    length: end - start,
    sec: (end - start) / sr
  };
}

function analyzeSelectedRegion() {
  if (!editedAudioBuffer || editSession.startSample == null || editSession.endSample == null) return;

  const data = editedAudioBuffer.getChannelData(0);
  const sampleRate = editedAudioBuffer.sampleRate;
  const startSample = editSession.startSample;
  const endSample = editSession.endSample;

  analysisState.continuousRegions = [];
  analysisState.transientEvents = [];
  clearGroup();

  const winSize = Math.max(32, Math.floor(sampleRate * 0.02));
  const hopSize = Math.max(16, Math.floor(sampleRate * 0.01));
  const minLag = Math.max(1, Math.floor(sampleRate / 400));
  const maxLag = Math.max(minLag + 1, Math.floor(sampleRate / 70));

  const frames = [];

  for (let s = startSample; s + winSize < endSample; s += hopSize) {
    const e = s + winSize;
    frames.push({
      start: s,
      end: e,
      energy: computeEnergy(data, s, e),
      zcr: computeZeroCrossRate(data, s, e),
      periodicity: computeAutocorrPeak(data, s, e, minLag, maxLag),
    });
  }

  if (!frames.length) {
    updateAnalysisButtons();
    drawEditWaveform();
    return;
  }

  const avgEnergy = frames.reduce((a, f) => a + f.energy, 0) / frames.length;
  const avgZcr = frames.reduce((a, f) => a + f.zcr, 0) / frames.length;

  let currentRegion = null;

  for (const f of frames) {
    const isContinuous =
      f.energy > avgEnergy * 0.35 &&
      f.periodicity > 0.45 &&
      f.zcr < avgZcr * 1.3;

    if (isContinuous) {
      if (!currentRegion) currentRegion = { startSample: f.start, endSample: f.end };
      else currentRegion.endSample = f.end;
    } else {
      if (currentRegion && currentRegion.endSample - currentRegion.startSample > winSize * 1.5) {
        analysisState.continuousRegions.push(currentRegion);
      }
      currentRegion = null;
    }
  }

  if (currentRegion && currentRegion.endSample - currentRegion.startSample > winSize * 1.5) {
    analysisState.continuousRegions.push(currentRegion);
  }

  for (let i = 1; i < frames.length; i++) {
    const prev = frames[i - 1];
    const cur = frames[i];
    const energyRise = cur.energy / Math.max(prev.energy, 1e-9);
    const zcrJump = Math.abs(cur.zcr - prev.zcr);
    if (energyRise > 1.8 || zcrJump > avgZcr * 0.35) {
      analysisState.transientEvents.push({ sample: cur.start });
    }
  }

  updateAnalysisButtons();
  drawEditWaveform();
  setStatus("この編集範囲を解析しました");
}

// ------------------------------
// Group extraction
// ------------------------------
function clearGroup() {
  groupState.boundaries = [];
  groupState.groupStartSample = null;
  groupState.groupEndSample = null;
  groupState.cycleCount = 0;
  groupState.representativeIndex = null;
  groupState.selectedCycleStart = null;
  groupState.selectedCycleEnd = null;
  groupState.unitOriginal = null;
  groupState.unitEdited = null;

  groupInfoText.textContent = "周期グループ: なし";
  unitInfoText.textContent = "代表周期: なし";
  updateGroupButtons();
  drawUnitWaveform();
  drawEditWaveform();
}

function updateGroupButtons() {
  const hasUnit = !!groupState.unitEdited;
  const hasGroup = groupState.cycleCount > 0;

  playUnitBtn.disabled = !hasUnit;
  groupPlayBtn.disabled = !hasGroup;
  clearGroupBtn.disabled = !hasGroup;
  unitEditModeBtn.disabled = !hasUnit;
  applyUnitToGroupBtn.disabled = !hasUnit || !hasGroup;
}

function getCycleArray(startSample, endSample) {
  const data = editedAudioBuffer.getChannelData(0);
  return data.slice(startSample, endSample);
}

function tryBuildGroupFromTap(sample) {
  const region = analysisState.continuousRegions.find(
    r => sample >= r.startSample && sample <= r.endSample
  );
  if (!region) return false;

  const baseCycle = extractOneCycleAround(sample);
  if (!baseCycle) return false;

  const data = editedAudioBuffer.getChannelData(0);
  const boundaries = [baseCycle.startSample, baseCycle.endSample];
  const baseArray = getCycleArray(baseCycle.startSample, baseCycle.endSample);
  const baseNorm = resampleArrayLinear(baseArray, 128);

  // extend left
  let currentStart = baseCycle.startSample;
  let currentLen = baseCycle.length;
  while (true) {
    const prevStart = findPrevUpwardZeroCrossing(
      data,
      currentStart,
      Math.max(1, Math.floor(currentLen * 0.5)),
      Math.max(2, Math.floor(currentLen * 1.5))
    );
    if (prevStart == null) break;
    if (prevStart < region.startSample) break;

    const arr = getCycleArray(prevStart, currentStart);
    if (arr.length < 4) break;

    const norm = resampleArrayLinear(arr, 128);
    const sim = normalizedCorrelation(baseNorm, norm);
    const lenRatio = arr.length / Math.max(1, baseCycle.length);

    if (sim < 0.78 || lenRatio < 0.6 || lenRatio > 1.6) break;

    boundaries.unshift(prevStart);
    currentLen = currentStart - prevStart;
    currentStart = prevStart;
  }

  // extend right
  let currentEnd = baseCycle.endSample;
  currentLen = baseCycle.length;
  while (true) {
    const nextEnd = findNextUpwardZeroCrossing(
      data,
      currentEnd,
      Math.max(1, Math.floor(currentLen * 0.5)),
      Math.max(2, Math.floor(currentLen * 1.5))
    );
    if (nextEnd == null) break;
    if (nextEnd > region.endSample) break;

    const arr = getCycleArray(currentEnd, nextEnd);
    if (arr.length < 4) break;

    const norm = resampleArrayLinear(arr, 128);
    const sim = normalizedCorrelation(baseNorm, norm);
    const lenRatio = arr.length / Math.max(1, baseCycle.length);

    if (sim < 0.78 || lenRatio < 0.6 || lenRatio > 1.6) break;

    boundaries.push(nextEnd);
    currentLen = nextEnd - currentEnd;
    currentEnd = nextEnd;
  }

  if (boundaries.length < 2) return false;

  const cycles = boundaries.length - 1;
  let repIndex = 0;
  for (let i = 0; i < cycles; i++) {
    const s = boundaries[i];
    const e = boundaries[i + 1];
    if (sample >= s && sample <= e) {
      repIndex = i;
      break;
    }
  }

  const repStart = boundaries[repIndex];
  const repEnd = boundaries[repIndex + 1];
  const repOriginal = getCycleArray(repStart, repEnd);
  const repEdited = new Float32Array(repOriginal);

  groupState.boundaries = boundaries;
  groupState.groupStartSample = boundaries[0];
  groupState.groupEndSample = boundaries[boundaries.length - 1];
  groupState.cycleCount = cycles;
  groupState.representativeIndex = repIndex;
  groupState.selectedCycleStart = repStart;
  groupState.selectedCycleEnd = repEnd;
  groupState.unitOriginal = repOriginal;
  groupState.unitEdited = repEdited;

  groupInfoText.textContent =
    `周期グループ: ${cycles}周期 / ${((groupState.groupEndSample - groupState.groupStartSample) / editedAudioBuffer.sampleRate).toFixed(4)}s`;

  unitInfoText.textContent =
    `代表周期: ${((repEnd - repStart) / editedAudioBuffer.sampleRate).toFixed(5)}s (${repEnd - repStart} samples)`;

  updateGroupButtons();
  drawUnitWaveform();
  drawEditWaveform();
  setStatus("周期グループを抽出しました");
  return true;
}

function applyUnitEditsToGroup() {
  if (!editedAudioBuffer || !groupState.unitEdited || groupState.boundaries.length < 2) return;

  const data = editedAudioBuffer.getChannelData(0);
  const unit = groupState.unitEdited;

  for (let i = 0; i < groupState.boundaries.length - 1; i++) {
    const s = groupState.boundaries[i];
    const e = groupState.boundaries[i + 1];
    const len = e - s;
    if (len <= 1) continue;

    const mapped = resampleArrayLinear(unit, len);
    for (let k = 0; k < len; k++) {
      data[s + k] = clampSample(mapped[k]);
    }
  }

  drawMainWaveform();
  drawEditWaveform();
  setStatus("代表周期の編集を全周期へ反映しました");
}

// ------------------------------
// Unit editor
// ------------------------------
function getUnitCanvasLocalPos(event) {
  const rect = unitWaveCanvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}

function unitCanvasXToIndex(x) {
  if (!groupState.unitEdited) return 0;
  const width = unitWaveCanvas.clientWidth;
  const ratio = clamp(x / Math.max(1, width), 0, 1);
  return Math.floor(ratio * (groupState.unitEdited.length - 1));
}

function unitCanvasYToAmplitude(y) {
  const height = unitWaveCanvas.clientHeight;
  return clamp(1 - (y / Math.max(1, height)) * 2, -1, 1);
}

function applyUnitBrushAt(x, y) {
  if (!groupState.unitEdited) return;

  const idx = unitCanvasXToIndex(x);
  const amp = unitCanvasYToAmplitude(y);
  const radius = parseInt(unitBrushSizeInput.value, 10);
  const strength = parseInt(unitStrengthInput.value, 10) / 100;

  const data = groupState.unitEdited;
  const start = Math.max(0, idx - radius);
  const end = Math.min(data.length - 1, idx + radius);

  for (let i = start; i <= end; i++) {
    const dist = Math.abs(i - idx) / Math.max(1, radius);
    const weight = Math.max(0, 1 - dist);
    const mix = weight * strength;
    data[i] = clampSample(data[i] * (1 - mix) + amp * mix);
  }
}

function drawUnitWaveform() {
  const width = unitWaveCanvas.clientWidth;
  const height = unitWaveCanvas.clientHeight;

  unitWaveCtx.clearRect(0, 0, width, height);
  unitWaveCtx.fillStyle = "#fafafa";
  unitWaveCtx.fillRect(0, 0, width, height);

  unitWaveCtx.strokeStyle = "#d0d0d0";
  unitWaveCtx.lineWidth = 1;
  unitWaveCtx.beginPath();
  unitWaveCtx.moveTo(0, height / 2);
  unitWaveCtx.lineTo(width, height / 2);
  unitWaveCtx.stroke();

  if (!groupState.unitEdited || !groupState.unitOriginal) {
    unitWaveCtx.fillStyle = "#888";
    unitWaveCtx.font = "14px sans-serif";
    unitWaveCtx.fillText("周期グループをタップすると代表周期がここに表示されます", 16, height / 2 - 8);
    return;
  }

  const orig = groupState.unitOriginal;
  const edited = groupState.unitEdited;
  const n = Math.max(orig.length, edited.length);

  unitWaveCtx.strokeStyle = "rgba(220,40,40,0.85)";
  unitWaveCtx.lineWidth = 1.2;
  unitWaveCtx.beginPath();
  for (let i = 0; i < orig.length; i++) {
    const x = (i / Math.max(1, orig.length - 1)) * width;
    const y = ((1 - orig[i]) * 0.5) * height;
    if (i === 0) unitWaveCtx.moveTo(x, y);
    else unitWaveCtx.lineTo(x, y);
  }
  unitWaveCtx.stroke();

  unitWaveCtx.strokeStyle = "rgba(20,20,20,0.98)";
  unitWaveCtx.lineWidth = 1.8;
  unitWaveCtx.beginPath();
  for (let i = 0; i < edited.length; i++) {
    const x = (i / Math.max(1, edited.length - 1)) * width;
    const y = ((1 - edited[i]) * 0.5) * height;
    if (i === 0) unitWaveCtx.moveTo(x, y);
    else unitWaveCtx.lineTo(x, y);
  }
  unitWaveCtx.stroke();

  if (edited.length <= 300) {
    unitWaveCtx.fillStyle = "rgba(20,20,20,0.98)";
    for (let i = 0; i < edited.length; i++) {
      const x = (i / Math.max(1, edited.length - 1)) * width;
      const y = ((1 - edited[i]) * 0.5) * height;
      unitWaveCtx.beginPath();
      unitWaveCtx.arc(x, y, 2, 0, Math.PI * 2);
      unitWaveCtx.fill();
    }
  }
}

// ------------------------------
// Loading audio
// ------------------------------
async function decodeFileToAudioBuffer(file) {
  await unlockAudio();
  const arrayBuffer = await file.arrayBuffer();
  return await audioContext.decodeAudioData(arrayBuffer.slice(0));
}

function resetSelectionDefault() {
  if (!editedAudioBuffer) {
    selectionStart = null;
    selectionEnd = null;
    return;
  }

  const len = editedAudioBuffer.length;
  selectionStart = Math.floor(len * 0.25);
  selectionEnd = Math.floor(len * 0.35);
  updateSelectionInfo();
}

function loadDecodedBuffer(decoded, label = "読込完了", source = "") {
  originalAudioBuffer = toMonoBuffer(decoded);
  editedAudioBuffer = cloneAudioBuffer(originalAudioBuffer);

  currentMaterialSource = source;
  currentMaterialName = currentMaterialName || label;
  saveNameInput.value = currentMaterialName;

  analysisState.continuousRegions = [];
  analysisState.transientEvents = [];
  clearGroup();
  resetView();
  resetSelectionDefault();
  stopPlayback();
  updateMainUIState();
  drawMainWaveform();
  drawEditWaveform();
  setStatus(label);
  fileInfoEl.textContent = `${source}: ${currentMaterialName}`;
}

async function handleFileLoad(file, sourceLabel = "音声ファイル") {
  if (!file) return;

  currentMaterialName = file.name;
  saveNameInput.value = file.name;
  fileInfoEl.textContent = `${sourceLabel}: ${file.name} / ${file.type || "type不明"}`;
  setStatus("ファイル読込中...");

  try {
    const decoded = await decodeFileToAudioBuffer(file);
    loadDecodedBuffer(decoded, `${sourceLabel}読込完了`, sourceLabel);
  } catch (err) {
    console.error(err);
    setStatus("ファイル読込失敗");
    alert("読み込みに失敗しました。mp3 / wav / m4a などで試してください。");
  }
}

window.handleAudioFileInline = async function (event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  if (!isAllowedAudioFile(file)) {
    alert("音声ファイルのみ選択できます。");
    fileInfoEl.textContent = "音声以外のファイルは読み込めません";
    setStatus("音声ファイルを選択してください");
    event.target.value = "";
    return;
  }

  fileInfoEl.textContent = `音声ファイル: ${file.name} / ${file.type || "type不明"}`;
  setStatus("ファイル読込中...");

  try {
    await handleFileLoad(file, "音声ファイル");
  } catch (err) {
    console.error(err);
    setStatus("ファイル読込失敗");
    alert("ファイルの読み込みに失敗しました。");
  }

  event.target.value = "";
};

// ------------------------------
// Recording
// ------------------------------
async function startRecording() {
  try {
    await unlockAudio();

    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(mediaStream);
    recordedChunks = [];

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) recordedChunks.push(event.data);
    };

    mediaRecorder.onstop = async () => {
      try {
        const blob = new Blob(recordedChunks, { type: mediaRecorder.mimeType || "audio/webm" });
        const fileLike = new File([blob], "recorded_audio.webm", { type: blob.type });

        if (!isAllowedAudioFile(fileLike)) {
          setStatus("録音データ形式が不正です");
          return;
        }

        const decoded = await decodeFileToAudioBuffer(fileLike);
        currentMaterialName = `record_${new Date().toISOString().replace(/[:.]/g, "-")}`;
        saveNameInput.value = currentMaterialName;
        fileInfoEl.textContent = "マイク録音データ";
        loadDecodedBuffer(decoded, "録音完了", "録音");
      } catch (err) {
        console.error(err);
        setStatus("録音データの解析に失敗");
        alert("録音データの読み込みに失敗しました。");
      }
    };

    mediaRecorder.start();
    recordingStartTime = performance.now();
    recordingTimerId = setInterval(updateRecordingTime, 100);

    recordBtn.textContent = "録音停止";
    setStatus("録音中...");
    fileInfoEl.textContent = "マイク録音中";
  } catch (err) {
    console.error(err);
    setStatus("マイク利用に失敗");
    alert("マイク利用に失敗しました。ブラウザのマイク許可を確認してください。");
  }
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== "inactive") mediaRecorder.stop();
  if (mediaStream) {
    mediaStream.getTracks().forEach(track => track.stop());
    mediaStream = null;
  }
  if (recordingTimerId) {
    clearInterval(recordingTimerId);
    recordingTimerId = null;
  }

  recordBtn.textContent = "録音開始";
  timeInfoEl.textContent = "録音時間: 0.0 秒";
}

function updateRecordingTime() {
  const sec = (performance.now() - recordingStartTime) / 1000;
  timeInfoEl.textContent = `録音時間: ${sec.toFixed(1)} 秒`;
}

// ------------------------------
// Player helpers
// ------------------------------
function getBufferDuration() {
  return editedAudioBuffer ? editedAudioBuffer.duration : 0;
}

function getModeRange(mode) {
  if (!editedAudioBuffer) return { startSec: 0, endSec: 0 };

  if (mode === "selection" && selectionStart != null && selectionEnd != null) {
    return {
      startSec: Math.min(selectionStart, selectionEnd) / editedAudioBuffer.sampleRate,
      endSec: Math.max(selectionStart, selectionEnd) / editedAudioBuffer.sampleRate,
    };
  }

  if (mode === "edit" && isEditMode && editSession.startSample != null && editSession.endSample != null) {
    return {
      startSec: editSession.startSample / editedAudioBuffer.sampleRate,
      endSec: editSession.endSample / editedAudioBuffer.sampleRate,
    };
  }

  return { startSec: 0, endSec: editedAudioBuffer.duration };
}

function getCurrentPlaybackSec() {
  if (!playerState.isPlaying) return playerState.pausedAtSec || 0;
  const elapsedRealSec = (performance.now() - playerState.startedAtPerf) / 1000;
  const progressedAudioSec = elapsedRealSec * playerState.playbackRate;
  return clamp(playerState.playStartSec + progressedAudioSec, 0, playerState.playEndSec);
}

function stopPlaybackAnimation() {
  if (playbackAnimationFrame) {
    cancelAnimationFrame(playbackAnimationFrame);
    playbackAnimationFrame = null;
  }
}

function updatePlayerUI() {
  const duration = getBufferDuration();
  const current = getCurrentPlaybackSec();

  currentTimeLabel.textContent = formatSec(current);
  durationLabel.textContent = formatSec(duration);
  playbackTimeInfoEl.textContent = `再生位置: ${formatSec(current)}`;

  if (!isSeeking) seekBar.value = duration > 0 ? (current / duration) : 0;

  currentPlayheadSample = editedAudioBuffer
    ? Math.floor(current * editedAudioBuffer.sampleRate)
    : null;

  drawMainWaveform();
  if (isEditMode) drawEditWaveform();
}

function animatePlayback() {
  updatePlayerUI();
  if (!playerState.isPlaying) return;

  const cur = getCurrentPlaybackSec();
  if (cur >= playerState.playEndSec - 0.002) {
    updatePlayerUI();
    return;
  }

  playbackAnimationFrame = requestAnimationFrame(animatePlayback);
}

async function startPlaybackFrom(positionSec, mode = "full") {
  if (!editedAudioBuffer) return;

  await unlockAudio();
  stopCurrentSourceOnly();

  const { startSec: rangeStart, endSec: rangeEnd } = getModeRange(mode);
  const startSec = clamp(positionSec, rangeStart, rangeEnd);
  const endSec = rangeEnd;

  if (endSec <= startSec) {
    setStatus("再生範囲が不正です");
    return;
  }

  const source = audioContext.createBufferSource();
  const gainNode = audioContext.createGain();
  source.buffer = editedAudioBuffer;
  source.playbackRate.value = playerState.playbackRate;
  gainNode.gain.value = 1.0;
  source.connect(gainNode);
  gainNode.connect(audioContext.destination);

  currentSourceNode = source;
  currentGainNode = gainNode;

  playerState.isPlaying = true;
  playerState.mode = mode;
  playerState.lastMode = mode;
  playerState.playStartSec = startSec;
  playerState.playEndSec = endSec;
  playerState.pausedAtSec = startSec;
  playerState.startedAtPerf = performance.now();

  updatePlaybackInfoText();
  setStatus("再生中...");

  source.onended = () => {
    if (currentSourceNode !== source) return;
    if (!playerState.isPlaying) return;

    if (playerState.loopEnabled) {
      startPlaybackFrom(rangeStart, mode);
    } else {
      playerState.isPlaying = false;
      playerState.pausedAtSec = rangeEnd;
      stopCurrentSourceOnly();
      stopPlaybackAnimation();
      setStatus("再生終了");
      updatePlayerUI();
    }
  };

  try {
    source.start(0, startSec, (endSec - startSec) / playerState.playbackRate);
  } catch (err) {
    console.error(err);
    setStatus("再生失敗");
    alert("再生に失敗しました。");
    return;
  }

  stopPlaybackAnimation();
  playbackAnimationFrame = requestAnimationFrame(animatePlayback);
  updatePlayerUI();
}

function stopCurrentSourceOnly() {
  if (currentSourceNode) {
    try { currentSourceNode.stop(); } catch (_) {}
  }
  currentSourceNode = null;
  currentGainNode = null;
}

function pausePlayback() {
  if (!playerState.isPlaying) return;
  playerState.pausedAtSec = getCurrentPlaybackSec();
  playerState.isPlaying = false;
  stopCurrentSourceOnly();
  stopPlaybackAnimation();
  setStatus("一時停止");
  updatePlayerUI();
}

function stopPlayback(fromEnded = false) {
  if (playerState.isPlaying || currentSourceNode) stopCurrentSourceOnly();

  stopPlaybackAnimation();
  playerState.isPlaying = false;
  playerState.mode = "none";
  playerState.playStartSec = 0;
  playerState.playEndSec = 0;
  playerState.startedAtPerf = 0;

  if (!fromEnded) {
    const { startSec } = getModeRange(playerState.lastMode || "full");
    playerState.pausedAtSec = startSec;
    setStatus("停止");
  } else {
    setStatus("再生終了");
  }

  updatePlayerUI();
  updatePlaybackInfoText();
}

async function playCurrent() {
  if (!editedAudioBuffer) return;
  const mode = playerState.lastMode || "full";
  const { startSec, endSec } = getModeRange(mode);
  const start = clamp(playerState.pausedAtSec || startSec, startSec, endSec);
  await startPlaybackFrom(start, mode);
}

async function playSelection() {
  if (!editedAudioBuffer || selectionStart == null || selectionEnd == null) return;
  const start = Math.min(selectionStart, selectionEnd) / editedAudioBuffer.sampleRate;
  playerState.lastMode = "selection";
  updatePlaybackInfoText();
  await startPlaybackFrom(start, "selection");
}

async function playEditRange() {
  if (!isEditMode || !editedAudioBuffer || editSession.startSample == null || editSession.endSample == null) return;
  const start = editSession.startSample / editedAudioBuffer.sampleRate;
  playerState.lastMode = "edit";
  updatePlaybackInfoText();
  await startPlaybackFrom(start, "edit");
}

async function playContinuousRegions() {
  if (!editedAudioBuffer || !analysisState.continuousRegions.length) return;
  const first = analysisState.continuousRegions[0];
  const startSec = first.startSample / editedAudioBuffer.sampleRate;
  const endSec = first.endSample / editedAudioBuffer.sampleRate;
  playerState.lastMode = "full";
  await startPlaybackFrom(startSec, "full");
  playerState.playEndSec = endSec;
  setStatus("連続区間を再生中");
}

async function playTransientEvents() {
  if (!editedAudioBuffer || !analysisState.transientEvents.length) return;
  const ev = analysisState.transientEvents[0];
  const centerSec = ev.sample / editedAudioBuffer.sampleRate;
  const startSec = Math.max(0, centerSec - 0.03);
  const endSec = Math.min(editedAudioBuffer.duration, centerSec + 0.05);
  playerState.lastMode = "full";
  await startPlaybackFrom(startSec, "full");
  playerState.playEndSec = endSec;
  setStatus("瞬時イベントを再生中");
}

async function playSelectedUnit() {
  if (!editedAudioBuffer || !groupState.selectedCycleStart || !groupState.selectedCycleEnd) return;
  const startSec = groupState.selectedCycleStart / editedAudioBuffer.sampleRate;
  const endSec = groupState.selectedCycleEnd / editedAudioBuffer.sampleRate;
  playerState.lastMode = "full";
  await startPlaybackFrom(startSec, "full");
  playerState.playEndSec = endSec;
  setStatus("代表周期を再生中");
}

async function playGroup() {
  if (!editedAudioBuffer || !groupState.groupStartSample || !groupState.groupEndSample) return;
  const startSec = groupState.groupStartSample / editedAudioBuffer.sampleRate;
  const endSec = groupState.groupEndSample / editedAudioBuffer.sampleRate;
  playerState.lastMode = "full";
  await startPlaybackFrom(startSec, "full");
  playerState.playEndSec = endSec;
  setStatus("周期グループを再生中");
}

function seekTo(sec) {
  if (!editedAudioBuffer) return;
  const mode = playerState.isPlaying ? playerState.mode : (playerState.lastMode || "full");
  const { startSec, endSec } = getModeRange(mode);
  const newSec = clamp(sec, startSec, endSec);
  playerState.pausedAtSec = newSec;

  if (playerState.isPlaying) startPlaybackFrom(newSec, mode);
  else updatePlayerUI();
}

function skipBy(deltaSec) {
  if (!editedAudioBuffer) return;
  const mode = playerState.isPlaying ? playerState.mode : (playerState.lastMode || "full");
  const { startSec, endSec } = getModeRange(mode);
  const cur = getCurrentPlaybackSec();
  seekTo(clamp(cur + deltaSec, startSec, endSec));
}

function toggleLoop() {
  playerState.loopEnabled = !playerState.loopEnabled;
  const label = `ループ: ${playerState.loopEnabled ? "ON" : "OFF"}`;
  loopToggleBtn.textContent = label;
  editLoopToggleBtn.textContent = label;
  updatePlaybackInfoText();
}

// ------------------------------
// Main view
// ------------------------------
function resetView() {
  if (!editedAudioBuffer) {
    viewStart = 0;
    viewEnd = 0;
    updateViewInfo();
    return;
  }

  viewStart = 0;
  viewEnd = editedAudioBuffer.length;
  updateViewInfo();
}

function updateViewInfo() {
  if (!editedAudioBuffer) {
    viewInfoEl.textContent = "表示範囲: なし";
    return;
  }

  const total = editedAudioBuffer.length;
  const startRatio = ((viewStart / total) * 100).toFixed(3);
  const endRatio = ((viewEnd / total) * 100).toFixed(3);
  const startSec = (viewStart / editedAudioBuffer.sampleRate).toFixed(4);
  const endSec = (viewEnd / editedAudioBuffer.sampleRate).toFixed(4);
  viewInfoEl.textContent = `表示範囲: ${startRatio}% ～ ${endRatio}% (${startSec}s ～ ${endSec}s)`;
}

function updateSelectionInfo() {
  if (!editedAudioBuffer || selectionStart == null || selectionEnd == null) {
    selectionInfoEl.textContent = "選択範囲: なし";
    updateMainUIState();
    return;
  }

  const s = Math.min(selectionStart, selectionEnd);
  const e = Math.max(selectionStart, selectionEnd);
  const lenSec = (e - s) / editedAudioBuffer.sampleRate;

  selectionInfoEl.textContent =
    `選択範囲: ${(s / editedAudioBuffer.sampleRate).toFixed(4)}s ～ ${(e / editedAudioBuffer.sampleRate).toFixed(4)}s / 長さ ${lenSec.toFixed(4)}s`;

  updateMainUIState();
}

function scrollView(direction) {
  if (!editedAudioBuffer) return;
  const currentLength = viewEnd - viewStart;
  const shift = Math.floor(currentLength * 0.25) * direction;

  let newStart = viewStart + shift;
  let newEnd = viewEnd + shift;

  if (newStart < 0) {
    newEnd -= newStart;
    newStart = 0;
  }
  if (newEnd > editedAudioBuffer.length) {
    const over = newEnd - editedAudioBuffer.length;
    newStart -= over;
    newEnd = editedAudioBuffer.length;
  }

  viewStart = clamp(newStart, 0, editedAudioBuffer.length);
  viewEnd = clamp(newEnd, 0, editedAudioBuffer.length);

  updateViewInfo();
  drawMainWaveform();
}

function zoomView(factor, centerSample = null) {
  if (!editedAudioBuffer) return;

  const currentLength = viewEnd - viewStart;
  const center = centerSample == null ? viewStart + currentLength / 2 : centerSample;
  let newLength = Math.floor(currentLength * factor);

  newLength = clamp(newLength, 8, editedAudioBuffer.length);

  let newStart = Math.floor(center - newLength / 2);
  let newEnd = Math.floor(center + newLength / 2);

  if (newStart < 0) {
    newEnd -= newStart;
    newStart = 0;
  }
  if (newEnd > editedAudioBuffer.length) {
    const over = newEnd - editedAudioBuffer.length;
    newStart -= over;
    newEnd = editedAudioBuffer.length;
  }

  viewStart = clamp(newStart, 0, editedAudioBuffer.length);
  viewEnd = clamp(newEnd, 0, editedAudioBuffer.length);
  updateViewInfo();
  drawMainWaveform();
}

function zoomToSelection() {
  if (!editedAudioBuffer || selectionStart == null || selectionEnd == null) return;
  const s = Math.min(selectionStart, selectionEnd);
  const e = Math.max(selectionStart, selectionEnd);
  if (e - s < 2) return;
  viewStart = s;
  viewEnd = e;
  updateViewInfo();
  drawMainWaveform();
}

// ------------------------------
// Edit view
// ------------------------------
function resetEditView() {
  if (!isEditMode) return;
  editSession.viewStartSample = editSession.startSample;
  editSession.viewEndSample = editSession.endSample;
  drawEditWaveform();
}

function getEditMinLength() {
  return editSession.precisionMode ? 1 : 8;
}

function zoomEditView(factor, centerSample = null) {
  if (!isEditMode || !editedAudioBuffer) return;

  const absoluteStart = editSession.startSample;
  const absoluteEnd = editSession.endSample;

  const currentLength = editSession.viewEndSample - editSession.viewStartSample;
  const center = centerSample == null
    ? editSession.viewStartSample + currentLength / 2
    : centerSample;

  let newLength = Math.floor(currentLength * factor);
  newLength = clamp(newLength, getEditMinLength(), Math.max(1, absoluteEnd - absoluteStart));

  let newStart = Math.floor(center - newLength / 2);
  let newEnd = Math.floor(center + newLength / 2);

  if (newStart < absoluteStart) {
    newEnd += absoluteStart - newStart;
    newStart = absoluteStart;
  }
  if (newEnd > absoluteEnd) {
    newStart -= newEnd - absoluteEnd;
    newEnd = absoluteEnd;
  }

  editSession.viewStartSample = clamp(newStart, absoluteStart, absoluteEnd);
  editSession.viewEndSample = clamp(newEnd, absoluteStart, absoluteEnd);
  drawEditWaveform();
}

// ------------------------------
// Canvas mapping
// ------------------------------
function mainCanvasXToSample(x) {
  if (!editedAudioBuffer) return 0;
  const width = mainCanvas.clientWidth;
  return Math.floor(viewStart + clamp(x / width, 0, 1) * (viewEnd - viewStart));
}

function sampleToMainCanvasX(sample) {
  if (viewEnd === viewStart) return 0;
  return ((sample - viewStart) / (viewEnd - viewStart)) * mainCanvas.clientWidth;
}

function getMainCanvasLocalPos(event) {
  const rect = mainCanvas.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function getEditCanvasLocalPos(event) {
  const rect = editCanvas.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function distanceBetweenTouches(points) {
  if (points.length < 2) return 0;
  const dx = points[0].x - points[1].x;
  const dy = points[0].y - points[1].y;
  return Math.sqrt(dx * dx + dy * dy);
}

function centerBetweenTouches(points) {
  if (!points.length) return 0;
  return points.reduce((sum, p) => sum + p.x, 0) / points.length;
}

function editCanvasXToSample(x) {
  if (!editedAudioBuffer || editSession.viewStartSample == null || editSession.viewEndSample == null) return 0;
  const width = editCanvas.clientWidth;
  return Math.floor(editSession.viewStartSample + clamp(x / width, 0, 1) * (editSession.viewEndSample - editSession.viewStartSample));
}

function editCanvasYToAmplitude(y) {
  return clamp(1 - (y / editCanvas.clientHeight) * 2, -1, 1);
}

// ------------------------------
// Waveform drawing
// ------------------------------
function drawWaveformToCanvas(ctx, canvas, buffer, startSample, endSample) {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#fafafa";
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "#d0d0d0";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, height / 2);
  ctx.lineTo(width, height / 2);
  ctx.stroke();

  if (!buffer) {
    ctx.fillStyle = "#888";
    ctx.font = "16px sans-serif";
    ctx.fillText("ここに波形が表示されます", 20, height / 2 - 10);
    return;
  }

  const data = buffer.getChannelData(0);
  const samplesPerPixel = Math.max(1, Math.floor((endSample - startSample) / width));

  ctx.strokeStyle = "#111";
  ctx.lineWidth = 1;

  for (let x = 0; x < width; x++) {
    const s = startSample + x * samplesPerPixel;
    const e = Math.min(s + samplesPerPixel, endSample);

    let min = 1;
    let max = -1;
    for (let i = s; i < e; i++) {
      const v = data[i];
      if (v < min) min = v;
      if (v > max) max = v;
    }

    const y1 = ((1 - max) * 0.5) * height;
    const y2 = ((1 - min) * 0.5) * height;

    ctx.beginPath();
    ctx.moveTo(x, y1);
    ctx.lineTo(x, y2);
    ctx.stroke();
  }
}

function drawPreciseLine(ctx, data, startSample, endSample, width, height, strokeStyle, lineWidth = 1.4) {
  const range = endSample - startSample;
  if (range <= 0) return;

  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();

  for (let i = startSample; i <= endSample; i++) {
    const x = ((i - startSample) / Math.max(1, range)) * width;
    const y = ((1 - data[i]) * 0.5) * height;
    if (i === startSample) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

function drawEditWaveBackground() {
  const width = editCanvas.clientWidth;
  const height = editCanvas.clientHeight;

  editCtx.clearRect(0, 0, width, height);
  editCtx.fillStyle = "#fafafa";
  editCtx.fillRect(0, 0, width, height);

  editCtx.strokeStyle = "#d0d0d0";
  editCtx.lineWidth = 1;
  editCtx.beginPath();
  editCtx.moveTo(0, height / 2);
  editCtx.lineTo(width, height / 2);
  editCtx.stroke();

  if (!editSession.precisionMode) return;

  editCtx.strokeStyle = "rgba(0,0,0,0.08)";
  for (let i = 1; i < 8; i++) {
    const x = (width / 8) * i;
    editCtx.beginPath();
    editCtx.moveTo(x, 0);
    editCtx.lineTo(x, height);
    editCtx.stroke();
  }
}

function drawMainWaveform() {
  drawWaveformToCanvas(mainCtx, mainCanvas, editedAudioBuffer, viewStart, viewEnd);

  const height = mainCanvas.clientHeight;

  if (editedAudioBuffer && selectionStart != null && selectionEnd != null) {
    const s = Math.min(selectionStart, selectionEnd);
    const e = Math.max(selectionStart, selectionEnd);
    const x1 = sampleToMainCanvasX(s);
    const x2 = sampleToMainCanvasX(e);

    mainCtx.fillStyle = "rgba(0,80,255,0.12)";
    mainCtx.fillRect(x1, 0, Math.max(2, x2 - x1), height);

    mainCtx.strokeStyle = "rgba(0,80,255,1)";
    mainCtx.lineWidth = 3;

    mainCtx.beginPath();
    mainCtx.moveTo(x1, 0);
    mainCtx.lineTo(x1, height);
    mainCtx.stroke();
    mainCtx.fillStyle = "rgba(0,80,255,1)";
    mainCtx.fillRect(x1 - 6, 0, 12, 20);

    mainCtx.beginPath();
    mainCtx.moveTo(x2, 0);
    mainCtx.lineTo(x2, height);
    mainCtx.stroke();
    mainCtx.fillRect(x2 - 6, 0, 12, 20);
  }

  if (editedAudioBuffer && currentPlayheadSample != null) {
    if (currentPlayheadSample >= viewStart && currentPlayheadSample <= viewEnd) {
      const x = sampleToMainCanvasX(currentPlayheadSample);
      mainCtx.strokeStyle = "rgba(255,0,0,0.95)";
      mainCtx.lineWidth = 2;
      mainCtx.beginPath();
      mainCtx.moveTo(x, 0);
      mainCtx.lineTo(x, height);
      mainCtx.stroke();
    }
  }
}

function drawEditWaveform() {
  if (!isEditMode || !editedAudioBuffer || editSession.viewStartSample == null || editSession.viewEndSample == null) {
    drawWaveformToCanvas(editCtx, editCanvas, null, 0, 0);
    return;
  }

  const width = editCanvas.clientWidth;
  const height = editCanvas.clientHeight;
  const start = editSession.viewStartSample;
  const end = editSession.viewEndSample;

  drawEditWaveBackground();

  const showOriginal = editSession.overlayMode === "original" || editSession.overlayMode === "overlay";
  const showEdited = editSession.overlayMode === "edited" || editSession.overlayMode === "overlay";

  const origData = originalAudioBuffer ? originalAudioBuffer.getChannelData(0) : null;
  const editData = editedAudioBuffer.getChannelData(0);

  if (!editSession.precisionMode) {
    if (showEdited) drawWaveformToCanvas(editCtx, editCanvas, editedAudioBuffer, start, end);

    if (showOriginal && originalAudioBuffer) {
      editCtx.strokeStyle = "rgba(220,40,40,0.9)";
      editCtx.lineWidth = 1.2;
      const samplesPerPixel = Math.max(1, Math.floor((end - start) / width));
      for (let x = 0; x < width; x++) {
        const s = start + x * samplesPerPixel;
        const e = Math.min(s + samplesPerPixel, end);
        let min = 1, max = -1;
        for (let i = s; i < e; i++) {
          const v = origData[i];
          if (v < min) min = v;
          if (v > max) max = v;
        }
        const y1 = ((1 - max) * 0.5) * height;
        const y2 = ((1 - min) * 0.5) * height;
        editCtx.beginPath();
        editCtx.moveTo(x, y1);
        editCtx.lineTo(x, y2);
        editCtx.stroke();
      }
    }
  } else {
    if (showOriginal && originalAudioBuffer) {
      drawPreciseLine(editCtx, origData, start, end, width, height, "rgba(220,40,40,0.95)", 1.4);
    }
    if (showEdited) {
      drawPreciseLine(editCtx, editData, start, end, width, height, "rgba(20,20,20,0.98)", 1.8);
    }
  }

  // continuous regions
  for (const region of analysisState.continuousRegions) {
    if (region.endSample < start || region.startSample > end) continue;
    const rs = Math.max(region.startSample, start);
    const re = Math.min(region.endSample, end);
    const x1 = ((rs - start) / Math.max(1, end - start)) * width;
    const x2 = ((re - start) / Math.max(1, end - start)) * width;
    editCtx.fillStyle = "rgba(40,180,80,0.10)";
    editCtx.fillRect(x1, 0, Math.max(2, x2 - x1), height);
  }

  // transient events
  for (const ev of analysisState.transientEvents) {
    if (ev.sample < start || ev.sample > end) continue;
    const x = ((ev.sample - start) / Math.max(1, end - start)) * width;
    editCtx.strokeStyle = "rgba(255,140,0,0.95)";
    editCtx.lineWidth = 2;
    editCtx.beginPath();
    editCtx.moveTo(x, 0);
    editCtx.lineTo(x, height);
    editCtx.stroke();
  }

  // group
  if (groupState.boundaries.length >= 2) {
    const gs = groupState.groupStartSample;
    const ge = groupState.groupEndSample;

    if (!(ge < start || gs > end)) {
      const gx1 = ((Math.max(gs, start) - start) / Math.max(1, end - start)) * width;
      const gx2 = ((Math.min(ge, end) - start) / Math.max(1, end - start)) * width;
      editCtx.fillStyle = "rgba(180,0,255,0.08)";
      editCtx.fillRect(gx1, 0, Math.max(2, gx2 - gx1), height);
    }

    for (let i = 0; i < groupState.boundaries.length; i++) {
      const b = groupState.boundaries[i];
      if (b < start || b > end) continue;
      const x = ((b - start) / Math.max(1, end - start)) * width;
      editCtx.strokeStyle = "rgba(180,0,255,0.95)";
      editCtx.lineWidth = 1.5;
      editCtx.beginPath();
      editCtx.moveTo(x, 0);
      editCtx.lineTo(x, height);
      editCtx.stroke();
    }

    if (groupState.selectedCycleStart != null && groupState.selectedCycleEnd != null) {
      const us = groupState.selectedCycleStart;
      const ue = groupState.selectedCycleEnd;
      if (!(ue < start || us > end)) {
        const x1 = ((Math.max(us, start) - start) / Math.max(1, end - start)) * width;
        const x2 = ((Math.min(ue, end) - start) / Math.max(1, end - start)) * width;
        editCtx.fillStyle = "rgba(100,0,255,0.16)";
        editCtx.fillRect(x1, 0, Math.max(2, x2 - x1), height);
      }
    }
  }

  if (editedAudioBuffer && currentPlayheadSample != null) {
    if (currentPlayheadSample >= start && currentPlayheadSample <= end) {
      const x = ((currentPlayheadSample - start) / Math.max(1, end - start)) * width;
      editCtx.strokeStyle = "rgba(255,0,0,0.95)";
      editCtx.lineWidth = 2;
      editCtx.beginPath();
      editCtx.moveTo(x, 0);
      editCtx.lineTo(x, height);
      editCtx.stroke();
    }
  }
}

// ------------------------------
// Edit operations
// ------------------------------
function updateEditorInfo() {
  if (editSession.startSample == null || editSession.endSample == null || !editedAudioBuffer) {
    editorRangeInfo.textContent = "編集範囲: -";
    return;
  }

  const s = editSession.startSample / editedAudioBuffer.sampleRate;
  const e = editSession.endSample / editedAudioBuffer.sampleRate;
  editorRangeInfo.textContent = `編集範囲: ${s.toFixed(4)}s ～ ${e.toFixed(4)}s`;
}

function openEditMode() {
  if (!editedAudioBuffer || selectionStart == null || selectionEnd == null) return;

  const s = Math.min(selectionStart, selectionEnd);
  const e = Math.max(selectionStart, selectionEnd);
  if (e - s < 2) {
    alert("編集範囲が短すぎます。");
    return;
  }

  editSession.startSample = s;
  editSession.endSample = e;
  editSession.viewStartSample = s;
  editSession.viewEndSample = e;
  editSession.precisionMode = false;
  editSession.overlayMode = "overlay";
  editSession.snapshotBeforeEdit = cloneAudioBuffer(editedAudioBuffer);
  editSession.historyStack = [];

  clearGroup();

  isEditMode = true;
  editorPanel.classList.remove("hidden");
  playerState.lastMode = "edit";
  setEditInteractionMode("navigate");
  setUnitEditMode("navigate");
  updateEditorInfo();
  updatePlaybackInfoText();
  updatePrecisionButton();
  updateOverlayButton();
  undoBtn.disabled = true;
  drawEditWaveform();
  drawUnitWaveform();
  setStatus("編集モード");
}

function cancelEditMode() {
  if (editSession.snapshotBeforeEdit) {
    editedAudioBuffer = cloneAudioBuffer(editSession.snapshotBeforeEdit);
  }

  editSession.startSample = null;
  editSession.endSample = null;
  editSession.viewStartSample = null;
  editSession.viewEndSample = null;
  editSession.precisionMode = false;
  editSession.overlayMode = "overlay";
  editSession.snapshotBeforeEdit = null;
  editSession.historyStack = [];

  clearGroup();

  isEditMode = false;
  editorPanel.classList.add("hidden");
  undoBtn.disabled = true;
  playerState.lastMode = "selection";
  setEditInteractionMode("navigate");
  updatePrecisionButton();
  updateOverlayButton();
  updatePlaybackInfoText();
  drawMainWaveform();
  drawEditWaveform();
  drawUnitWaveform();
  setStatus("編集キャンセル");
}

function applyEditMode() {
  editSession.startSample = null;
  editSession.endSample = null;
  editSession.viewStartSample = null;
  editSession.viewEndSample = null;
  editSession.precisionMode = false;
  editSession.overlayMode = "overlay";
  editSession.snapshotBeforeEdit = null;
  editSession.historyStack = [];

  clearGroup();

  isEditMode = false;
  editorPanel.classList.add("hidden");
  undoBtn.disabled = true;
  playerState.lastMode = "selection";
  setEditInteractionMode("navigate");
  updatePrecisionButton();
  updateOverlayButton();
  updatePlaybackInfoText();
  drawMainWaveform();
  drawEditWaveform();
  drawUnitWaveform();
  setStatus("編集確定");
}

function pushEditHistory() {
  editSession.historyStack.push(cloneAudioBuffer(editedAudioBuffer));
  if (editSession.historyStack.length > 20) editSession.historyStack.shift();
  undoBtn.disabled = editSession.historyStack.length === 0;
}

function undoEditInSession() {
  if (editSession.historyStack.length === 0) return;
  editedAudioBuffer = editSession.historyStack.pop();
  undoBtn.disabled = editSession.historyStack.length === 0;
  drawEditWaveform();
  drawMainWaveform();
  setStatus("1段階戻しました");
}

function applyDrawTool(sampleCenter, ampTarget) {
  const data = editedAudioBuffer.getChannelData(0);
  const radius = parseInt(brushSizeInput.value, 10);
  const strength = parseInt(strengthInput.value, 10) / 100;

  const start = Math.max(editSession.startSample, sampleCenter - radius);
  const end = Math.min(editSession.endSample, sampleCenter + radius);

  for (let i = start; i <= end; i++) {
    const dist = Math.abs(i - sampleCenter) / Math.max(1, radius);
    const weight = Math.max(0, 1 - dist);
    const mix = weight * strength;
    data[i] = clampSample(data[i] * (1 - mix) + ampTarget * mix);
  }
}

function applySmoothTool(sampleCenter) {
  const data = editedAudioBuffer.getChannelData(0);
  const radius = parseInt(brushSizeInput.value, 10);
  const strength = parseInt(strengthInput.value, 10) / 100;

  const start = Math.max(editSession.startSample + 1, sampleCenter - radius);
  const end = Math.min(editSession.endSample - 1, sampleCenter + radius);

  if (end <= start) return;
  const snapshot = new Float32Array(data.slice(start - 1, end + 2));

  for (let i = start; i <= end; i++) {
    const localIndex = i - (start - 1);
    const avg = (snapshot[localIndex - 1] + snapshot[localIndex] + snapshot[localIndex + 1]) / 3;
    data[i] = clampSample(data[i] * (1 - strength) + avg * strength);
  }
}

function applyGainTool(sampleCenter) {
  const data = editedAudioBuffer.getChannelData(0);
  const radius = parseInt(brushSizeInput.value, 10);
  const strength = parseInt(strengthInput.value, 10) / 100;
  const gainBase = 1 + strength * 0.8;

  const start = Math.max(editSession.startSample, sampleCenter - radius);
  const end = Math.min(editSession.endSample, sampleCenter + radius);

  for (let i = start; i <= end; i++) {
    const dist = Math.abs(i - sampleCenter) / Math.max(1, radius);
    const weight = Math.max(0, 1 - dist);
    const gain = 1 + (gainBase - 1) * weight;
    data[i] = clampSample(data[i] * gain);
  }
}

function applyEraseTool(sampleCenter) {
  const data = editedAudioBuffer.getChannelData(0);
  const radius = parseInt(brushSizeInput.value, 10);
  const strength = parseInt(strengthInput.value, 10) / 100;
  const factorBase = 1 - strength * 0.9;

  const start = Math.max(editSession.startSample, sampleCenter - radius);
  const end = Math.min(editSession.endSample, sampleCenter + radius);

  for (let i = start; i <= end; i++) {
    const dist = Math.abs(i - sampleCenter) / Math.max(1, radius);
    const weight = Math.max(0, 1 - dist);
    const factor = 1 - (1 - factorBase) * weight;
    data[i] = clampSample(data[i] * factor);
  }
}

function applyEditToolAt(x, y) {
  const sample = editCanvasXToSample(x);
  const amp = editCanvasYToAmplitude(y);
  const tool = toolSelect.value;

  if (tool === "draw") applyDrawTool(sample, amp);
  else if (tool === "smooth") applySmoothTool(sample);
  else if (tool === "gain") applyGainTool(sample);
  else if (tool === "erase") applyEraseTool(sample);
}

// ------------------------------
// Save / export
// ------------------------------
function createSelectionAudioBuffer() {
  if (!editedAudioBuffer || selectionStart == null || selectionEnd == null) return null;

  const startSample = Math.min(selectionStart, selectionEnd);
  const endSample = Math.max(selectionStart, selectionEnd);
  const length = endSample - startSample;
  if (length <= 0) return null;

  const slicedBuffer = audioContext.createBuffer(
    editedAudioBuffer.numberOfChannels,
    length,
    editedAudioBuffer.sampleRate
  );

  for (let ch = 0; ch < editedAudioBuffer.numberOfChannels; ch++) {
    const sourceData = editedAudioBuffer.getChannelData(ch);
    const targetData = slicedBuffer.getChannelData(ch);
    targetData.set(sourceData.slice(startSample, endSample));
  }

  return slicedBuffer;
}

async function saveCurrentMaterial(asEditedCopy = false) {
  if (!originalAudioBuffer || !editedAudioBuffer) return;

  const baseName = saveNameInput.value.trim() || currentMaterialName || "untitled";
  const finalName = asEditedCopy ? `${baseName}_edited_${Date.now()}` : baseName;

  const material = {
    id: generateId(),
    name: finalName,
    source: currentMaterialSource || "不明",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    original: audioBufferToChannelArrays(originalAudioBuffer),
    edited: audioBufferToChannelArrays(editedAudioBuffer),
  };

  await dbPutMaterial(material);
  setStatus(asEditedCopy ? "編集版を保存しました" : "保存しました");
  await refreshLibrary();
}

async function loadMaterialFromDB(id) {
  try {
    const item = await dbGetMaterial(id);
    if (!item) return;

    await unlockAudio();
    originalAudioBuffer = channelArraysToAudioBuffer(item.original);
    editedAudioBuffer = channelArraysToAudioBuffer(item.edited);

    currentMaterialName = item.name || "";
    currentMaterialSource = item.source || "";
    saveNameInput.value = currentMaterialName;
    fileInfoEl.textContent = `ライブラリ: ${item.name}`;

    analysisState.continuousRegions = [];
    analysisState.transientEvents = [];
    clearGroup();
    resetView();
    resetSelectionDefault();
    stopPlayback();

    isEditMode = false;
    editorPanel.classList.add("hidden");
    editSession.startSample = null;
    editSession.endSample = null;
    editSession.viewStartSample = null;
    editSession.viewEndSample = null;
    editSession.precisionMode = false;
    editSession.overlayMode = "overlay";
    editSession.historyStack = [];
    editSession.snapshotBeforeEdit = null;

    setEditInteractionMode("navigate");
    setUnitEditMode("navigate");
    updatePrecisionButton();
    updateOverlayButton();

    drawMainWaveform();
    drawEditWaveform();
    drawUnitWaveform();
    updateMainUIState();
    setStatus("素材を読み込みました");
  } catch (err) {
    console.error(err);
    alert("保存済み素材の読み込みに失敗しました。");
  }
}

async function duplicateMaterial(id) {
  const item = await dbGetMaterial(id);
  if (!item) return;

  const duplicated = {
    ...item,
    id: generateId(),
    name: `${item.name}_copy`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  await dbPutMaterial(duplicated);
  setStatus("素材を複製しました");
  await refreshLibrary();
}

async function deleteMaterial(id) {
  const ok = confirm("この素材を削除しますか？");
  if (!ok) return;
  await dbDeleteMaterial(id);
  setStatus("素材を削除しました");
  await refreshLibrary();
}

async function refreshLibrary() {
  try {
    const items = await dbGetAllMaterials();

    if (!items.length) {
      libraryList.innerHTML = `<div class="library-item"><div class="library-meta">保存済み素材はありません。</div></div>`;
      return;
    }

    libraryList.innerHTML = items.map(item => {
      const durSec = item.edited?.sampleRate ? (item.edited.length / item.edited.sampleRate).toFixed(2) : "-";
      return `
        <div class="library-item">
          <div class="library-item-head">
            <div>
              <div class="library-title">${escapeHtml(item.name || "(no name)")}</div>
              <div class="library-meta">
                種別: ${escapeHtml(item.source || "-")}<br>
                長さ: ${durSec}s<br>
                更新: ${escapeHtml(formatDate(item.updatedAt))}
              </div>
            </div>
          </div>
          <div class="library-actions">
            <button data-action="load" data-id="${item.id}">読み込み</button>
            <button data-action="duplicate" data-id="${item.id}">複製</button>
            <button data-action="delete" data-id="${item.id}">削除</button>
          </div>
        </div>
      `;
    }).join("");
  } catch (err) {
    console.error(err);
    libraryList.innerHTML = `<div class="library-item"><div class="library-meta">ライブラリ読込に失敗しました。</div></div>`;
  }
}

function writeString(view, offset, str) {
  for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
}

function audioBufferToWavBlob(buffer) {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const bitDepth = 16;
  const blockAlign = (numChannels * bitDepth) / 8;
  const byteRate = sampleRate * blockAlign;
  const dataSize = buffer.length * blockAlign;
  const arrayBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(arrayBuffer);

  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  const channels = [];
  for (let ch = 0; ch < numChannels; ch++) channels.push(buffer.getChannelData(ch));

  for (let i = 0; i < buffer.length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      let sample = clamp(channels[ch][i], -1, 1);
      sample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, sample, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: "audio/wav" });
}

function exportEditedWav() {
  if (!editedAudioBuffer) return;

  const blob = audioBufferToWavBlob(editedAudioBuffer);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${saveNameInput.value.trim() || "edited_voice"}.wav`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  setStatus("WAVを書き出しました");
}

function exportSelectionWav() {
  if (!editedAudioBuffer || selectionStart == null || selectionEnd == null) return;
  const selectionBuffer = createSelectionAudioBuffer();
  if (!selectionBuffer) {
    alert("選択範囲が正しくありません。");
    return;
  }

  const blob = audioBufferToWavBlob(selectionBuffer);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  const startSec = (Math.min(selectionStart, selectionEnd) / editedAudioBuffer.sampleRate).toFixed(4);
  const endSec = (Math.max(selectionStart, selectionEnd) / editedAudioBuffer.sampleRate).toFixed(4);

  a.href = url;
  a.download = `${saveNameInput.value.trim() || "selection"}_${startSec}s-${endSec}s.wav`;
  a.click();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
  setStatus("選択範囲を書き出しました");
}

// ------------------------------
// UI state
// ------------------------------
function updateAnalysisButtons() {
  playContinuousBtn.disabled = !analysisState.continuousRegions.length;
  playTransientBtn.disabled = !analysisState.transientEvents.length;
  clearAnalysisBtn.disabled =
    !analysisState.continuousRegions.length &&
    !analysisState.transientEvents.length &&
    !groupState.cycleCount;
}

function updateMainUIState() {
  const hasAudio = !!editedAudioBuffer;
  const hasSelection = hasAudio && selectionStart != null && selectionEnd != null;

  playBtn.disabled = !hasAudio;
  pauseBtn.disabled = !hasAudio;
  rewindBtn.disabled = !hasAudio;
  forwardBtn.disabled = !hasAudio;
  stopBtn.disabled = !hasAudio;
  seekBar.disabled = !hasAudio;
  loopToggleBtn.disabled = !hasAudio;
  speedSlider.disabled = !hasAudio;

  scrollLeftBtn.disabled = !hasAudio;
  scrollRightBtn.disabled = !hasAudio;
  zoomInBtn.disabled = !hasAudio;
  zoomOutBtn.disabled = !hasAudio;
  fullViewBtn.disabled = !hasAudio;

  playSelectionBtn.disabled = !hasSelection;
  zoomToSelectionBtn.disabled = !hasSelection;
  saveSelectionWavBtn.disabled = !hasSelection;
  resetSelectionBtn.disabled = !hasSelection;
  openEditorBtn.disabled = !hasSelection;

  saveCurrentBtn.disabled = !hasAudio;
  saveEditedAsBtn.disabled = !hasAudio;
  saveWavBtn.disabled = !hasAudio;

  editPlayBtn.disabled = !hasAudio;
  editPauseBtn.disabled = !hasAudio;
  editStopBtn.disabled = !hasAudio;
  editLoopToggleBtn.disabled = !hasAudio;
  editModeToggleBtn.disabled = !isEditMode;
  editZoomInBtn.disabled = !isEditMode;
  editZoomOutBtn.disabled = !isEditMode;
  editFullViewBtn.disabled = !isEditMode;
  precisionToggleBtn.disabled = !isEditMode;
  overlayModeBtn.disabled = !isEditMode;
  analyzeSelectionBtn.disabled = !isEditMode;

  if (!hasAudio) {
    seekBar.value = 0;
    currentTimeLabel.textContent = "0.00s";
    durationLabel.textContent = "0.00s";
    playbackTimeInfoEl.textContent = "再生位置: -";
  } else {
    seekBar.max = 1;
    updatePlayerUI();
  }

  const label = `ループ: ${playerState.loopEnabled ? "ON" : "OFF"}`;
  loopToggleBtn.textContent = label;
  editLoopToggleBtn.textContent = label;

  updatePlaybackInfoText();
  updatePrecisionButton();
  updateOverlayButton();
  updateAnalysisButtons();
  updateGroupButtons();
}

// ------------------------------
// Main canvas interaction
// ------------------------------
mainCanvas.addEventListener("pointerdown", async (event) => {
  if (!editedAudioBuffer || isEditMode) return;
  await unlockAudio();

  const pos = getMainCanvasLocalPos(event);
  mainPointerState.set(event.pointerId, pos);
  mainCanvas.setPointerCapture(event.pointerId);

  const pointers = Array.from(mainPointerState.values());
  singlePointerMoved = false;

  if (pointers.length === 1) {
    const x = pos.x;
    const sx = selectionStart != null ? sampleToMainCanvasX(selectionStart) : null;
    const ex = selectionEnd != null ? sampleToMainCanvasX(selectionEnd) : null;

    if (sx != null && Math.abs(x - sx) <= selectionHandleThresholdPx) {
      draggingSelectionHandle = "start";
      return;
    }
    if (ex != null && Math.abs(x - ex) <= selectionHandleThresholdPx) {
      draggingSelectionHandle = "end";
      return;
    }

    panLastCenterX = x;
  }

  if (pointers.length === 2) {
    draggingSelectionHandle = null;
    pinchStartDistance = distanceBetweenTouches(pointers);
    pinchStartViewStart = viewStart;
    pinchStartViewEnd = viewEnd;
  }
});

mainCanvas.addEventListener("pointermove", (event) => {
  if (!editedAudioBuffer || isEditMode) return;
  if (!mainPointerState.has(event.pointerId)) return;

  const pos = getMainCanvasLocalPos(event);
  mainPointerState.set(event.pointerId, pos);
  const pointers = Array.from(mainPointerState.values());

  if (draggingSelectionHandle && pointers.length === 1) {
    const sample = mainCanvasXToSample(pos.x);
    singlePointerMoved = true;

    if (draggingSelectionHandle === "start") {
      selectionStart = clamp(sample, 0, editedAudioBuffer.length);
      if (selectionEnd != null && selectionStart > selectionEnd) {
        const tmp = selectionStart;
        selectionStart = selectionEnd;
        selectionEnd = tmp;
        draggingSelectionHandle = "end";
      }
    } else {
      selectionEnd = clamp(sample, 0, editedAudioBuffer.length);
      if (selectionStart != null && selectionEnd < selectionStart) {
        const tmp = selectionEnd;
        selectionEnd = selectionStart;
        selectionStart = tmp;
        draggingSelectionHandle = "start";
      }
    }

    updateSelectionInfo();
    drawMainWaveform();
    return;
  }

  if (pointers.length === 1) {
    const dx = pointers[0].x - panLastCenterX;
    if (Math.abs(dx) > 2) singlePointerMoved = true;
    panLastCenterX = pointers[0].x;

    const samplesPerPx = (viewEnd - viewStart) / Math.max(1, mainCanvas.clientWidth);
    const shiftSamples = Math.round(-dx * samplesPerPx);

    let newStart = viewStart + shiftSamples;
    let newEnd = viewEnd + shiftSamples;

    if (newStart < 0) {
      newEnd -= newStart;
      newStart = 0;
    }
    if (newEnd > editedAudioBuffer.length) {
      const over = newEnd - editedAudioBuffer.length;
      newStart -= over;
      newEnd = editedAudioBuffer.length;
    }

    viewStart = clamp(newStart, 0, editedAudioBuffer.length);
    viewEnd = clamp(newEnd, 0, editedAudioBuffer.length);
    updateViewInfo();
    drawMainWaveform();
    return;
  }

  if (pointers.length >= 2) {
    const dist = distanceBetweenTouches(pointers);
    const centerX = centerBetweenTouches(pointers);

    if (pinchStartDistance > 0 && dist > 0) {
      const startLen = pinchStartViewEnd - pinchStartViewStart;
      let newLen = Math.floor(startLen * (pinchStartDistance / dist));
      newLen = clamp(newLen, 8, editedAudioBuffer.length);

      const centerRatio = clamp(centerX / Math.max(1, mainCanvas.clientWidth), 0, 1);
      const anchorSample = Math.floor(pinchStartViewStart + centerRatio * startLen);

      let newStart = Math.floor(anchorSample - centerRatio * newLen);
      let newEnd = newStart + newLen;

      if (newStart < 0) {
        newEnd -= newStart;
        newStart = 0;
      }
      if (newEnd > editedAudioBuffer.length) {
        const over = newEnd - editedAudioBuffer.length;
        newStart -= over;
        newEnd = editedAudioBuffer.length;
      }

      viewStart = clamp(newStart, 0, editedAudioBuffer.length);
      viewEnd = clamp(newEnd, 0, editedAudioBuffer.length);
      updateViewInfo();
      drawMainWaveform();
    }
  }
});

mainCanvas.addEventListener("pointerup", (event) => {
  const pos = mainPointerState.get(event.pointerId);
  mainPointerState.delete(event.pointerId);

  const wasDraggingHandle = draggingSelectionHandle !== null;
  if (mainPointerState.size === 0) draggingSelectionHandle = null;

  if (!editedAudioBuffer || isEditMode || !pos) return;
  if (wasDraggingHandle || singlePointerMoved) return;

  const now = performance.now();
  if (now - lastTapTime < 350 && Math.abs(pos.x - lastTapX) < 24) {
    const sample = mainCanvasXToSample(pos.x);
    seekTo(sample / editedAudioBuffer.sampleRate);
  }

  lastTapTime = now;
  lastTapX = pos.x;
});

mainCanvas.addEventListener("pointercancel", (event) => {
  mainPointerState.delete(event.pointerId);
  if (mainPointerState.size === 0) draggingSelectionHandle = null;
});

// ------------------------------
// Edit canvas interaction
// ------------------------------
editCanvas.addEventListener("pointerdown", async (event) => {
  if (!isEditMode || !editedAudioBuffer) return;
  await unlockAudio();

  const pos = getEditCanvasLocalPos(event);
  editCanvas.setPointerCapture(event.pointerId);
  editPointerState.set(event.pointerId, pos);

  const pointers = Array.from(editPointerState.values());

  if (editSession.interactionMode === "draw") {
    if (pointers.length !== 1) return;

    isEditPointerDown = true;
    editLastX = pos.x;
    editLastY = pos.y;
    pushEditHistory();
    applyEditToolAt(pos.x, pos.y);
    drawEditWaveform();
    drawMainWaveform();
    return;
  }

  if (pointers.length === 1) {
    editPanLastCenterX = pos.x;
  } else if (pointers.length === 2) {
    editPinchStartDistance = distanceBetweenTouches(pointers);
    editPinchStartViewStart = editSession.viewStartSample;
    editPinchStartViewEnd = editSession.viewEndSample;
  }
});

editCanvas.addEventListener("pointermove", (event) => {
  if (!isEditMode || !editedAudioBuffer) return;
  if (!editPointerState.has(event.pointerId)) return;

  const pos = getEditCanvasLocalPos(event);
  editPointerState.set(event.pointerId, pos);
  const pointers = Array.from(editPointerState.values());

  if (editSession.interactionMode === "draw") {
    if (!isEditPointerDown || pointers.length !== 1) return;

    const x = pos.x;
    const y = pos.y;
    const steps = 8;

    for (let i = 1; i <= steps; i++) {
      const ix = editLastX + (x - editLastX) * (i / steps);
      const iy = editLastY + (y - editLastY) * (i / steps);
      applyEditToolAt(ix, iy);
    }

    editLastX = x;
    editLastY = y;

    drawEditWaveform();
    drawMainWaveform();
    return;
  }

  if (pointers.length === 1) {
    const x = pointers[0].x;
    const dx = x - editPanLastCenterX;
    editPanLastCenterX = x;

    const samplesPerPx = (editSession.viewEndSample - editSession.viewStartSample) / Math.max(1, editCanvas.clientWidth);
    const shiftSamples = Math.round(-dx * samplesPerPx);

    let newStart = editSession.viewStartSample + shiftSamples;
    let newEnd = editSession.viewEndSample + shiftSamples;

    if (newStart < editSession.startSample) {
      newEnd += editSession.startSample - newStart;
      newStart = editSession.startSample;
    }
    if (newEnd > editSession.endSample) {
      newStart -= newEnd - editSession.endSample;
      newEnd = editSession.endSample;
    }

    editSession.viewStartSample = clamp(newStart, editSession.startSample, editSession.endSample);
    editSession.viewEndSample = clamp(newEnd, editSession.startSample, editSession.endSample);
    drawEditWaveform();
    return;
  }

  if (pointers.length >= 2) {
    const dist = distanceBetweenTouches(pointers);
    const centerX = centerBetweenTouches(pointers);

    if (editPinchStartDistance > 0 && dist > 0) {
      const startLen = editPinchStartViewEnd - editPinchStartViewStart;
      let newLen = Math.floor(startLen * (editPinchStartDistance / dist));
      newLen = clamp(newLen, getEditMinLength(), Math.max(1, editSession.endSample - editSession.startSample));

      const centerRatio = clamp(centerX / Math.max(1, editCanvas.clientWidth), 0, 1);
      const anchorSample = Math.floor(editPinchStartViewStart + centerRatio * startLen);

      let newStart = Math.floor(anchorSample - centerRatio * newLen);
      let newEnd = newStart + newLen;

      if (newStart < editSession.startSample) {
        newEnd += editSession.startSample - newStart;
        newStart = editSession.startSample;
      }
      if (newEnd > editSession.endSample) {
        newStart -= newEnd - editSession.endSample;
        newEnd = editSession.endSample;
      }

      editSession.viewStartSample = clamp(newStart, editSession.startSample, editSession.endSample);
      editSession.viewEndSample = clamp(newEnd, editSession.startSample, editSession.endSample);
      drawEditWaveform();
    }
  }
});

editCanvas.addEventListener("pointerup", (event) => {
  const pos = editPointerState.get(event.pointerId);
  editPointerState.delete(event.pointerId);
  if (editPointerState.size === 0) isEditPointerDown = false;

  if (!isEditMode || !editedAudioBuffer || !pos) return;
  if (editSession.interactionMode !== "navigate") return;

  const sample = editCanvasXToSample(pos.x);

  // transient tap priority
  let nearestTransient = null;
  let nearestTransientDist = Infinity;
  for (const ev of analysisState.transientEvents) {
    const d = Math.abs(ev.sample - sample);
    if (d < nearestTransientDist) {
      nearestTransientDist = d;
      nearestTransient = ev;
    }
  }

  const transientThreshold = Math.floor(editedAudioBuffer.sampleRate * 0.015);
  if (nearestTransient && nearestTransientDist <= transientThreshold) {
    clearGroup();
    groupInfoText.textContent = "周期グループ: 瞬時イベント上では未使用";
    unitInfoText.textContent = "代表周期: 瞬時イベントです";
    drawUnitWaveform();
    return;
  }

  if (tryBuildGroupFromTap(sample)) {
    updateAnalysisButtons();
    updateGroupButtons();
  }
});

editCanvas.addEventListener("pointercancel", (event) => {
  editPointerState.delete(event.pointerId);
  if (editPointerState.size === 0) isEditPointerDown = false;
});

// ------------------------------
// Unit canvas interaction
// ------------------------------
unitWaveCanvas.addEventListener("pointerdown", async (event) => {
  if (!groupState.unitEdited) return;
  await unlockAudio();

  if (unitEditorState.mode !== "draw") return;

  const pos = getUnitCanvasLocalPos(event);
  unitWaveCanvas.setPointerCapture(event.pointerId);

  unitEditorState.isPointerDown = true;
  unitEditorState.lastX = pos.x;
  unitEditorState.lastY = pos.y;

  applyUnitBrushAt(pos.x, pos.y);
  drawUnitWaveform();
});

unitWaveCanvas.addEventListener("pointermove", (event) => {
  if (!groupState.unitEdited) return;
  if (!unitEditorState.isPointerDown || unitEditorState.mode !== "draw") return;

  const pos = getUnitCanvasLocalPos(event);
  const x = pos.x;
  const y = pos.y;

  const steps = 8;
  for (let i = 1; i <= steps; i++) {
    const ix = unitEditorState.lastX + (x - unitEditorState.lastX) * (i / steps);
    const iy = unitEditorState.lastY + (y - unitEditorState.lastY) * (i / steps);
    applyUnitBrushAt(ix, iy);
  }

  unitEditorState.lastX = x;
  unitEditorState.lastY = y;
  drawUnitWaveform();
});

unitWaveCanvas.addEventListener("pointerup", () => {
  unitEditorState.isPointerDown = false;
});

unitWaveCanvas.addEventListener("pointercancel", () => {
  unitEditorState.isPointerDown = false;
});

// ------------------------------
// Seek bar
// ------------------------------
seekBar.addEventListener("input", () => {
  if (!editedAudioBuffer) return;
  isSeeking = true;
  const sec = parseFloat(seekBar.value) * editedAudioBuffer.duration;
  currentTimeLabel.textContent = formatSec(sec);
  playbackTimeInfoEl.textContent = `再生位置: ${formatSec(sec)}`;
  currentPlayheadSample = Math.floor(sec * editedAudioBuffer.sampleRate);
  drawMainWaveform();
  if (isEditMode) drawEditWaveform();
});

seekBar.addEventListener("change", () => {
  if (!editedAudioBuffer) return;
  isSeeking = false;
  seekTo(parseFloat(seekBar.value) * editedAudioBuffer.duration);
});

// ------------------------------
// Buttons
// ------------------------------
playBtn.addEventListener("click", playCurrent);
pauseBtn.addEventListener("click", pausePlayback);
stopBtn.addEventListener("click", () => stopPlayback(false));
rewindBtn.addEventListener("click", () => skipBy(-10));
forwardBtn.addEventListener("click", () => skipBy(10));
loopToggleBtn.addEventListener("click", toggleLoop);
editLoopToggleBtn.addEventListener("click", toggleLoop);

playSelectionBtn.addEventListener("click", playSelection);
saveSelectionWavBtn.addEventListener("click", exportSelectionWav);
analyzeSelectionBtn.addEventListener("click", analyzeSelectedRegion);
playContinuousBtn.addEventListener("click", playContinuousRegions);
playTransientBtn.addEventListener("click", playTransientEvents);
clearAnalysisBtn.addEventListener("click", () => {
  analysisState.continuousRegions = [];
  analysisState.transientEvents = [];
  clearGroup();
  updateAnalysisButtons();
  drawEditWaveform();
  setStatus("解析表示を消しました");
});

playUnitBtn.addEventListener("click", playSelectedUnit);
groupPlayBtn.addEventListener("click", playGroup);
clearGroupBtn.addEventListener("click", clearGroup);
unitEditModeBtn.addEventListener("click", () => {
  setUnitEditMode(unitEditorState.mode === "navigate" ? "draw" : "navigate");
});
applyUnitToGroupBtn.addEventListener("click", applyUnitEditsToGroup);

editPlayBtn.addEventListener("click", playEditRange);
editPauseBtn.addEventListener("click", pausePlayback);
editStopBtn.addEventListener("click", () => stopPlayback(false));

scrollLeftBtn.addEventListener("click", () => scrollView(-1));
scrollRightBtn.addEventListener("click", () => scrollView(1));
zoomInBtn.addEventListener("click", () => zoomView(0.5));
zoomOutBtn.addEventListener("click", () => zoomView(2.0));
fullViewBtn.addEventListener("click", () => {
  resetView();
  drawMainWaveform();
});

zoomToSelectionBtn.addEventListener("click", zoomToSelection);
resetSelectionBtn.addEventListener("click", () => {
  resetSelectionDefault();
  drawMainWaveform();
});

openEditorBtn.addEventListener("click", () => {
  playerState.lastMode = "selection";
  updatePlaybackInfoText();
  openEditMode();
  updateMainUIState();
});

editModeToggleBtn.addEventListener("click", () => {
  setEditInteractionMode(editSession.interactionMode === "navigate" ? "draw" : "navigate");
});

editZoomInBtn.addEventListener("click", () => zoomEditView(0.5));
editZoomOutBtn.addEventListener("click", () => zoomEditView(2.0));
editFullViewBtn.addEventListener("click", resetEditView);

precisionToggleBtn.addEventListener("click", () => {
  editSession.precisionMode = !editSession.precisionMode;
  updatePrecisionButton();
  drawEditWaveform();
});

overlayModeBtn.addEventListener("click", () => {
  if (editSession.overlayMode === "overlay") editSession.overlayMode = "edited";
  else if (editSession.overlayMode === "edited") editSession.overlayMode = "original";
  else editSession.overlayMode = "overlay";
  updateOverlayButton();
  drawEditWaveform();
});

undoBtn.addEventListener("click", undoEditInSession);
cancelEditBtn.addEventListener("click", () => {
  cancelEditMode();
  updateMainUIState();
});
applyEditBtn.addEventListener("click", () => {
  applyEditMode();
  updateMainUIState();
});
saveWavBtn.addEventListener("click", exportEditedWav);

saveCurrentBtn.addEventListener("click", async () => {
  try { await saveCurrentMaterial(false); }
  catch (err) { console.error(err); alert("保存に失敗しました。"); }
});

saveEditedAsBtn.addEventListener("click", async () => {
  try { await saveCurrentMaterial(true); }
  catch (err) { console.error(err); alert("編集版保存に失敗しました。"); }
});

refreshLibraryBtn.addEventListener("click", refreshLibrary);

libraryList.addEventListener("click", async (event) => {
  const btn = event.target.closest("button[data-action]");
  if (!btn) return;

  const action = btn.dataset.action;
  const id = btn.dataset.id;
  if (!id) return;

  if (action === "load") await loadMaterialFromDB(id);
  else if (action === "duplicate") await duplicateMaterial(id);
  else if (action === "delete") await deleteMaterial(id);
});

// ------------------------------
// Init
// ------------------------------
function init() {
  bootStatus();
  setEditInteractionMode("navigate");
  setUnitEditMode("navigate");
  updatePrecisionButton();
  updateOverlayButton();
  updateMainUIState();
  drawMainWaveform();
  drawEditWaveform();
  drawUnitWaveform();
  refreshLibrary();
}

init();