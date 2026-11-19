const fontSizes = [24, 20, 18, 16, 14, 12, 10, 9, 8, 7, 6, 5, 4];
const decoder = new TextDecoder();
const nextFrame = () => new Promise(requestAnimationFrame);

async function cellSize(terminal) {
  let size;
  const read = terminal.onData(bytes => {
    const reply = /^\x1b\[6;(\d+);(\d+)t$/.exec(decoder.decode(bytes));
    if (reply) size = { width: Number(reply[2]), height: Number(reply[1]) };
  });
  try {
    await terminal.write("\x1b[16t");
  } finally {
    read.dispose();
  }
  if (!size?.width || !size?.height) throw new Error("Puzzle did not report its cell size");
  return size;
}

async function capacity(probe, font) {
  let resized = false;
  const subscription = probe.on("resize", () => { resized = true; });
  try {
    probe.settings.set({ "font.size": font });
    // Font settings and the ResizeObserver update can arrive in different
    // frames. An unchanged fitted grid may emit no resize event.
    await nextFrame();
    probe.fit();
    await nextFrame();
    if (!resized) await nextFrame();
    return { cols: probe.cols, rows: probe.rows };
  } finally {
    subscription.dispose();
  }
}

export function createHeroFit({ stage, host, output, terminal, probe, cols, rows, onError }) {
  const surface = host.querySelector("canvas");
  let requested = 0, settled = -1, running = false, completedKey, raster;
  let observedDpr = devicePixelRatio;
  const fonts = new Map();

  function reveal() {
    if (settled !== requested || !raster) return;
    if (surface.width < raster.width || surface.height < raster.height) {
      host.dataset.fitting = "";
      return;
    }
    // Some browsers keep a larger backing store during a DPR transition.
    // Map only the cells to the host's bounds and clip the surplus.
    const x = raster.scaleX * surface.width / raster.width;
    const y = raster.scaleY * surface.height / raster.height;
    surface.style.transform = x === 1 && y === 1 ? "" : `scale(${x}, ${y})`;
    delete host.dataset.fitting;
  }

  async function fitPending() {
    running = true;
    try {
      for (;;) {
        // In fullscreen the flex stage is the content box left over after
        // the title and control bars. Read it after fullscreenchange/resize.
        await nextFrame();
        const version = requested;
        const { width, height } = stage.getBoundingClientRect();
        const dpr = devicePixelRatio;
        const key = [width, height, dpr, cols, rows].join("/");
        if (!width || !height) return;
        if (key === completedKey) {
          settled = version;
          reveal();
          return;
        }
        let font = fonts.get(key);
        if (!font) {
          for (const candidate of fontSizes) {
            const fitted = await capacity(probe, candidate);
            if (version !== requested) break;
            font = candidate;
            if (fitted.cols >= cols && fitted.rows >= rows) {
              const cell = await cellSize(probe);
              if (cols * cell.width <= width * dpr && rows * cell.height <= height * dpr) break;
            }
          }
          if (version !== requested) continue;
          if (fonts.size >= 32) fonts.clear();
          fonts.set(key, font);
        }

        terminal.settings.set({ "font.size": font });
        await nextFrame();
        await nextFrame();
        let cell = await cellSize(terminal);
        while (version === requested) {
          output.style.width = `${cols * cell.width / dpr}px`;
          output.style.height = `${rows * cell.height / dpr}px`;
          await nextFrame();
          await nextFrame();
          // The renderer can adopt the new DPR after the host is measured.
          const actual = await cellSize(terminal);
          if (actual.width === cell.width && actual.height === cell.height) break;
          cell = actual;
        }
        if (version !== requested) continue;

        // At the minimum font size a full grid can still exceed a small
        // stage. Keep every cell and scale the complete image to fit. The
        // two samples per half block retain the demo's square pixel aspect.
        const nativeWidth = cols * cell.width / dpr;
        const nativeHeight = rows * cell.height / dpr;
        const sample = Math.min(width / cols, height / (2 * rows));
        const displayWidth = sample * cols;
        const displayHeight = sample * 2 * rows;
        host.style.width = `${displayWidth}px`;
        host.style.height = `${displayHeight}px`;
        // Scale only the canvas. Puzzle must measure an unscaled host when
        // it reallocates the backing store after a DPR change.
        raster = {
          width: cols * cell.width,
          height: rows * cell.height,
          scaleX: displayWidth / nativeWidth,
          scaleY: displayHeight / nativeHeight,
        };
        completedKey = key;
        settled = version;
        reveal();
        return;
      }
    } catch (error) {
      onError(error);
    } finally {
      running = false;
    }
  }

  function requestFit() {
    observedDpr = devicePixelRatio;
    requested++;
    host.dataset.fitting = "";
    if (!running) void fitPending();
  }

  new MutationObserver(reveal).observe(surface, {
    attributes: true,
    attributeFilter: ["width", "height"],
  });
  new ResizeObserver(requestFit).observe(stage);
  window.addEventListener("resize", requestFit);
  document.addEventListener("fullscreenchange", requestFit);
  terminal.bus.subscribe("render/frameRendered", () => {
    // A DPR change can leave the stage's CSS dimensions unchanged.
    if (devicePixelRatio !== observedDpr) requestFit();
  });
  function watchDpr() {
    matchMedia(`(resolution: ${devicePixelRatio}dppx)`).addEventListener("change", () => {
      watchDpr();
      requestFit();
    }, { once: true });
  }
  watchDpr();

  return (newCols, newRows) => {
    if (newCols === cols && newRows === rows) return;
    cols = newCols;
    rows = newRows;
    requestFit();
    terminal.resize(cols, rows);
  };
}
