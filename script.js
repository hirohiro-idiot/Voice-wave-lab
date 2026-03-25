// ======================================================
// Wave Voice Lab
// 第1段階〜第5段階まで見据えた雛形
// ======================================================

// ------------------------------
// DOM
// ------------------------------
const statusEl = document.getElementById("status");
const timeInfoEl = document.getElementById("timeInfo");
const viewInfoEl = document.getElementById("viewInfo");
const selectionInfoEl = document.getElementById("selectionInfo");

const recordBtn = document.getElementById("recordBtn");
const playOriginalBtn = document.getElementById("playOriginalBtn");
const playEditedBtn = document.getElementById("playEditedBtn");
const undoBtn = document.getElementById("undoBtn");
const resetBtn = document.getElementById("resetBtn");
const saveBtn = document.getElementById("saveBtn");
const zoomInBtn = document.getElementById("zoomInBtn");
const zoomOutBtn = document.getElementById("zoomOutBtn");
const fullViewBtn = document.getElementById("fullViewBtn");
const playSelectionBtn = document.getElementById("playSelectionBtn");

const toolSelect = document.getElementById("toolSelect");
const brushSizeInput = document.getElementById("brushSize");
const strengthInput = document.getElementById("strength");
const brushSizeValue = document.getElementById("brushSizeValue");
const strengthValue = document.getElementById("strengthValue");

const canvas = document.getElementById("waveCanvas");
const ctx = canvas.getContext("2d");

// ------------------------------
// Audio
// ------------------------------
let audioContext = null;
let mediaStream = null;
let mediaRecorder = null;
let recordedChunks = [];
let recordingStartTime = 0;
let recordingTimerId = null;
let currentSourceNode = null;

// 元音声・編集音声
let originalAudioBuffer = null;
let editedAudioBuffer = null;

// 編集履歴
let historyStack = [];

// 表示範囲（ズーム対応）
let viewStart = 0; // samples
let viewEnd = 0;   // samples

// 選択範囲
let selectionStart = null;
let selectionEnd = null;
let isSelecting = false;

// 編集状態
let isPointerDown = false;
let lastPointerX = null;
let lastPointerY = null;

// 描画用
let dpr = Math.max(1, window.devicePixelRatio || 1);

// ------------------------------
// 初期化
// ------------------------------
function setStatus(msg) {
  statusEl.textContent = msg;
}

function updateBrushLabels() {
  brushSizeValue.textContent = brushSizeInput.value;
  strengthValue.textContent = strengthInput.value;
}

updateBrushLabels();

brushSizeInput.addEventListener("input", updateBrushLabels);
strengthInput.addEventListener("input", updateBrushLabels);

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

// ------------------------------
// 第1段階: 録音と再生
// ------------------------------
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
        const arrayBuffer = await blob.arrayBuffer();
        const decoded = await audioContext.decodeAudioData(arrayBuffer);

        originalAudioBuffer = toMonoBuffer(decoded);
        editedAudioBuffer = cloneAudioBuffer(originalAudioBuffer);

        historyStack = [];
        resetView();
        clearSelection();
        enableEditingButtons(true);

        setStatus("録音完了");
        drawWaveform();
      } catch (err) {
        console.error(err);
        setStatus("録音データの解析に失敗");
      }
    };

    mediaRecorder.start();
    recordingStartTime = performance.now();
    recordingTimerId = setInterval(updateRecordingTime, 100);

    recordBtn.textContent = "録音停止";
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

async function playAudioBuffer(buffer, startSec = 0, endSec = null) {
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

  setStatus("再生中...");

  source.onended = () => {
    if (currentSourceNode === source) {
      currentSourceNode = null;
      setStatus("再生終了");
    }
  };

  source.start(0, clampedStart, playDuration);
}

function stopCurrentPlayback() {
  if (currentSourceNode) {
    try {
      currentSourceNode.stop();
    } catch (e) {}
    currentSourceNode = null;
  }
}

// ------------------------------
// AudioBuffer utilities
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

  if (historyStack.length > 20) {
    historyStack.shift();
  }

  undoBtn.disabled = historyStack.length === 0;
}

function clampSample(v) {
  return Math.max(-1, Math.min(1, v));
}

// ------------------------------
// 第2段階: 波形表示
// ------------------------------
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
  viewInfoEl.textContent = `表示範囲: ${startRatio}% ～ ${endRatio}%`;
}

function clearSelection() {
  selectionStart = null;
  selectionEnd = null;
  isSelecting = false;
  selectionInfoEl.textContent = "選択範囲: なし";
  playSelectionBtn.disabled = true;
}

function updateSelectionInfo() {
  if (selectionStart == null || selectionEnd == null || !editedAudioBuffer) {
    selectionInfoEl.textContent = "選択範囲: なし";
    playSelectionBtn.disabled = true;
    return;
  }

  const s = Math.min(selectionStart, selectionEnd);
  const e = Math.max(selectionStart, selectionEnd);

  const startSec = (s / editedAudioBuffer.sampleRate).toFixed(2);
  const endSec = (e / editedAudioBuffer.sampleRate).toFixed(2);
  selectionInfoEl.textContent = `選択範囲: ${startSec}s ～ ${endSec}s`;
  playSelectionBtn.disabled = false;
}

function drawWaveform() {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;

  ctx.clearRect(0, 0, width, height);

  // 背景
  ctx.fillStyle = "#fafafa";
  ctx.fillRect(0, 0, width, height);

  // 中央線
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

  // 選択範囲表示
  if (selectionStart != null && selectionEnd != null) {
    const s = Math.min(selectionStart, selectionEnd);
    const e = Math.max(selectionStart, selectionEnd);

    const x1 = sampleToCanvasX(s);
    const x2 = sampleToCanvasX(e);

    ctx.fillStyle = "rgba(0, 0, 255, 0.12)";
    ctx.fillRect(x1, 0, x2 - x1, height);

    ctx.strokeStyle = "rgba(0, 0, 255, 0.8)";
    ctx.beginPath();
    ctx.moveTo(x1, 0);
    ctx.lineTo(x1, height);
    ctx.moveTo(x2, 0);
    ctx.lineTo(x2, height);
    ctx.stroke();
  }
}

// ------------------------------
// 座標変換
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
// 第3段階: 波形編集
// ------------------------------
function applyDrawTool(sampleCenter, ampTarget) {
  const data = editedAudioBuffer.getChannelData(0);
  const radius = parseInt(brushSizeInput.value, 10);
  const strength = parseInt(strengthInput.value, 10) / 100;

  const start = Math.max(0, sampleCenter - radius);
  const end = Math.min(data.length - 1, sampleCenter + radius);

  for (let i = start; i <= end; i++) {
    const dist = Math.abs(i - sampleCenter) / radius;
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

function applyGainTool(sampleCenter, gainDirection = 1) {
  const data = editedAudioBuffer.getChannelData(0);
  const radius = parseInt(brushSizeInput.value, 10);
  const strength = parseInt(strengthInput.value, 10) / 100;
  const gainBase = 1 + gainDirection * strength * 0.8;

  const start = Math.max(0, sampleCenter - radius);
  const end = Math.min(data.length - 1, sampleCenter + radius);

  for (let i = start; i <= end; i++) {
    const dist = Math.abs(i - sampleCenter) / radius;
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
    const dist = Math.abs(i - sampleCenter) / radius;
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
    applyGainTool(sample, 1);
  } else if (tool === "erase") {
    applyEraseTool(sample);
  }
}

// ------------------------------
// 第4段階: undo / reset / 比較
// ------------------------------
function resetEditedAudio() {
  if (!originalAudioBuffer) return;
  pushHistory();
  editedAudioBuffer = cloneAudioBuffer(originalAudioBuffer);
  clearSelection();
  resetView();
  drawWaveform();
  setStatus("編集をリセット");
}

function undoEdit() {
  if (historyStack.length === 0) return;
  editedAudioBuffer = historyStack.pop();
  undoBtn.disabled = historyStack.length === 0;
  drawWaveform();
  setStatus("1段階戻しました");
}

function enableEditingButtons(enabled) {
  playOriginalBtn.disabled = !enabled;
  playEditedBtn.disabled = !enabled;
  resetBtn.disabled = !enabled;
  saveBtn.disabled = !enabled;
  zoomInBtn.disabled = !enabled;
  zoomOutBtn.disabled = !enabled;
  fullViewBtn.disabled = !enabled;
  undoBtn.disabled = historyStack.length === 0 || !enabled;
}

// ------------------------------
// 第5段階: ズーム / 範囲選択 / 部分再生 / 保存
// ------------------------------
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
    const overshoot = newEnd - editedAudioBuffer.length;
    newStart -= overshoot;
    newEnd = editedAudioBuffer.length;
  }

  newStart = Math.max(0, newStart);
  newEnd = Math.min(editedAudioBuffer.length, newEnd);

  viewStart = newStart;
  viewEnd = newEnd;
  updateViewInfo();
  drawWaveform();
}

function playSelection() {
  if (!editedAudioBuffer || selectionStart == null || selectionEnd == null) return;
  const s = Math.min(selectionStart, selectionEnd);
  const e = Math.max(selectionStart, selectionEnd);
  const sr = editedAudioBuffer.sampleRate;
  playAudioBuffer(editedAudioBuffer, s / sr, e / sr);
}

function exportEditedWav() {
  if (!editedAudioBuffer) return;

  const wavBlob = audioBufferToWavBlob(editedAudioBuffer);
  const url = URL.createObjectURL(wavBlob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "edited_voice.wav";
  a.click();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
  setStatus("WAVを書き出しました");
}

// WAV変換
function audioBufferToWavBlob(buffer) {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;

  const samples = buffer.length;
  const blockAlign = numChannels * bitDepth / 8;
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples * blockAlign;
  const bufferSize = 44 + dataSize;

  const arrayBuffer = new ArrayBuffer(bufferSize);
  const view = new DataView(arrayBuffer);

  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
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

  for (let i = 0; i < samples; i++) {
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

// ------------------------------
// Pointer Events
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
    isSelecting = true;
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

  // ドラッグ中は補間しながら複数点適用
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
  isSelecting = false;
});

canvas.addEventListener("pointercancel", () => {
  isPointerDown = false;
  isSelecting = false;
});

// ------------------------------
// Buttons
// ------------------------------
recordBtn.addEventListener("click", async () => {
  if (!mediaRecorder || mediaRecorder.state === "inactive") {
    await startRecording();
  } else {
    stopRecording();
  }
});

playOriginalBtn.addEventListener("click", () => {
  playAudioBuffer(originalAudioBuffer);
});

playEditedBtn.addEventListener("click", () => {
  playAudioBuffer(editedAudioBuffer);
});

undoBtn.addEventListener("click", () => {
  undoEdit();
});

resetBtn.addEventListener("click", () => {
  resetEditedAudio();
});

saveBtn.addEventListener("click", () => {
  exportEditedWav();
});

zoomInBtn.addEventListener("click", () => {
  zoomView(0.5);
});

zoomOutBtn.addEventListener("click", () => {
  zoomView(2.0);
});

fullViewBtn.addEventListener("click", () => {
  resetView();
  drawWaveform();
});

playSelectionBtn.addEventListener("click", () => {
  playSelection();
});

// ------------------------------
// 初期表示
// ------------------------------
drawWaveform();