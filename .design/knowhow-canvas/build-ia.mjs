import { writeFileSync } from "fs";
import { T, FONT_UI, FONT_DISPLAY, icon, page } from "./lib.mjs";

const mono = "ui-monospace,SFMono-Regular,Menlo,monospace";
const roleChip = (r) => {
  const m = { O:["#e8effb","#1e4b96","Owner"], L:["#e7f4ec","#166b3a","Leader"], M:["#f2eefb","#553a96","Member"] }[r];
  return `<span title="${m[2]}" style="display:inline-flex;align-items:center;justify-content:center;width:19px;height:19px;border-radius:5px;background:${m[0]};color:${m[1]};font-size:10.5px;font-weight:800">${r}</span>`;
};
const roles = (rs) => `<span style="display:inline-flex;gap:3px">${rs.map(roleChip).join("")}</span>`;

function oldRow(route, what, problem) {
  return `<div style="display:flex;flex-direction:column;gap:5px;padding:13px 15px;border:1px solid ${T.border};border-radius:11px;background:${T.card}">
    <div style="display:flex;align-items:baseline;gap:9px">
      <span style="font-family:${mono};font-size:12px;font-weight:600;color:${T.primary}">${route}</span>
      <span style="font-size:12px;color:${T.mfg}">${what}</span>
    </div>
    ${problem ? `<div style="display:flex;align-items:flex-start;gap:7px;padding-top:2px">
      ${icon("alert", 13, T.danger, 2)}
      <span style="font-size:11.8px;line-height:1.45;color:#a52320">${problem}</span>
    </div>` : ""}
  </div>`;
}

function node({ label:lb, ic, rs, note, kids = [], depth = 0, badge }) {
  const pad = depth * 22;
  return `<div style="display:flex;flex-direction:column;gap:6px">
    <div style="display:flex;align-items:center;gap:10px;margin-left:${pad}px;padding:9px 13px;border-radius:10px;background:${depth === 0 ? T.primary : T.card};border:1px solid ${depth === 0 ? T.primary : T.border}">
      ${ic ? icon(ic, 16, depth === 0 ? "#fff" : T.primary, 1.8) : ""}
      <span style="flex-grow:1;font-size:13.5px;font-weight:${depth === 0 ? 700 : 600};color:${depth === 0 ? "#fff" : T.fg}">${lb}</span>
      ${badge ? `<span style="display:flex;align-items:center;justify-content:center;height:18px;padding:0 7px;border-radius:999px;background:${T.danger};color:#fff;font-size:10.5px;font-weight:700">${badge}</span>` : ""}
      ${rs ? roles(rs) : ""}
    </div>
    ${note ? `<p style="margin:-2px 0 2px ${pad + 13}px;font-size:11.8px;color:${T.mfg};max-width:430px;line-height:1.45">${note}</p>` : ""}
    ${kids.map((k) => node({ ...k, depth: depth + 1 })).join("")}
  </div>`;
}

const TREE = [
  { label:"Home", ic:"grid", rs:["O","L","M"], note:"One route, two compositions: the owner gets an org pulse, everyone else gets their workspace. Today these are the same URL rendering two different products." },
  { label:"Documents", ic:"file", rs:["O","L","M"], note:"Documents finally get a home of their own, with a real results page behind the search field.", kids:[
    { label:"All documents", rs:["O","L"] },
    { label:"Shared with me", rs:["O","L","M"] },
    { label:"My documents", rs:["O","L","M"] },
    { label:"Drive folders", rs:["O","L"], note:"The auto-filing map — already computed by getFolderRouting()." },
  ]},
  { label:"Visibility", ic:"eye", rs:["O","L"], badge:"15", note:"Promoted to top level: the gap the product exists to close becomes a queue you can act on, not a red dot you can only look at." },
  { label:"Organization", ic:"org", rs:["O"], kids:[
    { label:"Org chart", rs:["O"] },
    { label:"Team hub — Documents · People · Policy", rs:["O","L"], note:"Three disconnected screens today; one hub with tabs here." },
  ]},
  { label:"Activity", ic:"activity", rs:["O","L","M"], note:"Audit trail, filterable by event type." },
  { label:"Settings", ic:"settings", rs:["O"], note:"Org profile, Workspace connection, and the per-team sharing policies." },
];

const body = `
<div style="padding:34px 38px 40px;display:flex;flex-direction:column;gap:24px">
  <div>
    <h1 style="margin:0;font-family:${FONT_DISPLAY};font-size:30px;font-weight:800;letter-spacing:-0.03em;color:${T.fg}">Information architecture</h1>
    <p style="margin:7px 0 0;font-size:14px;color:${T.mfg};max-width:760px">The current routes grew one feature at a time. This is the structure the same data layer supports without a single query changing — <span style="font-family:${mono};font-size:12.5px">src/lib/queries.ts</span> already returns everything below.</p>
  </div>

  <div style="display:flex;gap:26px;align-items:flex-start">

    <div style="width:392px;flex-shrink:0">
      <div style="display:flex;align-items:center;gap:9px;margin-bottom:13px">
        <h2 style="margin:0;font-family:${FONT_DISPLAY};font-size:15px;font-weight:800;color:${T.fg}">Today</h2>
        <span style="font-size:12px;color:${T.mfg}">6 flat routes</span>
      </div>
      <div style="display:flex;flex-direction:column;gap:9px">
        ${oldRow("/dashboard", "role-branched", "Renders two different products at one URL. The owner has no personal workspace; members have no org view.")}
        ${oldRow("/org-chart", "owner + teams", "A two-step form, not a chart — no hierarchy is ever drawn.")}
        ${oldRow("/team/[id]/people", "roster", "Clicking a team in the sidebar lands on staffing, not that team's documents — the opposite of what the dashboard implies.")}
        ${oldRow("/activity", "audit trail", "")}
        ${oldRow("/settings", "sharing policies", "")}
        ${oldRow("—", "documents", "No home. Documents exist only as boards embedded in dashboards, and search is a dropdown with nowhere to land.")}
        ${oldRow("—", "visibility", "No surface. Coverage is computable but never shown, so the red dots stay decorative.")}
      </div>
    </div>

    <div style="display:flex;align-items:center;justify-content:center;width:40px;flex-shrink:0;padding-top:180px">
      ${icon("chevR", 26, T.mfg, 1.6)}
    </div>

    <div style="flex-grow:1;min-width:0">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:13px">
        <h2 style="margin:0;font-family:${FONT_DISPLAY};font-size:15px;font-weight:800;color:${T.fg}">Proposed</h2>
        <span style="font-size:12px;color:${T.mfg}">6 sections, role-aware</span>
        <span style="display:inline-flex;gap:5px;align-items:center;margin-left:auto;font-size:11.5px;color:${T.mfg}">${roleChip("O")} Owner ${roleChip("L")} Leader ${roleChip("M")} Member</span>
      </div>
      <div style="display:flex;flex-direction:column;gap:9px">
        ${TREE.map((n) => node(n)).join("")}
      </div>
    </div>
  </div>

  <div style="display:flex;gap:14px;padding:17px 19px;border-radius:13px;background:${T.card};border:1px solid ${T.border}">
    <div style="flex-grow:1">
      <p style="margin:0;font-size:12.5px;font-weight:700;color:${T.fg}">What this costs</p>
      <p style="margin:4px 0 0;font-size:12.5px;line-height:1.55;color:${T.mfg}">Nothing in <span style="font-family:${mono};font-size:12px">src/lib</span>, <span style="font-family:${mono};font-size:12px">prisma/</span> or the server actions changes. Two new routes (<span style="font-family:${mono};font-size:12px">/documents</span>, <span style="font-family:${mono};font-size:12px">/visibility</span>), one route merged (<span style="font-family:${mono};font-size:12px">/team/[id]</span> gains tabs), and the sidebar becomes role-aware. The onboarding, offboarding and auto-share engines keep their verified behaviour.</p>
    </div>
  </div>
</div>`;

writeFileSync("IAMap.dc.html", page({ title:"IA", w:1320, body }));
console.log("wrote IAMap.dc.html");
