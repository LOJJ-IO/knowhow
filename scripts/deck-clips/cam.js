// Injected into every page: a camera on <body> and a macOS-style cursor
// outside it, so the cursor stays put in screen space while the page zooms.
(() => {
  const EASE = "cubic-bezier(0.65, 0, 0.35, 1)";
  const state = { tx: 0, ty: 0, s: 1 };
  window.__cam = state;
  function apply(ms) {
    const b = document.body;
    if (!b) return;
    b.style.transformOrigin = "0 0";
    b.style.transition = ms ? `transform ${ms}ms ${EASE}` : "none";
    b.style.transform = `translate(${state.tx}px, ${state.ty}px) scale(${state.s})`;
    const c = document.getElementById("__cursor");
    if (c) {
      c.style.transition = ms ? `scale ${ms}ms ${EASE}` : "none";
      c.style.scale = String(Math.min(1.6, 0.6 + 0.4 * state.s));
    }
  }
  // Centre a page point (unzoomed page coords) at scale s, kept inside the page.
  window.__camPoint = (fx, fy, s, ms) => {
    const W = innerWidth, H = innerHeight;
    let tx = W / 2 - fx * s, ty = H / 2 - fy * s;
    tx = Math.min(0, Math.max(W - W * s, tx));
    ty = Math.min(0, Math.max(H - H * s, ty));
    Object.assign(state, { tx, ty, s });
    apply(ms);
  };
  // Frame an element (rect as seen now, undone through the current camera).
  window.__camEl = (el, s, ms, dx = 0, dy = 0) => {
    const r = el.getBoundingClientRect();
    const cx = (r.x + r.width / 2 - state.tx) / state.s;
    const cy = (r.y + r.height / 2 - state.ty) / state.s;
    window.__camPoint(cx + dx, cy + dy, s, ms);
  };
  window.__camWide = (ms) => window.__camPoint(innerWidth / 2, innerHeight / 2, 1, ms);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28"><path d="M6 3.5v19.2l4.6-4.4 2.9 6.8 3.3-1.4-2.9-6.7h6.4L6 3.5z" fill="#000" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
  function mount() {
    if (document.getElementById("__cursor")) return;
    const c = document.createElement("div");
    c.id = "__cursor";
    c.innerHTML = svg;
    Object.assign(c.style, {
      position: "fixed", left: "0", top: "0", width: "28px", height: "28px", zIndex: "2147483647",
      pointerEvents: "none", transformOrigin: "6px 3.5px", translate: "-100px -100px",
      filter: "drop-shadow(0 1px 2px rgb(0 0 0 / 0.35))", willChange: "translate",
    });
    c.firstChild.style.transition = "transform 120ms ease";
    c.firstChild.style.transformOrigin = "6px 3.5px";
    document.documentElement.appendChild(c);
    addEventListener("mousemove", (e) => { c.style.translate = `${e.clientX - 6}px ${e.clientY - 3.5}px`; }, true);
    addEventListener("mousedown", () => { c.firstChild.style.transform = "scale(0.82)"; }, true);
    addEventListener("mouseup", () => { c.firstChild.style.transform = ""; }, true);
    const st = document.createElement("style");
    st.textContent = "*{cursor:none!important} html,body{overflow:hidden!important}";
    document.documentElement.appendChild(st);
  }
  if (document.readyState === "loading") addEventListener("DOMContentLoaded", mount); else mount();
})();
