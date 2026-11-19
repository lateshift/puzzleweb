// VICE's Colodore (PAL) VIC-II palette, in hardware index order.
// https://github.com/VICE-Team/svn-mirror/blob/main/vice/data/C64/colodore.vpl
export const palette = [
  "000000", "ffffff", "96282e", "5bd6ce", "9f2dad", "41b936", "2724c4", "eff347",
  "9f4815", "5e3500", "da5f66", "474747", "787878", "91ff84", "6864ff", "aeaeae",
];

const colours = palette.map(hex => [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16)));
const stops = [6, 14, 3, 13, 7, 10, 4];
const steps = 1024;
const ramp = new Uint8Array(steps * 4);
const indexedRamp = new Uint8Array(steps * 4);
const edgeRamp = new Uint8Array(steps * 4);

// Each wave is x frequency, y frequency, speed and amplitude. Both renderers
// sum these same waves in CSS pixels, independent of either backing store.
const waves = [
  [0.0105, 0.0017, 0.67, 0.155],
  [-0.0021, 0.0143, -0.83, 0.145],
  [0.0086, 0.0102, 0.54, 0.125],
  [0.0183, -0.0085, -0.42, 0.075],
];

export function plasma(x, y, t) {
  let value = 0.5;
  for (const [fx, fy, speed, amount] of waves)
    value += Math.sin(x * fx + y * fy + t * speed) * amount;
  return value;
}

function distance(a, b) {
  return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
}

function pairFor(rgb) {
  let first, second, best = Infinity, next = Infinity;
  for (let i = 0; i < colours.length; i++) {
    const error = distance(rgb, colours[i]);
    if (error < best) {
      second = first;
      next = best;
      first = i;
      best = error;
    } else if (error < next) {
      second = i;
      next = error;
    }
  }
  return { first, second };
}

const samples = Array.from({ length: steps }, (_, i) => {
  const stop = i * (stops.length - 1) / (steps - 1);
  const a = colours[stops[Math.floor(stop)]];
  const b = colours[stops[Math.min(stops.length - 1, Math.floor(stop) + 1)]];
  const rgb = a.map((channel, c) => channel + (b[c] - channel) * (stop % 1));
  const { first, second } = pairFor(rgb);
  const mix = Math.max(0, Math.min(1, colourProjection(rgb, first, second)));
  const average = colours[first].map((channel, c) =>
    Math.round(channel + (colours[second][c] - channel) * mix));
  ramp.set([...rgb.map(Math.round), 255], 4 * i);
  indexedRamp.set([...colours[first], 255], 4 * i);
  edgeRamp.set([...average, 255], 4 * i);
  return { rgb, first, second };
});

export function colourAt(value) {
  return samples[Math.max(0, Math.min(steps - 1, Math.round(value * (steps - 1))))];
}

export function colourProjection(rgb, first, second) {
  const start = colours[first], end = colours[second];
  const r = end[0] - start[0], g = end[1] - start[1], b = end[2] - start[2];
  return ((rgb[0] - start[0]) * r + (rgb[1] - start[1]) * g + (rgb[2] - start[2]) * b)
    / (r * r + g * g + b * b);
}

const vertexSource = `#version 300 es
void main() {
  vec2 corner = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(corner * 2.0 - 1.0, 0.0, 1.0);
}`;

const fragmentSource = `#version 300 es
precision highp float;
uniform vec4 uWaves[${waves.length}];
uniform vec2 uPixels;
uniform vec2 uSize;
uniform vec2 uPage;
uniform vec4 uTerminal;
uniform float uTime;
uniform int uEdge;
uniform sampler2D uPalette;
out vec4 outputColour;

float plasma(vec2 point, float time) {
  float value = 0.5;
  for (int i = 0; i < ${waves.length}; i++) {
    vec4 wave = uWaves[i];
    value += sin(dot(vec3(point, time), wave.xyz)) * wave.w;
  }
  return value;
}

void main() {
  vec2 page = vec2(gl_FragCoord.x, uPixels.y - gl_FragCoord.y) * uSize / uPixels + uPage;
  int index = int(round(clamp(plasma(page, uTime), 0.0, 1.0) * ${steps - 1}.0));
  vec4 smoothColour = texelFetch(uPalette, ivec2(index, 0), 0);
  vec4 c64Colour = texelFetch(uPalette, ivec2(index, uEdge == 2 ? 1 : 2), 0);
  vec2 fromEdge = max(uTerminal.xy - page, page - uTerminal.zw);
  float distance = length(max(fromEdge, vec2(0.0)));
  float blend = uEdge == 2 ? 1.0 : uEdge == 1 ? 1.0 - smoothstep(0.0, 14.0, distance) : 0.0;
  outputColour = mix(smoothColour, c64Colour, blend);
}`;

function compile(gl, kind, source) {
  const shader = gl.createShader(kind);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
    throw new Error(gl.getShaderInfoLog(shader));
  return shader;
}

function createGL(canvas, gl) {
  const program = gl.createProgram();
  const vertex = compile(gl, gl.VERTEX_SHADER, vertexSource);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, fragmentSource);
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS))
    throw new Error(gl.getProgramInfoLog(program));
  gl.useProgram(program);
  const uniform = name => gl.getUniformLocation(program, name);
  const pixels = uniform("uPixels"), size = uniform("uSize"), page = uniform("uPage");
  const terminal = uniform("uTerminal"), time = uniform("uTime"), edge = uniform("uEdge");
  gl.uniform4fv(uniform("uWaves[0]"), new Float32Array(waves.flat()));

  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, steps, 3);
  gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, steps, 1, gl.RGBA, gl.UNSIGNED_BYTE, ramp);
  gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 1, steps, 1, gl.RGBA, gl.UNSIGNED_BYTE, indexedRamp);
  gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 2, steps, 1, gl.RGBA, gl.UNSIGNED_BYTE, edgeRamp);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.uniform1i(uniform("uPalette"), 0);

  return (t, view, box, mode) => {
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(pixels, canvas.width, canvas.height);
    gl.uniform2f(size, view.width, view.height);
    gl.uniform2f(page, view.x, view.y);
    gl.uniform4f(terminal, box?.x ?? 0, box?.y ?? 0, box?.right ?? 0, box?.bottom ?? 0);
    gl.uniform1f(time, t);
    gl.uniform1i(edge, mode);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
}

function create2D(canvas) {
  const ctx = canvas.getContext("2d", { alpha: false });
  let image;
  return (t, view, box, mode) => {
    if (image?.width !== canvas.width || image?.height !== canvas.height)
      image = ctx.createImageData(canvas.width, canvas.height);
    const data = image.data;
    const dx = view.width / canvas.width, dy = view.height / canvas.height;
    const targetRamp = mode === 2 ? indexedRamp : edgeRamp;
    let i = 0;

    // Expand sin(x + y) into separable terms for the software path.
    const columns = waves.map(([fx]) => {
      const angles = new Float64Array(canvas.width * 2);
      for (let col = 0; col < canvas.width; col++) {
        const angle = (view.x + (col + .5) * dx) * fx;
        angles[2 * col] = Math.sin(angle);
        angles[2 * col + 1] = Math.cos(angle);
      }
      return angles;
    });
    for (let row = 0; row < canvas.height; row++) {
      const y = view.y + (row + .5) * dy;
      const coefficients = waves.map(([, fy, speed, amount]) => {
        const angle = y * fy + t * speed;
        return [Math.cos(angle) * amount, Math.sin(angle) * amount];
      });
      for (let col = 0; col < canvas.width; col++) {
        let value = .5;
        for (let w = 0; w < waves.length; w++)
          value += columns[w][col * 2] * coefficients[w][0] + columns[w][col * 2 + 1] * coefficients[w][1];
        const index = Math.max(0, Math.min(steps - 1, Math.round(value * (steps - 1)))) * 4;
        let blend = mode === 2 ? 1 : 0;
        if (mode === 1 && box) {
          const x = view.x + (col + .5) * dx;
          const a = Math.max(0, box.x - x, x - box.right);
          const b = Math.max(0, box.y - y, y - box.bottom);
          const d = Math.min(1, Math.hypot(a, b) / 14);
          blend = 1 - d * d * (3 - 2 * d);
        }
        for (let c = 0; c < 3; c++)
          data[i++] = ramp[index + c] + (targetRamp[index + c] - ramp[index + c]) * blend;
        data[i++] = 255;
      }
    }
    ctx.putImageData(image, 0, 0);
  };
}

export function createBackground(canvas) {
  const gl = canvas.getContext("webgl2", { alpha: false, antialias: false });
  return gl ? createGL(canvas, gl) : create2D(canvas);
}
