import { T, FONT_UI, FONT_DISPLAY, icon, docChip, statusPill, avatar, btn } from "./lib.mjs";

const mono = "ui-monospace,SFMono-Regular,Menlo,monospace";
const shell = (side, content) => `<div style="display:flex;min-height:100%;align-items:stretch">${side}<main style="flex-grow:1;min-width:0;display:flex;flex-direction:column">${content}</main></div>`;
const sec = (t, s, right = "") => `<div style="display:flex;align-items:flex-end;gap:16px;margin:0 0 12px">
  <div style="flex-grow:1"><h2 style="margin:0;font-family:${FONT_DISPLAY};font-size:15px;font-weight:800;color:${T.fg};letter-spacing:-0.01em">${t}</h2>
  ${s ? `<p style="margin:3px 0 0;font-size:12.5px;color:${T.mfg}">${s}</p>` : ""}</div>${right}</div>`;
const cardBox = (inner, extra = "") => `<div style="background:${T.card};border:1px solid ${T.border};border-radius:14px;${extra}">${inner}</div>`;

const statTile = (v, l, note, tone = T.fg) => `<div style="flex-grow:1;flex-basis:0;min-width:0;padding:15px 17px;background:${T.card};border:1px solid ${T.border};border-radius:14px">
  <p style="margin:0;font-family:${FONT_DISPLAY};font-size:27px;font-weight:800;color:${tone};letter-spacing:-0.03em;font-variant-numeric:tabular-nums">${v}</p>
  <p style="margin:3px 0 0;font-size:12.5px;font-weight:600;color:${T.fg}">${l}</p>
  ${note ? `<p style="margin:2px 0 0;font-size:11.5px;color:${T.mfg}">${note}</p>` : ""}</div>`;

const coverageBar = (pct, w = 200, tone = T.success) => `<div style="display:flex;align-items:center;gap:11px">
  <div style="position:relative;width:${w}px;height:8px;border-radius:999px;background:${T.muted};overflow:hidden">
    <div style="position:absolute;top:0;bottom:0;left:0;width:${pct}%;background:${tone};border-radius:999px"></div></div>
  <span style="font-size:12.5px;font-weight:700;color:${T.fg};font-variant-numeric:tabular-nums;width:32px">${pct}%</span></div>`;

const chip = (t, on = false, ic) => `<span style="display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 12px;border-radius:999px;font-size:12.8px;font-weight:${on ? 600 : 500};background:${on ? T.primary : T.card};color:${on ? "#fff" : T.mfg};border:1px solid ${on ? T.primary : T.border}">${ic ? icon(ic, 13, "currentColor", 2) : ""}${t}${ic === "chevD" ? "" : ""}</span>`;
const dropChip = (t) => `<span style="display:inline-flex;align-items:center;gap:7px;height:30px;padding:0 11px;border-radius:999px;font-size:12.8px;font-weight:500;background:${T.card};color:${T.mfg};border:1px solid ${T.border}">${t}${icon("chevD", 13, T.mfg, 2)}</span>`;
const tabs = (list, active) => `<div style="display:flex;gap:2px;border-bottom:1px solid ${T.border}">
  ${list.map((t) => `<span style="padding:9px 15px 10px;font-size:13.5px;font-weight:${t === active ? 700 : 500};color:${t === active ? T.fg : T.mfg};border-bottom:2px solid ${t === active ? T.primary : "transparent"}">${t}</span>`).join("")}</div>`;
const switchEl = (on) => `<span style="position:relative;display:inline-block;width:34px;height:20px;border-radius:999px;background:${on ? T.success : "#c8cfd8"};flex-shrink:0"><span style="position:absolute;top:2px;left:${on ? 16 : 2}px;width:16px;height:16px;border-radius:999px;background:#fff"></span></span>`;
const checkbox = (on) => `<span style="display:flex;align-items:center;justify-content:center;width:16px;height:16px;border-radius:4px;border:1.5px solid ${on ? T.primary : "#bcc4ce"};background:${on ? T.primary : T.card};flex-shrink:0">${on ? icon("check", 11, "#fff", 3) : ""}</span>`;

const th = (t, w) => `<span style="${w ? `width:${w}px;flex-shrink:0;` : "flex-grow:1;min-width:0;"}font-size:11px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:${T.mfg}">${t}</span>`;
const td = (t, w, style = "") => `<span style="${w ? `width:${w}px;flex-shrink:0;` : "flex-grow:1;min-width:0;"}font-size:12.8px;color:${T.mfg};${style}">${t}</span>`;

function docRow(d, opts = {}) {
  return `<div style="display:flex;align-items:center;gap:13px;padding:11px 16px;border-top:1px solid ${T.border}">
    ${opts.check !== undefined ? checkbox(opts.check) : ""}
    ${docChip(d.t)}
    <span style="flex-grow:1;min-width:0">
      <span style="display:block;font-size:13.5px;font-weight:600;color:${T.fg}">${d.title}</span>
      ${opts.reason ? `<span style="display:block;margin-top:1px;font-size:11.5px;color:#a52320">${opts.reason}</span>` : ""}
    </span>
    ${td(d.owner, 128)}
    ${td("Drive › " + d.folder, 150)}
    ${td(d.date, 92)}
    <span style="width:140px;flex-shrink:0;display:flex;justify-content:flex-end">${statusPill(d.st)}</span>
    ${opts.action ? `<span style="width:118px;flex-shrink:0;display:flex;justify-content:flex-end">${opts.action}</span>` : ""}
  </div>`;
}
const docHead = (opts = {}) => `<div style="display:flex;align-items:center;gap:13px;padding:10px 16px;background:${T.muted}">
  ${opts.check !== undefined ? checkbox(opts.check) : ""}${opts.check !== undefined ? "" : ""}
  <span style="width:28px;flex-shrink:0"></span>${th("Document")}${th("Owner",128)}${th("Drive folder",150)}${th("Created",92)}
  <span style="width:140px;flex-shrink:0;display:flex;justify-content:flex-end">${th("Visibility")}</span>
  ${opts.action ? `<span style="width:118px;flex-shrink:0"></span>` : ""}</div>`;


export { mono, shell, sec, cardBox, statTile, coverageBar, chip, dropChip, tabs, switchEl, checkbox, th, td, docRow, docHead };
