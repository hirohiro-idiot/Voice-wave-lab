const statusEl = document.getElementById("status");
const timeInfoEl = document.getElementById("timeInfo");
const fileInfoEl = document.getElementById("fileInfo");
const viewInfoEl = document.getElementById("viewInfo");
const selectionInfoEl = document.getElementById("selectionInfo");
const playbackModeInfoEl = document.getElementById("playbackModeInfo");
const playbackTimeInfoEl = document.getElementById("playbackTimeInfo");

const recordBtn = document.getElementById("recordBtn");
const audioInput = document.getElementById("audioInput");
const videoInput = document.getElementById("videoInput");
const anyFileInput = document.getElementById("anyFileInput");

const saveNameInput = document.getElementById("saveNameInput");
const saveCurrentBtn = document.getElementById("saveCurrentBtn");
const saveEditedAsBtn = document.getElementById("saveEditedAsBtn");
const refreshLibraryBtn = document.getElementById("refreshLibraryBtn");
const libraryList = document.getElementById("libraryList");

const playOriginalBtn = document.getElementById("playOriginalBtn");
const playEditedBtn = document.getElementById("playEditedBtn");
const playSelectionBtn = document.getElementById("playSelectionBtn");
const stopBtn = document.getElementById("stopBtn");

const scrollLeftBtn = document.getElementById("scrollLeftBtn");
const scrollRightBtn = document.getElementById("scrollRightBtn");
const zoomInBtn = document.getElementById("zoomInBtn");
const zoomOutBtn = document.getElementById("zoomOutBtn");
const zoomToSelectionBtn = document.getElementById("zoomToSelectionBtn");
const fullViewBtn = document.getElementById("fullViewBtn");

const toolSelect = document.getElementById("toolSelect");
const brushSizeInput = document.getElementById("brushSize");
const strengthInput = document.getElementById("strength");
const brushSizeValue = document.getElementById("brushSizeValue");
const strengthValue = document.getElementById("strengthValue");
const undoBtn = document.getElementById("undoBtn");
const resetBtn = document.getElementById("resetBtn");
const saveWavBtn = document.getElementById("saveWavBtn");

const canvas = document.getElementById("waveCanvas");
const ctx = canvas.getContext("2d");

let audioContext = null;
let mediaStream = null;
let mediaRecorder = null;
let recordedChunks = [];
let recordingStartTime = 0;
let recordingTimerId = null;
let currentSourceNode = null;

let originalAudioBuffer = null;
let editedAudioBuffer = null;
let historyStack = [];
let currentMaterialName = "";
let currentMaterialSource = "";

let viewStart = 0;
let viewEnd = 0;

let selectionStart = null;
let selectionEnd = null;

let isPointerDown = false;
let lastPointerX = null;
let lastPointerY = null;

let playbackAnimationFrame = null;
let playbackStartTime = 0;
let playbackOffsetSec = 0;
let playbackEndSec = 0;
let playbackMode = "none";
let currentPlayheadSample = null;

let dpr = Math.max(1, window.devicePixelRatio || 1);

// ------------------------------
// IndexedDB
// ------------------------------
const DB_NAME = "wave_voice_lab_db";
const DB_VERSION = 1;
const STORE_NAME = "materials";

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("updatedAt", "updatedAt", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
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
    const request = tx.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => {
      const items = request.result || [];
      items.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      resolve(items);
    };
    request.onerror = () => reject(request.error);
  });
}

async function dbGetMaterial(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
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
// General
// ------------------------------
function setStatus(msg) {
  statusEl.textContent = msg;
}

function updateBrushLabels() {
  brushSizeValue.textContent = brushSizeInput.value;
  strengthValue.textContent = strengthInput.value;
}

brushSizeInput.addEventListener("input", updateBrushLabels);
strengthInput.addEventListener("input", updateBrushLabels);
updateBrushLabels();

function ensureAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.floor(rect.width * dpr);
  canvas.height = Math.floor(rect.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawWaveform();
}

window.addEventListener("resize", resizeCanvas);
setTimeout(resizeCanvas, 50);

function enableEditingButtons(enabled) {
  playOriginalBtn.disabled = !enabled;
  playEditedBtn.disabled = !enabled;
  stopBtn.disabled = !enabled;
  resetBtn.disabled = !enabled;
  saveWavBtn.disabled = !enabled;
  zoomInBtn.disabled = !enabled;
  zoomOutBtn.disabled = !enabled;
  fullViewBtn.disabled = !enabled;
  scrollLeftBtn.disabled = !enabled;
  scrollRightBtn.disabled = !enabled;
  saveCurrentBtn.disabled = !enabled;
  saveEditedAsBtn.disabled = !enabled;
  undoBtn.disabled = historyStack.length === 0 || !enabled;
  updateSelectionDependentButtons();
}

function updateSelectionDependentButtons() {
  const hasSel = selectionStart != null && selectionEnd != null && editedAudioBuffer;
  playSelectionBtn.disabled = !hasSel;
  zoomToSelectionBtn.disabled = !hasSel;
}

function clampSample(v) {
  return Math.max(-1, Math.min(1, v));
}

function getFileExtension(name) {
  const idx = name.lastIndexOf(".");
  if (idx === -1) return "";
  return name.slice(idx).toLowerCase();
}

function formatDate(ts) {
  if (!ts) return "-";
  const d = new Date(ts);
  return d.toLocaleString();
}

function generateId() {
  return `mat_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

// ------------------------------
// AudioBuffer conversion
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

function pushHistory() {
  if (!editedAudioBuffer) return;
  historyStack.push(cloneAudioBuffer(editedAudioBuffer));
  if (historyStack.length > 20) historyStack.shift();
  undoBtn.disabled = historyStack.length === 0;
}

function audioBufferToChannelArrays(buffer) {
  const channels = [];
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    channels.push(Array.from(buffer.getChannelData(ch)));
  }
  return {
    sampleRate: buffer.sampleRate,
    numberOfChannels: buffer.numberOfChannels,
    length: buffer.length,
    channels
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
// Loading / recording
// ------------------------------
function loadDecodedBuffer(decoded, label = "読込完了", source = "") {
  originalAudioBuffer = toMonoBuffer(decoded);
  editedAudioBuffer = cloneAudioBuffer(originalAudioBuffer);
  historyStack = [];
  currentMaterialSource = source;
  clearSelection();
  resetView();
  enableEditingButtons(true);
  drawWaveform();
  setStatus(label);
  if (!currentMaterialName) {
    currentMaterialName = label;
    saveNameInput.value = label;
  }
}

async function decodeFileToAudioBuffer(file) {
  ensureAudioContext();
  const arrayBuffer = await file.arrayBuffer();
  const decoded = await audioContext.decodeAudioData(arrayBuffer.slice(0));
  return decoded;
}

async function handleFileLoad(file, sourceLabel = "ファイル") {
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
    alert(
      "読み込みに失敗しました。\n\n" +
      "試してほしいこと:\n" +
      "1. なんでも選択から選ぶ\n" +
      "2. 音声は mp3 / wav / m4a\n" +
      "3. 動画は mp4\n" +
      "4. 動画に音声トラックが入っているか確認"
    );
  }
}

async function startRecording() {
  try {
    ensureAudioContext();

    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(mediaStream);
    recordedChunks = [];

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordedChunks.push(event.data);
      }
    };

    mediaRecorder.onstop = async () => {
      try {
        const blob = new Blob(recordedChunks, { type: mediaRecorder.mimeType || "audio/webm" });
        const fileLike = new File([blob], "recorded_audio.webm", { type: blob.type });
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
    fileInfoEl.textContent = "マイク録音中";
    setStatus("録音中...");
  } catch (err) {
    console.error(err);
    setStatus("マイク利用に失敗");
    alert("マイク利用に失敗しました。ブラウザのマイク許可を確認してください。");
  }
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
  }

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
// Playback
// ------------------------------
function stopPlaybackAnimation() {
  if (playbackAnimationFrame) {
    cancelAnimationFrame(playbackAnimationFrame);
    playbackAnimationFrame = null;
  }
  currentPlayheadSample = null;
  playbackMode = "none";
  playbackModeInfoEl.textContent = "再生対象: なし";
  playbackTimeInfoEl.textContent = "再生位置: -";
}

function stopCurrentPlayback() {
  if (currentSourceNode) {
    try {
      currentSourceNode.stop();
    } catch (e) {}
    currentSourceNode = null;
  }
  stopPlaybackAnimation();
  drawWaveform();
  setStatus("停止");
}

function startPlaybackAnimation(buffer, startSec, endSec, modeLabel) {
  playbackStartTime = performance.now();
  playbackOffsetSec = startSec;
  playbackEndSec = endSec;
  playbackMode = modeLabel;
  playbackModeInfoEl.textContent = `再生対象: ${modeLabel}`;

  const sampleRate = buffer.sampleRate;

  function tick() {
    const elapsed = (performance.now() - playbackStartTime) / 1000;
    const currentSec = Math.min(playbackOffsetSec + elapsed, playbackEndSec);
    currentPlayheadSample = Math.floor(currentSec * sampleRate);
    playbackTimeInfoEl.textContent = `再生位置: ${currentSec.toFixed(2)}s`;
    drawWaveform();

    if (currentSec < playbackEndSec && currentSourceNode) {
      playbackAnimationFrame = requestAnimationFrame(tick);
    }
  }

  tick();
}

async function playAudioBuffer(buffer, startSec = 0, endSec = null, modeLabel = "全体") {
  if (!buffer) return;

  ensureAudioContext();
  stopCurrentPlayback();

  if (audioContext.state === "suspended") {
    await audioContext.resume();
  }

  const source = audioContext.createBufferSource();
  source.buffer = buffer;
  source.connect(audioContext.destination);
  currentSourceNode = source;

  const duration = buffer.duration;
  const clampedStart = Math.max(0, Math.min(startSec, duration));
  const clampedEnd = endSec == null ? duration : Math.max(clampedStart, Math.min(endSec, duration));
  const playDuration = Math.max(0, clampedEnd - clampedStart);

  if (playDuration <= 0) {
    setStatus("再生範囲が不正です");
    return;
  }

  setStatus("再生中...");
  startPlaybackAnimation(buffer, clampedStart, clampedEnd, modeLabel);

  source.onended = () => {
    if (currentSourceNode === source) {
      currentSourceNode = null;
      stopPlaybackAnimation();
      drawWaveform();
      setStatus("再生終了");
    }
  };

  try {
    source.start(0, clampedStart, playDuration);
  } catch (err) {
    console.error(err);
    setStatus("再生失敗");
    alert("再生に失敗しました。ページを再読み込みして再度試してください。");
  }
}

// ------------------------------
// View / selection
// ------------------------------
function clearSelection() {
  selectionStart = null;
  selectionEnd = null;
  selectionInfoEl.textContent = "選択範囲: なし";
  updateSelectionDependentButtons();
}

function updateSelectionInfo() {
  if (selectionStart == null || selectionEnd == null || !editedAudioBuffer) {
    selectionInfoEl.textContent = "選択範囲: なし";
    updateSelectionDependentButtons();
    return;
  }

  const s = Math.min(selectionStart, selectionEnd);
  const e = Math.max(selectionStart, selectionEnd);
  const startSec = (s / editedAudioBuffer.sampleRate).toFixed(2);
  const endSec = (e / editedAudioBuffer.sampleRate).toFixed(2);

  selectionInfoEl.textContent = `選択範囲: ${startSec}s ～ ${endSec}s`;
  updateSelectionDependentButtons();
}

function resetView() {
  if (!editedAudioBuffer) return;
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
  const startRatio = ((viewStart / total) * 100).toFixed(1);
  const endRatio = ((viewEnd / total) * 100).toFixed(1);

  const startSec = (viewStart / editedAudioBuffer.sampleRate).toFixed(2);
  const endSec = (viewEnd / editedAudioBuffer.sampleRate).toFixed(2);

  viewInfoEl.textContent = `表示範囲: ${startRatio}% ～ ${endRatio}% (${startSec}s ～ ${endSec}s)`;
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

  newStart = Math.max(0, newStart);
  newEnd = Math.min(editedAudioBuffer.length, newEnd);

  viewStart = newStart;
  viewEnd = newEnd;
  updateViewInfo();
  drawWaveform();
}

function zoomView(factor) {
  if (!editedAudioBuffer) return;

  const currentLength = viewEnd - viewStart;
  const center = viewStart + currentLength / 2;
  let newLength = Math.floor(currentLength * factor);

  const minLength = 500;
  const maxLength = editedAudioBuffer.length;
  newLength = Math.max(minLength, Math.min(maxLength, newLength));

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

  newStart = Math.max(0, newStart);
  newEnd = Math.min(editedAudioBuffer.length, newEnd);

  viewStart = newStart;
  viewEnd = newEnd;
  updateViewInfo();
  drawWaveform();
}

function zoomToSelection() {
  if (!editedAudioBuffer || selectionStart == null || selectionEnd == null) return;

  const s = Math.min(selectionStart, selectionEnd);
  const e = Math.max(selectionStart, selectionEnd);

  if (e - s < 10) return;

  viewStart = s;
  viewEnd = e;
  updateViewInfo();
  drawWaveform();
}

// ------------------------------
// Canvas mapping
// ------------------------------
function canvasXToSample(x) {
  if (!editedAudioBuffer) return 0;
  const width = canvas.clientWidth;
  const ratio = Math.max(0, Math.min(1, x / width));
  return Math.floor(viewStart + ratio * (viewEnd - viewStart));
}

function canvasYToAmplitude(y) {
  const height = canvas.clientHeight;
  const ratio = 1 - (y / height) * 2;
  return Math.max(-1, Math.min(1, ratio));
}

function sampleToCanvasX(sampleIndex) {
  const width = canvas.clientWidth;
  if (viewEnd === viewStart) return 0;
  return ((sampleIndex - viewStart) / (viewEnd - viewStart)) * width;
}

// ------------------------------
// Drawing
// ------------------------------
function drawWaveform() {
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

  if (!editedAudioBuffer) {
    ctx.fillStyle = "#888";
    ctx.font = "16px sans-serif";
    ctx.fillText("ここに波形が表示されます", 20, height / 2 - 10);
    return;
  }

  const data = editedAudioBuffer.getChannelData(0);
  const samplesPerPixel = Math.max(1, Math.floor((viewEnd - viewStart) / width));

  ctx.strokeStyle = "#111";
  ctx.lineWidth = 1;

  for (let x = 0; x < width; x++) {
    const start = viewStart + x * samplesPerPixel;
    const end = Math.min(start + samplesPerPixel, viewEnd);

    let min = 1;
    let max = -1;

    for (let i = start; i < end; i++) {
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

  if (selectionStart != null && selectionEnd != null) {
    const s = Math.min(selectionStart, selectionEnd);
    const e = Math.max(selectionStart, selectionEnd);

    const x1 = sampleToCanvasX(s);
    const x2 = sampleToCanvasX(e);

    ctx.fillStyle = "rgba(0, 80, 255, 0.14)";
    ctx.fillRect(x1, 0, x2 - x1, height);

    ctx.strokeStyle = "rgba(0, 80, 255, 0.9)";
    ctx.beginPath();
    ctx.moveTo(x1, 0);
    ctx.lineTo(x1, height);
    ctx.moveTo(x2, 0);
    ctx.lineTo(x2, height);
    ctx.stroke();
  }

  if (currentPlayheadSample != null && currentPlayheadSample >= viewStart && currentPlayheadSample <= viewEnd) {
    const x = sampleToCanvasX(currentPlayheadSample);
    ctx.strokeStyle = "rgba(255, 0, 0, 0.95)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
}

// ------------------------------
// Editing tools
// ------------------------------
function applyDrawTool(sampleCenter, ampTarget) {
  const data = editedAudioBuffer.getChannelData(0);
  const radius = parseInt(brushSizeInput.value, 10);
  const strength = parseInt(strengthInput.value, 10) / 100;

  const start = Math.max(0, sampleCenter - radius);
  const end = Math.min(data.length - 1, sampleCenter + radius);

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

  const start = Math.max(1, sampleCenter - radius);
  const end = Math.min(data.length - 2, sampleCenter + radius);
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

  const start = Math.max(0, sampleCenter - radius);
  const end = Math.min(data.length - 1, sampleCenter + radius);

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

  const start = Math.max(0, sampleCenter - radius);
  const end = Math.min(data.length - 1, sampleCenter + radius);

  for (let i = start; i <= end; i++) {
    const dist = Math.abs(i - sampleCenter) / Math.max(1, radius);
    const weight = Math.max(0, 1 - dist);
    const factor = 1 - (1 - factorBase) * weight;
    data[i] = clampSample(data[i] * factor);
  }
}

function applyToolAtPointer(x, y) {
  if (!editedAudioBuffer) return;

  const tool = toolSelect.value;
  const sample = canvasXToSample(x);
  const amp = canvasYToAmplitude(y);

  if (tool === "draw") {
    applyDrawTool(sample, amp);
  } else if (tool === "smooth") {
    applySmoothTool(sample);
  } else if (tool === "gain") {
    applyGainTool(sample);
  } else if (tool === "erase") {
    applyEraseTool(sample);
  }
}

function undoEdit() {
  if (historyStack.length === 0) return;
  editedAudioBuffer = historyStack.pop();
  undoBtn.disabled = historyStack.length === 0;
  drawWaveform();
  setStatus("1段階戻しました");
}

function resetEditedAudio() {
  if (!originalAudioBuffer) return;
  pushHistory();
  editedAudioBuffer = cloneAudioBuffer(originalAudioBuffer);
  clearSelection();
  resetView();
  drawWaveform();
  setStatus("編集をリセット");
}

// ------------------------------
// Save / load / duplicate / delete
// ------------------------------
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
    edited: audioBufferToChannelArrays(editedAudioBuffer)
  };

  await dbPutMaterial(material);
  setStatus(asEditedCopy ? "編集版を保存しました" : "保存しました");
  await refreshLibrary();
}

async function loadMaterialFromDB(id) {
  try {
    const item = await dbGetMaterial(id);
    if (!item) return;

    ensureAudioContext();
    originalAudioBuffer = channelArraysToAudioBuffer(item.original);
    editedAudioBuffer = channelArraysToAudioBuffer(item.edited);
    historyStack = [];
    currentMaterialName = item.name || "";
    currentMaterialSource = item.source || "";

    saveNameInput.value = currentMaterialName;
    fileInfoEl.textContent = `ライブラリ: ${item.name}`;
    clearSelection();
    resetView();
    enableEditingButtons(true);
    drawWaveform();
    setStatus("素材を読み込みました");
  } catch (err) {
    console.error(err);
    setStatus("素材読込失敗");
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
    updatedAt: Date.now()
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

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

// ------------------------------
// WAV export
// ------------------------------
function audioBufferToWavBlob(buffer) {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const bitDepth = 16;
  const blockAlign = numChannels * bitDepth / 8;
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
  for (let ch = 0; ch < numChannels; ch++) {
    channels.push(buffer.getChannelData(ch));
  }

  for (let i = 0; i < buffer.length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      let sample = Math.max(-1, Math.min(1, channels[ch][i]));
      sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      view.setInt16(offset, sample, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: "audio/wav" });
}

function writeString(view, offset, str) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

function exportEditedWav() {
  if (!editedAudioBuffer) return;

  const wavBlob = audioBufferToWavBlob(editedAudioBuffer);
  const url = URL.createObjectURL(wavBlob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(saveNameInput.value.trim() || "edited_voice")}.wav`;
  a.click();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
  setStatus("WAVを書き出しました");
}

// ------------------------------
// Pointer events
// ------------------------------
function getCanvasLocalPos(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  };
}

canvas.addEventListener("pointerdown", (event) => {
  if (!editedAudioBuffer) return;

  canvas.setPointerCapture(event.pointerId);
  isPointerDown = true;

  const { x, y } = getCanvasLocalPos(event);
  lastPointerX = x;
  lastPointerY = y;

  if (toolSelect.value === "select") {
    selectionStart = canvasXToSample(x);
    selectionEnd = selectionStart;
    updateSelectionInfo();
    drawWaveform();
    return;
  }

  pushHistory();
  applyToolAtPointer(x, y);
  drawWaveform();
});

canvas.addEventListener("pointermove", (event) => {
  if (!editedAudioBuffer || !isPointerDown) return;

  const { x, y } = getCanvasLocalPos(event);

  if (toolSelect.value === "select") {
    selectionEnd = canvasXToSample(x);
    updateSelectionInfo();
    drawWaveform();
    return;
  }

  const steps = 8;
  for (let i = 1; i <= steps; i++) {
    const ix = lastPointerX + (x - lastPointerX) * (i / steps);
    const iy = lastPointerY + (y - lastPointerY) * (i / steps);
    applyToolAtPointer(ix, iy);
  }

  lastPointerX = x;
  lastPointerY = y;
  drawWaveform();
});

canvas.addEventListener("pointerup", () => {
  isPointerDown = false;
});

canvas.addEventListener("pointercancel", () => {
  isPointerDown = false;
});

// ------------------------------
// Events
// ------------------------------
recordBtn.addEventListener("click", async () => {
  if (!mediaRecorder || mediaRecorder.state === "inactive") {
    await startRecording();
  } else {
    stopRecording();
  }
});

audioInput.addEventListener("change", async (event) => {
  const file = event.target.files && event.target.files[0];
  await handleFileLoad(file, "音声ファイル");
  audioInput.value = "";
});

videoInput.addEventListener("change", async (event) => {
  const file = event.target.files && event.target.files[0];
  await handleFileLoad(file, "動画ファイル");
  videoInput.value = "";
});

anyFileInput.addEventListener("change", async (event) => {
  const file = event.target.files && event.target.files[0];
  await handleFileLoad(file, "任意ファイル");
  anyFileInput.value = "";
});

playOriginalBtn.addEventListener("click", () => {
  if (!originalAudioBuffer) return;
  playAudioBuffer(originalAudioBuffer, 0, originalAudioBuffer.duration, "元音声 全体");
});

playEditedBtn.addEventListener("click", () => {
  if (!editedAudioBuffer) return;
  playAudioBuffer(editedAudioBuffer, 0, editedAudioBuffer.duration, "編集後 全体");
});

playSelectionBtn.addEventListener("click", () => {
  if (!editedAudioBuffer || selectionStart == null || selectionEnd == null) return;

  const s = Math.min(selectionStart, selectionEnd);
  const e = Math.max(selectionStart, selectionEnd);
  const sr = editedAudioBuffer.sampleRate;

  playAudioBuffer(editedAudioBuffer, s / sr, e / sr, "選択範囲");
});

stopBtn.addEventListener("click", () => {
  stopCurrentPlayback();
});

scrollLeftBtn.addEventListener("click", () => {
  scrollView(-1);
});

scrollRightBtn.addEventListener("click", () => {
  scrollView(1);
});

zoomInBtn.addEventListener("click", () => {
  zoomView(0.5);
});

zoomOutBtn.addEventListener("click", () => {
  zoomView(2.0);
});

zoomToSelectionBtn.addEventListener("click", () => {
  zoomToSelection();
});

fullViewBtn.addEventListener("click", () => {
  resetView();
  drawWaveform();
});

undoBtn.addEventListener("click", () => {
  undoEdit();
});

resetBtn.addEventListener("click", () => {
  resetEditedAudio();
});

saveWavBtn.addEventListener("click", () => {
  exportEditedWav();
});

saveCurrentBtn.addEventListener("click", async () => {
  try {
    await saveCurrentMaterial(false);
  } catch (err) {
    console.error(err);
    alert("保存に失敗しました。");
  }
});

saveEditedAsBtn.addEventListener("click", async () => {
  try {
    await saveCurrentMaterial(true);
  } catch (err) {
    console.error(err);
    alert("編集版保存に失敗しました。");
  }
});

refreshLibraryBtn.addEventListener("click", async () => {
  await refreshLibrary();
});

libraryList.addEventListener("click", async (event) => {
  const btn = event.target.closest("button[data-action]");
  if (!btn) return;

  const action = btn.dataset.action;
  const id = btn.dataset.id;
  if (!id) return;

  if (action === "load") {
    await loadMaterialFromDB(id);
  } else if (action === "duplicate") {
    await duplicateMaterial(id);
  } else if (action === "delete") {
    await deleteMaterial(id);
  }
});

// ------------------------------
// Init
// ------------------------------
drawWaveform();
refreshLibrary();