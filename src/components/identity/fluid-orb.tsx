"use client";

import React, { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

/** A person's avatar as a drifting fluid sphere, rendered in WebGL (component
 *  supplied by the user 2026-09-22 and kept as written — the shader is the
 *  valuable part).
 *
 *  Two things are ours. **A context budget:** every orb holds a live WebGL
 *  context, and browsers keep only ~16 per page before they start losing the
 *  oldest ones, so a team card with a dozen members could blank the sidebar's
 *  avatar. Past `MAX_LIVE_ORBS` an orb simply doesn't take a context, and the
 *  caller's static gradient stays visible underneath. **And a pause when
 *  offscreen:** an orb that isn't on screen stops its animation frame instead
 *  of burning a GPU loop behind a scrolled panel. */

export type FluidOrbProps = React.ComponentProps<"div"> & {
  size?: number;
  color?: string;
  /** Fires when the orb starts, and again if it gives its context up. The
   *  caller uses it to hide whatever it is showing underneath: the orb's edge
   *  is antialiased into transparency, so anything behind it survives as a
   *  rim around the sphere. */
  onPainted?: (painted: boolean) => void;
};

/** Below the browser's context ceiling, with room for the chrome's own orbs. */
const MAX_LIVE_ORBS = 10;
let liveOrbs = 0;

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

export function FluidOrb({
  size = 240,
  color = "#1A73F2",
  onPainted,
  className,
  style,
  ...props
}: FluidOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  /** False until a context is actually running, so the caller's fallback is
   *  what shows while this is starting, throttled, or unsupported. */
  const [painted, setPainted] = useState(false);
  /** Kept in a ref so the effect doesn't restart when the caller passes a new
   *  inline function on every render. */
  const onPaintedRef = useRef(onPainted);
  onPaintedRef.current = onPainted;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (liveOrbs >= MAX_LIVE_ORBS) return;

    const gl = canvas.getContext("webgl", { antialias: true, alpha: true });
    // `getContext` hands back the *same* context for a canvas every time, so a
    // context that has been lost stays lost for the life of the element — and
    // a lost context fails every compile with a null info log. Bail rather
    // than log nonsense; the caller's fallback covers it.
    if (!gl || gl.isContextLost()) return;

    const program = gl.createProgram();
    const vert = compile(gl, gl.VERTEX_SHADER, VERT);
    const frag = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!program || !vert || !frag) return;

    liveOrbs += 1;

    gl.attachShader(program, vert);
    gl.attachShader(program, frag);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error(gl.getProgramInfoLog(program));
      liveOrbs -= 1;
      return;
    }
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const aPos = gl.getAttribLocation(program, "a_pos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const uResolution = gl.getUniformLocation(program, "u_resolution");
    const uTime = gl.getUniformLocation(program, "u_time");
    gl.uniform3f(gl.getUniformLocation(program, "u_color"), ...hexToRgb(color));

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const px = Math.round(size * dpr);
    canvas.width = px;
    canvas.height = px;
    gl.viewport(0, 0, px, px);
    gl.uniform2f(uResolution, px, px);

    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const start = performance.now();
    let raf = 0;
    let visible = true;

    const render = (now: number) => {
      gl.uniform1f(uTime, reduce ? 0 : (now - start) / 1000);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      if (!reduce && visible) raf = requestAnimationFrame(render);
    };
    render(start);
    setPainted(true);
    onPaintedRef.current?.(true);

    // Nothing offscreen keeps a frame loop running.
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible && !reduce) {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(render);
      }
    });
    observer.observe(canvas);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(raf);
      gl.deleteProgram(program);
      gl.deleteShader(vert);
      gl.deleteShader(frag);
      gl.deleteBuffer(buffer);
      // Deliberately *not* `WEBGL_lose_context.loseContext()`: this canvas
      // outlives the effect (React runs effects twice in development, and any
      // re-render with a new size or colour restarts this one), and losing its
      // one context breaks every later mount. Dropping the program, shaders
      // and buffer is what there is to release; the context goes with the
      // element.
      liveOrbs -= 1;
      setPainted(false);
      onPaintedRef.current?.(false);
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
