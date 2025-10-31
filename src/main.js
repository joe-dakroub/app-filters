import * as filters from "./filters/index.js";

/* =====================================================================
   CONSTANTS & CONFIGURATION
   ===================================================================== */
const CANVAS_SCALE = 0.75;
const DOUBLE_TAP_DELAY = 300;
const FPS_CAP = 30;
const FRAME_INTERVAL = 1000 / FPS_CAP;
const RECORDING_DURATION = 30000;

// Build and sort filters
const FILTERS = Object.values(filters).sort((a, b) => {
  const orderA = a.order || 999;
  const orderB = b.order || 999;
  return orderA - orderB;
});

/* =====================================================================
   UTILITY FUNCTIONS
   ===================================================================== */
const q = (sel) => document.querySelector(sel);

const el = (tag, attrs = {}, ...kids) => {
  const n = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === "class") n.className = v;
    else if (k === "style") Object.assign(n.style, v);
    else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v);
  });
  kids.forEach((k) => n.append(k));
  return n;
};

function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  const c = m
    ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)]
    : [0, 0, 0];
  return c.map((v) => v / 255);
}

/* =====================================================================
   WEBGL SETUP & SHADERS
   ===================================================================== */
const VERT = `#version 300 es
precision highp float;
layout(location=0) in vec2 aPos;
uniform bool uFlipHorizontal;
out vec2 vUV;
void main(){ 
  vec2 uv = 0.5*(aPos+1.0);
  if(uFlipHorizontal) {
    uv.x = 1.0 - uv.x;
  }
  vUV = uv;
  gl_Position = vec4(aPos,0.0,1.0); 
}`;

// Initialize WebGL context
const canvas = q("#glcanvas");
const gl = canvas.getContext("webgl2", {
  antialias: false,
  preserveDrawingBuffer: true,
  alpha: true,
  premultipliedAlpha: false,
});

if (!gl) {
  alert("WebGL2 not supported.");
  throw new Error("No WebGL2");
}

gl.enable(gl.BLEND);
gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

// Create fullscreen triangle
const vao = gl.createVertexArray();
gl.bindVertexArray(vao);
const vbo = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
gl.bufferData(
  gl.ARRAY_BUFFER,
  new Float32Array([-1, -1, 3, -1, -1, 3]),
  gl.STATIC_DRAW
);
gl.enableVertexAttribArray(0);
gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
gl.bindVertexArray(null);

// Create texture
const tex = gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D, tex);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

// Shader compilation and linking
function compile(type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(sh);
    console.error(src);
    throw new Error("Shader compile failed: " + info);
  }
  return sh;
}

function link(vs, fs) {
  const p = gl.createProgram();
  gl.attachShader(p, vs);
  gl.attachShader(p, fs);
  gl.bindAttribLocation(p, 0, "aPos");
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error("Program link failed: " + gl.getProgramInfoLog(p));
  }
  return p;
}

// Program cache
const programCache = new Map();
const uniformLocationCache = new Map();

function getProgram(frag) {
  if (programCache.has(frag)) return programCache.get(frag);
  const p = link(
    compile(gl.VERTEX_SHADER, VERT),
    compile(gl.FRAGMENT_SHADER, frag)
  );
  programCache.set(frag, p);
  uniformLocationCache.set(p, new Map());
  return p;
}

function getUniformLocation(program, name) {
  const cache = uniformLocationCache.get(program);
  if (!cache) return gl.getUniformLocation(program, name);
  if (cache.has(name)) return cache.get(name);
  const loc = gl.getUniformLocation(program, name);
  cache.set(name, loc);
  return loc;
}

/* =====================================================================
   VIDEO & CAMERA MANAGEMENT
   ===================================================================== */
const video = q("#video");
let currentFacingMode = "user";
let stream = null;
let availableCameras = [];
let isCameraOn = true;

async function checkAvailableCameras() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    availableCameras = devices.filter((d) => d.kind === "videoinput");

    const flipBtn = q("#flipBtn");
    flipBtn.disabled = availableCameras.length <= 1;
  } catch (err) {
    console.error("Error enumerating devices:", err);
  }
}

async function startCamera() {
  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
  }
  stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: currentFacingMode,
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
    audio: true,
  });
  video.srcObject = stream;
  await video.play();
  await checkAvailableCameras();
}

await startCamera();

/* =====================================================================
   UI CONTROLS & FILTER MANAGEMENT
   ===================================================================== */
const select = q("#filterSelect");
const controlsHost = q("#controls");
let currentUniformValues = {};
let controlElements = {};

// Populate filter select
FILTERS.forEach((f) => {
  const displayName = f.order >= 0 ? `${f.order}. ${f.name}` : f.name;
  select.appendChild(el("option", { value: f.id }, displayName));

  if (f.id === "passthrough") {
    select.appendChild(document.createElement("hr"));
  }
});

select.value = "passthrough";

function updateRangeBackground(input) {
  const min = parseFloat(input.min) || 0;
  const max = parseFloat(input.max) || 100;
  const value = parseFloat(input.value) || 0;
  const percentage = ((value - min) / (max - min)) * 100;

  if (percentage === 0) {
    input.style.background = `transparent`;
  } else if (percentage === 100) {
    input.style.background = `var(--fg)`;
  } else {
    const thumbWidthPx = 4 * 16;
    const trackWidth = input.offsetWidth;
    const thumbRange = trackWidth - thumbWidthPx;
    const thumbCenterPosition =
      thumbWidthPx / 2 + (percentage / 100) * thumbRange;
    const adjustedPercentage = (thumbCenterPosition / trackWidth) * 100;
    input.style.background = `linear-gradient(to right, var(--fg) 0%, var(--fg) ${adjustedPercentage}%, transparent ${adjustedPercentage}%, transparent 100%)`;
  }
}

function buildControls(filter) {
  controlsHost.innerHTML = "";
  currentUniformValues = {};
  controlElements = {};

  if (!filter || !filter.uniforms) return;

  const fs = el("fieldset", {}, el("legend", {}, "Filter Controls"));

  filter.uniforms.forEach((spec) => {
    const name = spec.name;
    const displayName = spec.display || name;

    if (spec.type === "float") {
      currentUniformValues[name] = spec.default;

      if (spec.options && Array.isArray(spec.options)) {
        const selectEl = el("select", {
          oninput: (e) => {
            currentUniformValues[name] = parseFloat(e.target.value);
          },
        });
        for (let i = spec.min; i <= spec.max; i += spec.step) {
          const optionLabel = spec.options[i] || `Option ${i}`;
          const opt = el("option", { value: i }, optionLabel);
          if (i === spec.default) opt.selected = true;
          selectEl.appendChild(opt);
        }
        controlElements[name] = { element: selectEl, spec };
        fs.append(
          el(
            "div",
            { class: "row" },
            el("label", {}, el("span", {}, displayName), selectEl)
          )
        );
      } else {
        const precision = (spec.step + "").split(".")[1]?.length || 0;
        const inputId = `input-${filter.id}-${name}`;
        const num = el("output", { for: inputId }, String(spec.default));
        const input = el("input", {
          id: inputId,
          type: "range",
          min: spec.min,
          max: spec.max,
          step: spec.step,
          value: spec.default,
          oninput: (e) => {
            currentUniformValues[name] = parseFloat(e.target.value);
            num.textContent = (+e.target.value).toFixed(precision);
            updateRangeBackground(e.target);
          },
        });
        const sliderRow = el("div", { class: "slider-row" }, input, num);
        controlElements[name] = { element: input, numElement: num, spec };
        fs.append(
          el("div", { class: "row" }, el("span", {}, displayName), sliderRow)
        );
        requestAnimationFrame(() => updateRangeBackground(input));
      }
    } else if (spec.type === "color") {
      currentUniformValues[name] = hexToRgb(spec.default);
      const colorInput = el("input", {
        type: "color",
        value: spec.default,
        oninput: (e) => (currentUniformValues[name] = hexToRgb(e.target.value)),
      });
      controlElements[name] = { element: colorInput, spec };
      fs.append(
        el("div", { class: "row" }, el("span", {}, displayName), colorInput)
      );
    } else if (spec.type === "bool") {
      currentUniformValues[name] = !!spec.default;
      const checkboxAttrs = {
        type: "checkbox",
        oninput: (e) => (currentUniformValues[name] = e.target.checked),
      };
      if (spec.default) checkboxAttrs.checked = true;
      const checkbox = el("input", checkboxAttrs);
      const checkboxLabel = el(
        "label",
        { class: "checkbox-label" },
        checkbox,
        el("span", {}, displayName)
      );
      controlElements[name] = { element: checkbox, spec };
      fs.append(el("div", { class: "row" }, checkboxLabel));
    }
  });

  if (filter.uniforms && filter.uniforms.length > 0) {
    const hr = el("hr", {
      style: {
        border: 0,
        borderTop: "var(--border-width) solid var(--muted)",
        margin: "var(--space-3) 0",
      },
    });
    const resetBtn = el(
      "button",
      {
        style: { width: "100%", marginTop: "var(--space-2)" },
        onclick: () => resetControls(),
      },
      "Reset to Defaults"
    );
    fs.append(hr, resetBtn);
  }

  controlsHost.append(fs);
}

function resetControls() {
  Object.entries(controlElements).forEach(
    ([name, { element, numElement, spec }]) => {
      if (spec.type === "float") {
        element.value = spec.default;
        currentUniformValues[name] = spec.default;
        if (numElement) {
          const precision = (spec.step + "").split(".")[1]?.length || 0;
          numElement.textContent = spec.default.toFixed(precision);
        }
        updateRangeBackground(element);
      } else if (spec.type === "color") {
        element.value = spec.default;
        currentUniformValues[name] = hexToRgb(spec.default);
      } else if (spec.type === "bool") {
        element.checked = !!spec.default;
        currentUniformValues[name] = !!spec.default;
      }
    }
  );
}

buildControls(FILTERS.find((f) => f.id === select.value));
select.addEventListener("change", () =>
  buildControls(FILTERS.find((x) => x.id === select.value))
);

/* =====================================================================
   CANVAS & WINDOW MANAGEMENT
   ===================================================================== */
function resize() {
  const w = Math.floor(window.innerWidth * CANVAS_SCALE);
  const h = Math.floor(window.innerHeight * CANVAS_SCALE);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
    gl.viewport(0, 0, w, h);
  }
}

window.addEventListener("resize", resize);
resize();

/* =====================================================================
   FULLSCREEN & UI CONTROLS
   ===================================================================== */
const hud = q("#hud");

function inFullscreen() {
  return !!document.fullscreenElement;
}

async function enterFS() {
  document.body.classList.add("is-fullscreen");
  try {
    await document.documentElement.requestFullscreen?.();
  } catch (e) {
    console.warn("Fullscreen failed", e);
  }
  hud.classList.add("show");
  setTimeout(() => hud.classList.remove("show"), 1500);
}

async function exitFS() {
  document.body.classList.remove("is-fullscreen");
  try {
    await document.exitFullscreen?.();
  } catch {}
}

function toggleAside() {
  document.body.classList.toggle("hide-aside");
}

function toggleFade() {
  document.body.classList.toggle("fading-out");
}

/* =====================================================================
   EVENT HANDLERS
   ===================================================================== */
// Flip camera
q("#flipBtn").addEventListener("click", async () => {
  currentFacingMode = currentFacingMode === "user" ? "environment" : "user";
  await startCamera();
});

// Camera on/off toggle
q("#cameraBtn").addEventListener("click", async () => {
  isCameraOn = !isCameraOn;
  if (isCameraOn) {
    await startCamera();
    q("#cameraBtn").textContent = "Camera On";
  } else {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }
    video.pause();
    video.srcObject = null;
    video.src = "";
    video.load();
    q("#cameraBtn").textContent = "Camera Off";
  }
});

// Screenshot
q("#screenshotBtn").addEventListener("click", () => {
  const link = document.createElement("a");
  link.download = `filter-${new Date()
    .toISOString()
    .slice(0, 19)
    .replace(/:/g, "-")}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
});

// Video recording
let mediaRecorder = null;
let recordedChunks = [];
let recordingTimeout = null;
let countdownInterval = null;

q("#recordBtn").addEventListener("click", () => {
  if (mediaRecorder && mediaRecorder.state === "recording") {
    mediaRecorder.stop();
    if (recordingTimeout) clearTimeout(recordingTimeout);
    if (countdownInterval) clearInterval(countdownInterval);
    recordingTimeout = null;
    countdownInterval = null;
  } else {
    recordedChunks = [];
    const stream = canvas.captureStream(30);
    mediaRecorder = new MediaRecorder(stream, {
      mimeType: "video/webm;codecs=vp9",
      videoBitsPerSecond: 5000000,
    });

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) recordedChunks.push(e.data);
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(recordedChunks, { type: "video/webm" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `filter-${new Date()
        .toISOString()
        .slice(0, 19)
        .replace(/:/g, "-")}.webm`;
      link.click();
      URL.revokeObjectURL(url);
      q("#recordBtn").textContent = "Record";
      q("#recordBtn").style.background = "";
      if (countdownInterval) clearInterval(countdownInterval);
      countdownInterval = null;
    };

    mediaRecorder.start();
    q("#recordBtn").style.background = getComputedStyle(
      document.documentElement
    )
      .getPropertyValue("--record-active")
      .trim();

    let timeLeft = 30;
    q("#recordBtn").textContent = `Stop (${timeLeft}s)`;
    countdownInterval = setInterval(() => {
      timeLeft--;
      q("#recordBtn").textContent =
        timeLeft > 0 ? `Stop (${timeLeft}s)` : "Stopping...";
    }, 1000);

    recordingTimeout = setTimeout(() => {
      if (mediaRecorder && mediaRecorder.state === "recording") {
        mediaRecorder.stop();
      }
    }, RECORDING_DURATION);
  }
});

// Keyboard shortcuts
document.addEventListener("keydown", (e) => {
  if (e.key === "f" || e.key === "F") {
    e.preventDefault();
    inFullscreen() ? exitFS() : enterFS();
  }
  if (e.key === "h" || e.key === "H") {
    e.preventDefault();
    toggleAside();
  }
  if (e.key === "e" || e.key === "E") {
    e.preventDefault();
    toggleFade();
  }
});

// Fullscreen change
document.addEventListener("fullscreenchange", () => {
  if (!inFullscreen()) {
    document.body.classList.remove("is-fullscreen");
  }
});

// Double-tap to toggle controls (mobile)
let lastTapTime = 0;
canvas.addEventListener("touchend", (e) => {
  const currentTime = Date.now();
  const timeSinceLastTap = currentTime - lastTapTime;

  if (timeSinceLastTap < DOUBLE_TAP_DELAY && timeSinceLastTap > 0) {
    e.preventDefault();
    toggleAside();
    lastTapTime = 0;
  } else {
    lastTapTime = currentTime;
  }
});

/* =====================================================================
   RENDER LOOP
   ===================================================================== */
let lastFrameTime = 0;

function render(now) {
  if (now - lastFrameTime < FRAME_INTERVAL) {
    requestAnimationFrame(render);
    return;
  }
  lastFrameTime = now;

  resize();

  if (!isCameraOn) {
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    requestAnimationFrame(render);
    return;
  }

  if (video.readyState >= 2) {
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, video);
  }

  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  const filter = FILTERS.find((f) => f.id === select.value);
  const prog = getProgram(filter.frag);
  gl.useProgram(prog);
  gl.bindVertexArray(vao);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.uniform1i(getUniformLocation(prog, "uTex"), 0);
  gl.uniform2f(getUniformLocation(prog, "uRes"), canvas.width, canvas.height);
  gl.uniform1f(getUniformLocation(prog, "uTime"), now / 1000);
  gl.uniform1i(
    getUniformLocation(prog, "uFlipHorizontal"),
    currentFacingMode === "user" ? 1 : 0
  );

  if (filter.uniforms) {
    filter.uniforms.forEach((spec) => {
      const name = spec.name;
      const uniformName = "u" + name;
      const loc = getUniformLocation(prog, uniformName);
      if (!loc) return;
      const val = currentUniformValues[name];
      if (spec.type === "float") gl.uniform1f(loc, val);
      else if (spec.type === "color") gl.uniform3f(loc, val[0], val[1], val[2]);
      else if (spec.type === "bool") gl.uniform1i(loc, val ? 1 : 0);
    });
  }

  gl.drawArrays(gl.TRIANGLES, 0, 3);
  gl.bindVertexArray(null);
  requestAnimationFrame(render);
}

requestAnimationFrame(render);
