import { createHeroFit } from "./hero-fit.js";

const frame = document.querySelector("#terminal-frame");
const stage = document.querySelector("#stage");
const host = document.querySelector("#terminal");
const poster = document.querySelector("#poster");
const play = document.querySelector("#play");
const restart = document.querySelector("#restart");
const scene = document.querySelector("#scene");
const scale = document.querySelector("#scale");
const statsToggle = document.querySelector("#stats-toggle");
const stats = document.querySelector("#stats");
const live = document.querySelector("#live");
const fullscreen = document.querySelector("#fullscreen");
const status = document.querySelector("#play-status");
const unsupported = document.querySelector("#unsupported");

const params = new URLSearchParams(location.search);
const initialPart = params.get("part");
if (initialPart !== null && [...scene.options].some(option => option.value === initialPart))
  scene.value = initialPart;
if (params.get("scale") === "half") scale.value = "half";

const reset = "\x1bc";
let terminal, runtime, player, fitGrid, statsTimer;
let currentRun = 0;
let available = false, busy = false;

function controls() {
  play.disabled = !available || busy;
  scene.disabled = scale.disabled = !available || busy;
  restart.disabled = statsToggle.disabled = !player || busy;
}

function showPoster(message) {
  frame.dataset.state = "poster";
  poster.hidden = false;
  play.hidden = !available;
  host.setAttribute("aria-hidden", "true");
  status.textContent = message;
}

// player.stats() starts a new measuring interval on every call, so one timer
// feeds both the optional overlay and the live counter.
function refreshStats() {
  const reading = player?.stats();
  if (!stats.hidden) stats.value = runtime?.formatSrStats(reading) || "Collecting playback statistics…";
  if (reading && frame.dataset.state === "playing" && reading.fps > 0) {
    const kb = reading.bytesPerSecond / 1024;
    const rate = kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB/s` : `${kb.toFixed(0)} KB/s`;
    live.textContent = `> Puzzle is parsing ${rate} of ANSI escape sequences · ${reading.fps.toFixed(0)} frames/s · ${Math.round(reading.bytesPerFrame).toLocaleString("en-US")} bytes/frame`;
    live.dataset.active = "";
  }
}

function stopLive() {
  clearInterval(statsTimer);
  statsTimer = undefined;
  delete live.dataset.active;
  live.textContent = "";
}

async function startPlayback(focusTerminal) {
  if (!available || busy) return;
  const run = ++currentRun;
  busy = true;
  stopLive();
  controls();
  status.textContent = "Starting…";
  try {
    if (player) {
      await player.destroy();
      player = undefined;
      await terminal.write(reset);
    }
    poster.hidden = play.hidden = true;
    host.setAttribute("aria-hidden", "false");
    if (focusTerminal) terminal.focus();
    player = await runtime.mountSecondReality({
      terminal,
      part: Number(scene.value),
      scale: scale.value,
      onGrid: fitGrid,
      onState(state, detail) {
        if (run !== currentRun) return;
        if (state === "part") {
          scene.value = String(detail);
          return;
        }
        if (state === "playing") {
          frame.dataset.state = "playing";
          status.textContent = "Playing";
          clearInterval(statsTimer);
          statsTimer = setInterval(refreshStats, 1000);
          return;
        }
        if (!stats.hidden) refreshStats();
        stopLive();
        showPoster(state === "error" ? "Playback failed" : "Playback ended");
      },
    });
  } catch (error) {
    stopLive();
    showPoster("Playback failed");
    console.error(error);
  } finally {
    busy = false;
    controls();
    if (!stats.hidden) refreshStats();
  }
}

play.addEventListener("click", () => startPlayback(true));
restart.addEventListener("click", () => startPlayback(false));
scene.addEventListener("change", () => {
  if (frame.dataset.state === "playing") startPlayback(false);
});
scale.addEventListener("change", () => player?.setScale(scale.value));

statsToggle.addEventListener("click", () => {
  stats.hidden = !stats.hidden;
  statsToggle.setAttribute("aria-expanded", String(!stats.hidden));
  if (!stats.hidden) stats.value = "Collecting playback statistics…";
});

fullscreen.disabled = !document.fullscreenEnabled;
fullscreen.addEventListener("click", async () => {
  try {
    if (document.fullscreenElement === frame) await document.exitFullscreen();
    else await frame.requestFullscreen();
  } catch (error) {
    status.textContent = "Fullscreen unavailable";
    console.error(error);
  }
});
document.addEventListener("fullscreenchange", () => {
  fullscreen.textContent = document.fullscreenElement === frame ? "Exit fullscreen" : "Fullscreen";
});

async function initPlayback() {
  try {
    const puzzleUrl = new URL("../puzzle/puzzle_web.js", import.meta.url);
    const { default: initPuzzle, PuzzleTerminal } = await import(puzzleUrl.href);
    await initPuzzle();
    const { webgpu } = await PuzzleTerminal.isSupported();
    if (!webgpu) {
      showPoster("WebGPU unavailable");
      unsupported.hidden = false;
      return;
    }
    const probeHost = document.createElement("div");
    probeHost.className = "terminal-fit-probe";
    probeHost.inert = true;
    stage.append(probeHost);
    const output = document.createElement("div");
    output.className = "terminal-output";
    host.append(output);
    const cols = 320, rows = 100;
    const options = {
      assetsUrl: new URL("./assets/", puzzleUrl).href,
      settings: { "font.size": 4, "render.padding": 0, "theme.mode": "dark" },
    };
    const [live, probe, module] = await Promise.all([
      PuzzleTerminal.create(output, { ...options, cols, rows }),
      PuzzleTerminal.create(probeHost, options),
      import("../ansi-second-reality/ansi-second-reality.js"),
    ]);
    terminal = live;
    runtime = module;
    fitGrid = createHeroFit({
      stage, host, output, terminal, probe, cols, rows,
      onError(error) {
        status.textContent = "Terminal fitting failed";
        console.error(error);
      },
    });
    available = true;
    showPoster("Ready to play");
    controls();
  } catch (error) {
    showPoster("Player unavailable");
    console.error(error);
  }
}

async function showBuildInfo() {
  const node = document.querySelector("#build-info");
  try {
    const response = await fetch(new URL("../build-info.json", import.meta.url));
    if (!response.ok) throw new Error(`Build info HTTP ${response.status}`);
    const info = await response.json();
    const label = ({ commit, dirty }) => `${commit.slice(0, 12)}${dirty ? " + local changes" : ""}`;
    node.textContent = `Puzzle ${label(info.puzzle)} · ANSI Second Reality ${label(info.ansiSecondReality)} · ${info.builtAt.slice(0, 10)} UTC`;
  } catch {
    node.textContent = "Build details unavailable";
  }
}

initPlayback();
showBuildInfo();
