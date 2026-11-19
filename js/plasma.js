import { createBackground } from "./plasma-field.js";
import { createGrid, enterPlasma } from "./plasma-grid.js";

const canvas = document.querySelector("#plasma-background");
const box = document.querySelector("#plasma-window");
const host = document.querySelector("#plasma-terminal");
const caption = document.querySelector("#plasma-caption");
const status = document.querySelector("#plasma-status");
const motion = document.querySelector("#plasma-motion");
const statsToggle = document.querySelector("#plasma-stats-toggle");
const stats = document.querySelector("#plasma-stats");

const paintBackground = createBackground(canvas);
const reduced = matchMedia("(prefers-reduced-motion: reduce)");
const edge = new URLSearchParams(location.search).get("edge") === "quantized" ? 2 : 1;
const encode = new TextEncoder();
const decode = new TextDecoder();
const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
const framePeriod = 1000 / 60;
const echoDuration = 3600;
let playing = !reduced.matches;
let motionChosen = false;
let terminal, surface, paintGrid, pending, layout, geometry, pixelRatio = window.devicePixelRatio;
let raf = 0, lastTick, nextTick, phase = 3.1, acceptedFrame, frameNeeded = true, needsLayout = true;
let typed = "", echoExpires = 0, echoTimer, selectionActive = false;
let rateSince, frames = 0, bytes = 0, writes = 0, skips = 0, totalSkips = 0;

function animate() {
  return playing && !selectionActive;
}

function requestFrame() {
  if (!raf && !document.hidden)
    raf = requestAnimationFrame(frame);
}

function refresh() {
  frameNeeded = true;
  requestFrame();
}

function invalidateLayout() {
  needsLayout = true;
  refresh();
}

function viewGeometry() {
  const { left, top, width, height } = canvas.getBoundingClientRect();
  const wantedWidth = Math.max(1, Math.round(width * pixelRatio));
  const wantedHeight = Math.max(1, Math.round(height * pixelRatio));
  if (canvas.width !== wantedWidth) canvas.width = wantedWidth;
  if (canvas.height !== wantedHeight) canvas.height = wantedHeight;
  return { x: window.scrollX + left, y: window.scrollY + top, width, height };
}

function terminalGeometry() {
  const { left, top, width, height, right, bottom } = box.getBoundingClientRect();
  return {
    x: window.scrollX + left, y: window.scrollY + top,
    right: window.scrollX + right, bottom: window.scrollY + bottom,
    width, height,
  };
}

async function readCellSize() {
  let size;
  const subscription = terminal.onData(data => {
    const match = /^\x1b\[6;(\d+);(\d+)t$/.exec(decode.decode(data));
    if (match) size = { width: Number(match[2]), height: Number(match[1]) };
  });
  try {
    await terminal.write("\x1b[16t");
  } finally {
    subscription.dispose();
  }
  if (!size?.width || !size?.height) throw new Error("The terminal did not report its cell size");
  return { width: size.width / pixelRatio, height: size.height / pixelRatio };
}

function fontSize() {
  return innerWidth < 540 ? 11 : 13;
}

async function measureLayout() {
  if (terminal.settings.get()["font.size"] !== fontSize()) {
    terminal.settings.set({ "font.size": fontSize() });
  }
  // Let the renderer apply its viewport and font changes before querying cells.
  await new Promise(requestAnimationFrame);
  await new Promise(requestAnimationFrame);
  const { width, height } = await readCellSize();
  const cols = Math.max(1, Math.floor(innerWidth * .6 / width));
  const rows = Math.max(1, Math.floor(Math.max(144, Math.min(innerHeight * .38, 352)) / height));
  box.style.width = `${cols * width}px`;
  box.style.height = `${rows * height}px`;
  if (geometry?.cols !== cols || geometry?.rows !== rows) {
    paintGrid = createGrid(cols, rows);
    geometry = { cols, rows, width: 0, height: 0 };
    typed = limitInput(typed);
  }
  geometry.width = Math.round(cols * width * pixelRatio);
  geometry.height = Math.round(rows * height * pixelRatio);
  if (terminal.cols !== cols || terminal.rows !== rows) terminal.resize(cols, rows);
  fitSurface();
}

function fitSurface() {
  if (!geometry) return;
  // A browser can retain a larger backing store during a DPR transition.
  // Show the grid at its measured CSS size and clip the surplus backing strip.
  const x = Math.max(1, surface.width / geometry.width);
  const y = Math.max(1, surface.height / geometry.height);
  surface.style.transformOrigin = "top left";
  surface.style.transform = x === 1 && y === 1 ? "" : `scale(${x}, ${y})`;
}

function watchTerminalSurface() {
  const backing = surface = host.querySelector("canvas");
  let width = backing.width, height = backing.height;
  new MutationObserver(() => {
    if (surface !== backing || (width === backing.width && height === backing.height)) return;
    width = backing.width;
    height = backing.height;
    // A DPR change can recreate the backing store without changing the grid.
    invalidateLayout();
  }).observe(backing, { attributes: true, attributeFilter: ["width", "height"] });
}

function markRate(now) {
  rateSince ??= now;
  const interval = (now - rateSince) / 1000;
  if (interval < 1) return;
  const fps = frames / interval;
  const bytesPerFrame = writes ? Math.round(bytes / writes) : 0;
  stats.value = terminal
    ? `${fps.toFixed(1)} fps · ${bytesPerFrame} B/frame\n${skips} pending-write skips · ${totalSkips} total`
    : `${fps.toFixed(1)} fps · canvas`;
  rateSince = now;
  frames = bytes = writes = skips = 0;
}

function stopDisplayClock() {
  lastTick = nextTick = rateSince = undefined;
  frames = bytes = writes = skips = 0;
}

function handleError(error) {
  if (terminal) {
    terminal.dispose();
    terminal = surface = paintGrid = acceptedFrame = undefined;
    selectionActive = false;
  }
  delete host.dataset.ready;
  box.style.removeProperty("width");
  box.style.removeProperty("height");
  caption.hidden = true;
  status.hidden = false;
  status.textContent = error ? "Puzzle terminal unavailable" : "Puzzle terminal needs WebGPU";
  if (error) console.error(error);
  refresh();
}

function presentTerminalFrame() {
  if (!acceptedFrame || layout || document.hidden) return;
  const { phase, view, bounds } = acceptedFrame;
  acceptedFrame = undefined;
  paintBackground(phase, view, bounds, edge);
  if (!host.hasAttribute("data-ready")) {
    host.dataset.ready = "";
    status.hidden = true;
  }
}

function frame(now) {
  raf = 0;
  if (document.hidden) return;
  if (pixelRatio !== window.devicePixelRatio) {
    pixelRatio = window.devicePixelRatio;
    frameNeeded = needsLayout = true;
  }
  const moving = animate();
  if (terminal && needsLayout && !layout && !pending) {
    needsLayout = false;
    acceptedFrame = undefined;
    layout = measureLayout().catch(handleError).finally(() => {
      layout = undefined;
      refresh();
    });
  }
  if (layout || (moving && !frameNeeded && nextTick !== undefined && now + 1.25 < nextTick)) {
    if (moving || layout) requestFrame();
    return;
  }
  if (!moving && !frameNeeded) return;

  if (moving) {
    if (lastTick !== undefined) phase += Math.min(100, now - lastTick) / 1000;
    lastTick = now;
    nextTick = nextTick === undefined || now - nextTick > framePeriod
      ? now + framePeriod : nextTick + framePeriod;
  }

  if (pending) {
    if (moving) {
      skips++;
      totalSkips++;
      markRate(now);
      requestFrame();
    }
    // Keep the canvas in step with the last terminal frame on backpressure.
    return;
  }

  const view = viewGeometry();
  const bounds = terminal && geometry ? terminalGeometry() : undefined;
  if (!bounds) {
    paintBackground(phase, view, undefined, 0);
  } else {
    if (typed && !selectionActive && now >= echoExpires) typed = "";
    const frameText = paintGrid(bounds, phase, typed);
    const target = { phase, view, bounds };
    if (frameText) {
      const payload = encode.encode(frameText);
      bytes += payload.byteLength;
      writes++;
      pending = terminal.write(payload).then(() => {
        acceptedFrame = target;
      }).catch(handleError).finally(() => {
        pending = undefined;
        if (frameNeeded) requestFrame();
      });
    } else if (!acceptedFrame) {
      paintBackground(phase, view, bounds, edge);
    }
  }

  frames++;
  markRate(now);
  frameNeeded = false;
  if (moving) requestFrame();
}

function limitInput(text) {
  // Reserve up to two columns per grapheme for wide characters.
  const capacity = Math.max(1, Math.floor(((geometry?.cols ?? 1) - 4) / 2));
  return [...segmenter.segment(text)].slice(-capacity).map(part => part.segment).join("");
}

function onInput(data) {
  const text = decode.decode(data);
  if (!text || text.startsWith("\x1b") || !terminal.hasFocus) return;
  if (text === "\x7f" || text === "\b") {
    typed = [...segmenter.segment(typed)].slice(0, -1).map(part => part.segment).join("");
  } else {
    const clean = text.replace(/\p{Cc}/gu, "");
    if (!clean) return;
    typed = limitInput(typed + clean);
  }
  echoExpires = performance.now() + echoDuration;
  clearTimeout(echoTimer);
  echoTimer = setTimeout(refresh, echoDuration + 10);
  refresh();
}

function updateMotion() {
  motion.textContent = playing ? "Pause" : "Play";
  stopDisplayClock();
  refresh();
}

motion.addEventListener("click", () => {
  playing = !playing;
  motionChosen = true;
  updateMotion();
});
reduced.addEventListener("change", ({ matches }) => {
  if (!motionChosen) {
    playing = !matches;
    updateMotion();
  }
});
statsToggle.addEventListener("click", () => {
  stats.hidden = !stats.hidden;
  statsToggle.setAttribute("aria-expanded", String(!stats.hidden));
  if (!stats.value) stats.value = playing ? "Measuring…" : "Animation paused";
  refresh();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    cancelAnimationFrame(raf);
    raf = 0;
    stopDisplayClock();
  } else {
    invalidateLayout();
  }
});
window.addEventListener("scroll", refresh, { passive: true });
window.addEventListener("resize", () => {
  pixelRatio = window.devicePixelRatio;
  invalidateLayout();
});

function watchPixelRatio() {
  const resolution = matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
  resolution.addEventListener("change", () => {
    pixelRatio = window.devicePixelRatio;
    watchPixelRatio();
    invalidateLayout();
  }, { once: true });
}

async function initTerminal() {
  try {
    const moduleUrl = new URL("../puzzle/puzzle_web.js", import.meta.url);
    const { default: init, PuzzleTerminal } = await import(moduleUrl.href);
    await init();
    if (!(await PuzzleTerminal.isSupported()).webgpu) {
      handleError();
      return;
    }
    terminal = await PuzzleTerminal.create(host, {
      cols: 2, rows: 2,
      assetsUrl: new URL("./assets/", moduleUrl).href,
      settings: {
        "font.size": fontSize(),
        "font.builtinGlyphs": true,
        "render.padding": 0,
        "theme.mode": "dark",
        "theme.dark": "plasma",
        themes: { plasma: { base: "puzzle-dark", scrollbarThumb: "#00000000", scrollbarTrack: "#00000000" } },
      },
    });
    terminal.on("resize", ({ cols, rows }) => {
      if (cols !== geometry?.cols || rows !== geometry?.rows) invalidateLayout();
    });
    watchTerminalSurface();
    terminal.on("selectionChange", range => {
      selectionActive = Boolean(range);
      stopDisplayClock();
      refresh();
    });
    terminal.onData(onInput);
    // Puzzle can submit after the write's rAF. Keep the last canvas frame
    // visible until the same phase is submitted by the terminal.
    terminal.bus.subscribe("render/frameRendered", presentTerminalFrame);
    await terminal.write(enterPlasma);
    invalidateLayout();
  } catch (error) {
    handleError(error);
  }
}

watchPixelRatio();
updateMotion();
initTerminal();
