"use client";

import React, { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

/** A person's avatar as a drifting fluid sphere, rendered in WebGL (component
 *  supplied by the user 2026-09-22 and kept as written — the shader is the
 *  valuable part).
 *
 *  Two things are ours. **One context for every orb:** browsers keep only ~16
 *  WebGL contexts per page before they start losing the oldest, so an orb no
 *  longer owns one. A single hidden canvas holds the page's only orb context;
 *  each frame it draws every visible orb in turn and copies the result into
 *  that orb's own 2D canvas, which has no such limit. So a screen full of
 *  people animates every avatar, not just the first ten (it used to cap at
 *  ten and leave the rest on the static gradient). **And a pause when
 *  offscreen:** an orb that isn't on screen isn't drawn, and with none on
 *  screen the frame loop stops. */

export type FluidOrbProps = React.ComponentProps<"div"> & {
  size?: number;
  color?: string;
  /** Fires when the orb starts, and again if it stops being drawn (the shared
   *  context was lost, or WebGL isn't available). The caller uses it to hide
   *  whatever it is showing underneath: the orb's edge is antialiased into
   *  transparency, so anything behind it survives as a rim around the sphere. */
  onPainted?: (painted: boolean) => void;
};

const VERT = `
attribute vec2 a_pos;
void main() {
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

const FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform vec2 u_resolution;
uniform float u_time;
uniform vec3 u_color;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.6;
  for (int i = 0; i < 3; i++) {
    v += a * noise(p);
    p *= 2.0;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  float t = u_time * 0.22;

  vec2 drift = vec2(
    sin(t) + 0.6 * sin(t * 1.7 + 1.3),
    cos(t * 0.8) + 0.6 * cos(t * 1.3 + 2.1)
  );

  vec2 p = vec2(uv.x * 1.8, uv.y * 1.0) + drift * 0.7;

  vec2 q = vec2(fbm(p + drift), fbm(p + vec2(3.2, 1.5) - drift));
  float f = fbm(p + 1.2 * q);

  float g = clamp(1.0 - uv.y, 0.0, 1.0);
  float anchor = smoothstep(0.0, 0.3, uv.y);
  float shade = clamp(g + (f - 0.5) * 0.8 * anchor, 0.0, 1.0);

  vec3 white = vec3(0.99, 1.0, 1.0);
  vec3 light = mix(white, u_color, 0.5);
  vec3 dark = u_color;

  vec3 col = white;
  col = mix(col, light, smoothstep(0.28, 0.52, shade));
  col = mix(col, dark, smoothstep(0.58, 0.88, shade));

  float edge = smoothstep(0.5, 0.49, distance(uv, vec2(0.5)));

  gl_FragColor = vec4(col * edge, edge);
}
`;

function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace("#", "").trim();
  if (h.length === 3) {
    h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  }
  const n = parseInt(h, 16);
  if (h.length !== 6 || Number.isNaN(n)) return [0.1, 0.45, 0.95];
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

type Orb = {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  /** Device pixels per side. */
  px: number;
  rgb: [number, number, number];
  /** Each orb keeps its own clock, so neighbours don't drift in lockstep. */
  start: number;
  visible: boolean;
  setPainted: (painted: boolean) => void;
};

type Renderer = {
  canvas: HTMLCanvasElement;
  gl: WebGLRenderingContext;
  uResolution: WebGLUniformLocation | null;
  uTime: WebGLUniformLocation | null;
  uColor: WebGLUniformLocation | null;
  ready: boolean;
};

const orbs = new Set<Orb>();
/** `undefined` until first needed; `null` once WebGL turned out unavailable. */
let renderer: Renderer | null | undefined;
let observer: IntersectionObserver | null = null;
const orbByCanvas = new WeakMap<Element, Orb>();
let raf = 0;

function reducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Compiles the program into `gl`. Run again after a lost context comes back:
 *  everything a context held goes with it. */
function setUp(r: Renderer) {
  const { gl } = r;
  const program = gl.createProgram();
  const vert = compile(gl, gl.VERTEX_SHADER, VERT);
  const frag = compile(gl, gl.FRAGMENT_SHADER, FRAG);
  if (!program || !vert || !frag) return false;
  gl.attachShader(program, vert);
  gl.attachShader(program, frag);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(program));
    return false;
  }
  gl.useProgram(program);

  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    gl.STATIC_DRAW,
  );
  const aPos = gl.getAttribLocation(program, "a_pos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  r.uResolution = gl.getUniformLocation(program, "u_resolution");
  r.uTime = gl.getUniformLocation(program, "u_time");
  r.uColor = gl.getUniformLocation(program, "u_color");
  r.ready = true;
  return true;
}

function getRenderer(): Renderer | null {
  if (renderer !== undefined) return renderer;
  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl", { antialias: true, alpha: true });
  if (!gl) return (renderer = null);
  const r: Renderer = {
    canvas,
    gl,
    uResolution: null,
    uTime: null,
    uColor: null,
    ready: false,
  };
  canvas.addEventListener("webglcontextlost", (event) => {
    // Asking for the context back; until then every caller shows its fallback.
    event.preventDefault();
    r.ready = false;
    cancelAnimationFrame(raf);
    raf = 0;
    orbs.forEach((orb) => orb.setPainted(false));
  });
  canvas.addEventListener("webglcontextrestored", () => {
    if (!setUp(r)) return;
    const now = performance.now();
    orbs.forEach((orb) => {
      paint(orb, now);
      orb.setPainted(true);
    });
    loop();
  });
  if (!setUp(r)) return (renderer = null);
  return (renderer = r);
}

/** Draws one orb into the shared canvas's bottom-left corner (WebGL's origin)
 *  and copies that square into the orb's own canvas. */
function paint(orb: Orb, now: number) {
  const r = renderer;
  if (!r || !r.ready) return;
  const { gl, canvas } = r;
  if (canvas.width < orb.px || canvas.height < orb.px) {
    canvas.width = Math.max(canvas.width, orb.px);
    canvas.height = Math.max(canvas.height, orb.px);
  }
  gl.viewport(0, 0, orb.px, orb.px);
  gl.uniform2f(r.uResolution, orb.px, orb.px);
  gl.uniform3f(r.uColor, ...orb.rgb);
  gl.uniform1f(r.uTime, reducedMotion() ? 0 : (now - orb.start) / 1000);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  orb.ctx.clearRect(0, 0, orb.px, orb.px);
  orb.ctx.drawImage(
    canvas,
    0,
    canvas.height - orb.px,
    orb.px,
    orb.px,
    0,
    0,
    orb.px,
    orb.px,
  );
}

/** One frame loop for every orb, running only while one is on screen. */
function loop() {
  if (raf || reducedMotion()) return;
  const frame = (now: number) => {
    raf = 0;
    if (!renderer?.ready) return;
    let any = false;
    orbs.forEach((orb) => {
      if (!orb.visible) return;
      any = true;
      paint(orb, now);
    });
    if (any) raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
}

function getObserver() {
  observer ??= new IntersectionObserver((entries) => {
    let shown = false;
    for (const entry of entries) {
      const orb = orbByCanvas.get(entry.target);
      if (!orb) continue;
      orb.visible = entry.isIntersecting;
      shown ||= orb.visible;
    }
    if (shown) loop();
  });
  return observer;
}

export function FluidOrb({
  size = 240,
  color = "#1A73F2",
  onPainted,
  className,
  style,
  ...props
}: FluidOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  /** False until the orb has actually been drawn, so the caller's fallback is
   *  what shows while this is starting, unsupported, or its context is lost. */
  const [painted, setPainted] = useState(false);
  /** Kept in a ref so the effect doesn't restart when the caller passes a new
   *  inline function on every render. */
  const onPaintedRef = useRef(onPainted);
  useEffect(() => {
    onPaintedRef.current = onPainted;
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const r = getRenderer();
    const ctx = canvas.getContext("2d");
    if (!r || !ctx) return;

    const px = Math.round(size * Math.min(window.devicePixelRatio || 1, 2));
    canvas.width = px;
    canvas.height = px;

    const orb: Orb = {
      canvas,
      ctx,
      px,
      rgb: hexToRgb(color),
      start: performance.now(),
      // Drawn once straight away; the observer says soon after if it's offscreen.
      visible: true,
      setPainted: (next) => {
        setPainted(next);
        onPaintedRef.current?.(next);
      },
    };
    orbs.add(orb);
    orbByCanvas.set(canvas, orb);
    getObserver().observe(canvas);

    if (r.ready) {
      paint(orb, orb.start);
      orb.setPainted(true);
      loop();
    }

    return () => {
      observer?.unobserve(canvas);
      orbByCanvas.delete(canvas);
      orbs.delete(orb);
      orb.setPainted(false);
    };
  }, [size, color]);

  return (
    <div
      data-slot="fluid-orb"
      className={cn("relative overflow-hidden rounded-full", className)}
      style={{ width: size, height: size, ...style }}
      {...props}
    >
      <canvas
        ref={canvasRef}
        className={cn(
          "h-full w-full transition-opacity duration-200",
          painted ? "opacity-100" : "opacity-0",
        )}
      />
    </div>
  );
}

export default FluidOrb;
