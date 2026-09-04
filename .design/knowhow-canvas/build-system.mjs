import { writeFileSync } from "fs";
import { T, FONT_UI, FONT_DISPLAY, icon, docChip, statusPill, avatar, btn, logo, page } from "./lib.mjs";

const label = (t) => `<p style="margin:0 0 10px;font-size:11px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:${T.mfg}">${t}</p>`;
const sectionTitle = (t, s) => `<div style="margin:0 0 16px">
  <h2 style="margin:0;font-family:${FONT_DISPLAY};font-size:17px;font-weight:800;color:${T.fg};letter-spacing:-0.02em">${t}</h2>
  ${s ? `<p style="margin:4px 0 0;font-size:13px;color:${T.mfg};max-width:640px">${s}</p>` : ""}</div>`;
const panel = (inner) => `<div style="background:${T.card};border:1px solid ${T.border};border-radius:16px;padding:22px">${inner}</div>`;

function swatch(name, hex, oklch, w = 148) {
  return `<div style="display:flex;flex-direction:column;gap:7px;width:${w}px">
    <div style="height:52px;border-radius:9px;background:${hex};border:1px solid rgba(21,32,48,.10)"></div>
    <div style="display:flex;flex-direction:column;gap:1px">
      <span style="font-size:12.5px;font-weight:600;color:${T.fg}">${name}</span>
      <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10.5px;color:${T.mfg}">${hex}</span>
      <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10px;color:#98a0ab">${oklch}</span>
    </div></div>`;
}
const row = (kids, gap = 14) => `<div style="display:flex;flex-wrap:wrap;gap:${gap}px">${kids.join("")}</div>`;

function typeRow(name, px, weight, lh, font, sample) {
  return `<div style="display:flex;align-items:baseline;gap:24px;padding:11px 0;border-bottom:1px solid ${T.border}">
    <div style="width:150px;flex-shrink:0">
      <p style="margin:0;font-size:12.5px;font-weight:600;color:${T.fg}">${name}</p>
      <p style="margin:1px 0 0;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10.5px;color:${T.mfg}">${px}/${lh} · ${weight}</p>
    </div>
    <div style="font-family:${font};font-size:${px}px;line-height:${lh}px;font-weight:${weight};color:${T.fg};letter-spacing:${px >= 20 ? "-0.02em" : "0"}">${sample}</div>
  </div>`;
}

function coverageBar(pct, w = 210, tone = T.success) {
  return `<div style="display:flex;align-items:center;gap:10px">
    <div style="position:relative;width:${w}px;height:8px;border-radius:999px;background:${T.muted};overflow:hidden">
      <div style="position:absolute;inset:0 auto 0 0;width:${pct}%;background:${tone};border-radius:999px"></div>
    </div>
    <span style="font-size:12.5px;font-weight:700;color:${T.fg};font-variant-numeric:tabular-nums">${pct}%</span>
  </div>`;
}

function statTile(value, lbl, note, tone = T.fg) {
  return `<div style="flex-grow:1;min-width:0;padding:15px 17px;background:${T.card};border:1px solid ${T.border};border-radius:14px">
    <p style="margin:0;font-family:${FONT_DISPLAY};font-size:27px;font-weight:800;color:${tone};letter-spacing:-0.03em;font-variant-numeric:tabular-nums">${value}</p>
    <p style="margin:3px 0 0;font-size:12.5px;font-weight:600;color:${T.fg}">${lbl}</p>
    ${note ? `<p style="margin:2px 0 0;font-size:11.5px;color:${T.mfg}">${note}</p>` : ""}
  </div>`;
}

function navItemSpec(state) {
  const map = {
    rest:   { bg:"transparent",    fg:"rgba(243,245,248,.72)", w:500, t:"Rest" },
    hover:  { bg:"rgba(255,255,255,.06)", fg:"rgba(243,245,248,.92)", w:500, t:"Hover" },
    active: { bg:T.sidebarAcc,     fg:"#ffffff",               w:600, t:"Active" },
  }[state];
  return `<div style="display:flex;flex-direction:column;gap:6px">
    <div style="display:flex;align-items:center;gap:10px;width:196px;height:34px;padding:0 10px;border-radius:8px;background:${map.bg};color:${map.fg};font-size:13.5px;font-weight:${map.w}">${icon("file", 17, "currentColor")}<span>Documents</span></div>
    <span style="font-size:11px;color:rgba(243,245,248,.5);padding-left:2px">${map.t}</span>
  </div>`;
}

const body = `
<div style="padding:34px 38px 44px;display:flex;flex-direction:column;gap:26px">

  <div style="display:flex;align-items:flex-end;justify-content:space-between;gap:24px">
    <div>
      ${logo(26)}
      <h1 style="margin:14px 0 0;font-family:${FONT_DISPLAY};font-size:30px;font-weight:800;letter-spacing:-0.03em;color:${T.fg}">Design system</h1>
      <p style="margin:6px 0 0;font-size:14px;color:${T.mfg};max-width:620px">One vocabulary for the whole product. Colour tokens are the exact oklch values in <span style="font-family:ui-monospace,Menlo,monospace;font-size:12.5px">src/app/globals.css</span>; hex is shown for reference only.</p>
    </div>
    <div style="display:flex;gap:8px">${btn("Deck-derived palette","secondary",{size:"sm"})}${btn("Google Workspace accents","secondary",{size:"sm"})}</div>
  </div>

  ${panel(`${sectionTitle("Colour — surfaces & ink", "A cool navy-tinted neutral ramp. Nothing in the product is pure grey; every neutral carries a trace of the brand hue (250–258°).")}
    ${label("Surfaces")}
    ${row([
      swatch("background", "#f4f6f8", "0.972 0.004 250"),
      swatch("card", "#ffffff", "1 0 0"),
      swatch("muted / secondary", "#ecf1f5", "0.955 0.008 250"),
      swatch("border / input", "#dfe3e8", "0.915 0.008 250"),
    ])}
    <div style="height:22px"></div>
    ${label("Ink & brand")}
    ${row([
      swatch("foreground", "#152030", "0.24 0.035 258"),
      swatch("muted-foreground", "#5b6472", "0.5 0.025 258"),
      swatch("primary", "#193358", "0.32 0.075 258"),
      swatch("ring (focus)", "#5787ce", "0.62 0.12 258"),
      swatch("sidebar", "#132643", "0.27 0.06 258"),
      swatch("sidebar-accent", "#1f3656", "0.33 0.065 258"),
    ])}`)}

  ${panel(`${sectionTitle("Colour — Workspace accents & status", "The four Google product colours carry document identity. They are never the only cue: a chip always sits beside the document's name, and status always carries an icon and a word.")}
    <div style="display:flex;gap:34px;flex-wrap:wrap">
      <div>
        ${label("Document identity")}
        ${row([
          swatch("gblue — Docs", "#4183ea", "0.62 0.17 259", 132),
          swatch("ggreen — Sheets", "#23aa5b", "0.65 0.16 152", 132),
          swatch("gyellow — Slides", "#f3ba25", "0.82 0.16 85", 132),
          swatch("gred — alert", "#e23532", "0.6 0.21 27", 132),
        ])}
        <div style="display:flex;align-items:center;gap:14px;margin-top:16px">
          ${Object.keys({DOC:1,SHEET:1,SLIDE:1}).map((t) => `<div style="display:flex;align-items:center;gap:8px">${docChip(t)}<span style="font-size:12.5px;color:${T.fg}">${t === "DOC" ? "Q3 Marketing Plan" : t === "SHEET" ? "Campaign Budget" : "Launch Deck v2.1"}</span></div>`).join("")}
        </div>
        <p style="margin:12px 0 0;font-size:12px;color:${T.mfg};max-width:420px">Glyph colour is whichever of white / navy clears 3:1 on the chip fill — blue and green take white, brand yellow takes navy (white on it is only 1.76:1).</p>
      </div>
      <div style="flex-grow:1;min-width:300px">
        ${label("Status")}
        <div style="display:flex;flex-direction:column;gap:10px;align-items:flex-start">
          ${statusPill("visible")}${statusPill("hidden")}${statusPill("everyone")}${statusPill("private")}
        </div>
        <div style="margin-top:14px;padding:12px 14px;border-radius:11px;background:#fdf6ec;border:1px solid #f0e0c4">
          <p style="margin:0;font-size:12.5px;font-weight:700;color:#7a5510">Why pills, not dots</p>
          <p style="margin:4px 0 0;font-size:12px;line-height:1.5;color:#7a5510">Shared-green and not-shared-red sit at ΔE 4.9 under deuteranopia — indistinguishable for roughly 1 in 12 men. The state is therefore never carried by colour alone.</p>
        </div>
      </div>
    </div>`)}

  ${panel(`${sectionTitle("Typography", "Plus Jakarta Sans carries headings and numerals; Public Sans carries UI and body. Both fall back to Helvetica/Arial, which is what the app renders today — so exports and no-webfont environments degrade gracefully.")}
    ${typeRow("Display", 30, 800, 36, FONT_DISPLAY, "Every document, visible")}
    ${typeRow("Page title", 22, 800, 28, FONT_DISPLAY, "Overall Dashboard")}
    ${typeRow("Section", 15, 700, 20, FONT_DISPLAY, "Drive auto-filing")}
    ${typeRow("Stat numeral", 27, 800, 32, FONT_DISPLAY, "48%")}
    ${typeRow("Body", 14, 400, 21, FONT_UI, "Documents created by your teams, and whether you can see them yet.")}
    ${typeRow("UI default", 13.5, 500, 20, FONT_UI, "Share with team leader and owner")}
    ${typeRow("Caption", 12, 400, 17, FONT_UI, "Mike Ross · Drive › Marketing · 2 Sep 2026")}
    <div style="padding:11px 0 0"><span style="font-size:11px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:${T.mfg}">Overline · 11/700/.09em</span></div>`)}

  ${panel(`${sectionTitle("Space, radius & control height", "A 4px base step. Radii come from the --radius scale already in the stylesheet (0.625rem base); controls are pill-shaped, containers are soft rectangles.")}
    <div style="display:flex;gap:44px;flex-wrap:wrap">
      <div>${label("Space")}<div style="display:flex;align-items:flex-end;gap:10px">
        ${[4,6,8,12,16,20,24,32].map((s) => `<div style="display:flex;flex-direction:column;align-items:center;gap:6px"><div style="width:${s}px;height:${s}px;background:${T.ring};border-radius:2px"></div><span style="font-size:10.5px;color:${T.mfg};font-family:ui-monospace,Menlo,monospace">${s}</span></div>`).join("")}
      </div></div>
      <div>${label("Radius")}<div style="display:flex;align-items:flex-end;gap:10px">
        ${[["sm",6],["md",8],["lg",10],["xl",14],["2xl",18],["full",999]].map(([n,r]) => `<div style="display:flex;flex-direction:column;align-items:center;gap:6px"><div style="width:44px;height:34px;background:${T.muted};border:1px solid ${T.border};border-radius:${r}px"></div><span style="font-size:10.5px;color:${T.mfg};font-family:ui-monospace,Menlo,monospace">${n}</span></div>`).join("")}
      </div></div>
      <div>${label("Control height")}<div style="display:flex;align-items:flex-end;gap:10px">
        ${[["sm",28],["md",32],["lg",36]].map(([n,hh]) => `<div style="display:flex;flex-direction:column;align-items:center;gap:6px"><div style="display:flex;align-items:center;padding:0 12px;height:${hh}px;background:${T.muted};border:1px solid ${T.border};border-radius:999px;font-size:12px;color:${T.mfg}">${hh}px</div><span style="font-size:10.5px;color:${T.mfg};font-family:ui-monospace,Menlo,monospace">${n}</span></div>`).join("")}
      </div></div>
    </div>`)}

  ${panel(`${sectionTitle("Components")}
    <div style="display:flex;flex-direction:column;gap:24px">
      <div>${label("Buttons")}
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          ${btn("Create document","default",{icon:"plus"})}${btn("Apply policy","outline")}${btn("Filter","secondary",{icon:"filter"})}${btn("View","ghost")}${btn("Offboard","danger")}
          <span style="width:16px"></span>${btn("Small","default",{size:"sm"})}${btn("Large","default",{size:"lg"})}
        </div></div>

      <div>${label("Fields")}
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
          <div style="display:flex;align-items:center;gap:9px;width:280px;height:32px;padding:0 12px;border-radius:8px;background:${T.card};border:1px solid ${T.border};font-size:13.5px;color:#8d95a1">${icon("search",15,T.mfg,1.8)}Search documents</div>
          <div style="display:flex;align-items:center;justify-content:space-between;width:200px;height:32px;padding:0 12px;border-radius:8px;background:${T.card};border:1px solid ${T.border};font-size:13.5px;color:${T.fg}">Auto — team policy${icon("chevD",15,T.mfg,2)}</div>
          <div style="display:flex;align-items:center;gap:9px;width:250px;height:32px;padding:0 12px;border-radius:8px;background:${T.card};border:1px solid ${T.ring};box-shadow:0 0 0 3px rgba(87,135,206,.22);font-size:13.5px;color:${T.fg}">Q4 Campaign Brief<span style="width:1px;height:15px;background:${T.fg}"></span></div>
          <div style="display:flex;align-items:center;gap:8px"><span style="position:relative;width:34px;height:20px;border-radius:999px;background:${T.success}"><span style="position:absolute;top:2px;left:16px;width:16px;height:16px;border-radius:999px;background:#fff"></span></span><span style="font-size:13px;color:${T.fg}">Auto-share on</span></div>
        </div></div>

      <div>${label("Sidebar nav states")}
        <div style="display:flex;gap:16px;padding:16px;border-radius:12px;background:${T.sidebar}">
          ${navItemSpec("rest")}${navItemSpec("hover")}${navItemSpec("active")}
        </div></div>

      <div>${label("Stat tiles & coverage meter")}
        <div style="display:flex;gap:12px;margin-bottom:14px">
          ${statTile("48%","Visible to you","14 of 29 documents")}
          ${statTile("15","Invisible to you","across 3 teams", T.danger)}
          ${statTile("29","Documents","in Google Workspace")}
          ${statTile("9","People","3 teams")}
        </div>
        <div style="display:flex;flex-direction:column;gap:9px;max-width:420px">
          ${[["Marketing",60],["Sales",44],["Product",33]].map(([n,p]) => `<div style="display:flex;align-items:center;gap:14px"><span style="width:76px;font-size:12.5px;color:${T.fg}">${n}</span>${coverageBar(p)}</div>`).join("")}
        </div>
        <p style="margin:11px 0 0;font-size:12px;color:${T.mfg};max-width:520px">Coverage is one measure across teams, so every bar is one colour — the fill reads as “shared”, the track as the gap. Never a per-team hue.</p>
      </div>

      <div>${label("Document row")}
        <div style="border:1px solid ${T.border};border-radius:12px;overflow:hidden;max-width:720px">
          ${[["DOC","Q3 Marketing Plan","Sarah Chen","Marketing","visible"],["SHEET","Campaign Budget","Mike Ross","Marketing","hidden"],["SLIDE","Board Update — August","Jordan Blake","Company","everyone"]].map(([ty,ti,ow,fo,st],i) => `
            <div style="display:flex;align-items:center;gap:12px;padding:10px 14px;background:${T.card};${i < 2 ? `border-bottom:1px solid ${T.border}` : ""}">
              ${docChip(ty)}
              <div style="flex-grow:1;min-width:0">
                <p style="margin:0;font-size:13.5px;font-weight:600;color:${T.fg}">${ti}</p>
                <p style="margin:1px 0 0;font-size:11.5px;color:${T.mfg}">${ow} · Drive › ${fo}</p>
              </div>
              ${statusPill(st)}
            </div>`).join("")}
        </div></div>

      <div>${label("Tabs & empty state")}
        <div style="display:flex;gap:26px;flex-wrap:wrap;align-items:flex-start">
          <div style="display:flex;gap:2px;border-bottom:1px solid ${T.border};padding-bottom:0">
            ${["Documents","People","Policy"].map((t,i) => `<span style="padding:8px 14px 9px;font-size:13.5px;font-weight:${i === 0 ? 700 : 500};color:${i === 0 ? T.fg : T.mfg};border-bottom:2px solid ${i === 0 ? T.primary : "transparent"}">${t}</span>`).join("")}
          </div>
          <div style="display:flex;flex-direction:column;align-items:center;gap:9px;padding:22px 30px;border:1px dashed ${T.border};border-radius:12px;background:${T.card}">
            <span style="display:flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:999px;background:${T.muted}">${icon("file",19,T.mfg,1.7)}</span>
            <p style="margin:0;font-size:13px;font-weight:600;color:${T.fg}">No documents yet</p>
            <p style="margin:0;font-size:12px;color:${T.mfg}">Create one and it files itself.</p>
          </div>
        </div></div>
    </div>`)}

</div>`;

writeFileSync("Main.dc.html", page({ title:"Design system", w:1400, body }));
console.log("wrote Main.dc.html");
