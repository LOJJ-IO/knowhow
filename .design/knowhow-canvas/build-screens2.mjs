import { writeFileSync } from "fs";
import { T, FONT_UI, FONT_DISPLAY, icon, docChip, statusPill, avatar, btn, page, sidebar, topbar, searchField, DOC_TYPES } from "./lib.mjs";
import { shell, sec, cardBox, statTile, coverageBar, chip, dropChip, tabs, switchEl, checkbox, docRow, docHead, td, th, mono } from "./ui.mjs";

const SARAH = { name:"Sarah Chen", sub:"Marketing lead", initials:"SC" };

/* ---------------------------------------------------------- MEMBER HOME */
const createTile = (type, active = false) => {
  const d = DOC_TYPES[type];
  return `<div style="display:flex;flex-direction:column;align-items:center;gap:9px;flex-grow:1;flex-basis:0;padding:16px 12px;background:${T.card};border:1px solid ${active ? T.ring : T.border};border-radius:13px;${active ? `box-shadow:0 0 0 3px rgba(87,135,206,.2)` : ""}">
    ${docChip(type, 36)}<span style="font-size:12.8px;font-weight:600;color:${T.fg}">New ${d.label}</span></div>`;
};
const miniDoc = (t, title, who, when, st) => `<div style="display:flex;align-items:center;gap:10px;padding:9px 12px;border-top:1px solid ${T.border}">
  ${docChip(t, 24)}<span style="flex-grow:1;min-width:0"><span style="display:block;font-size:12.8px;font-weight:600;color:${T.fg};overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${title}</span>
  <span style="display:block;font-size:11px;color:${T.mfg}">${who} · ${when}</span></span>
  ${st ? `<span style="flex-shrink:0">${statusPill(st)}</span>` : ""}</div>`;

writeFileSync("MemberHome.dc.html", page({ title:"Member home", w:1440, h:1120, body: shell(
  sidebar({ active:"home", role:"MEMBER", user:SARAH }),
  `${topbar("Welcome back, Sarah", "Marketing lead · Google Workspace connected", searchField("Find apps or files", 340))}
  <div style="display:flex;flex-direction:column;gap:22px;padding:22px 28px 32px">

    <div>
      ${sec("Create new work", "Pick a type, choose who it reaches, and Knowhow files and shares it for you.")}
      <div style="display:flex;gap:12px;margin-bottom:12px">
        ${createTile("DOC")}${createTile("SHEET", true)}${createTile("SLIDE")}
        <div style="display:flex;flex-direction:column;align-items:center;gap:9px;flex-grow:1;flex-basis:0;padding:16px 12px;background:${T.card};border:1px solid ${T.border};border-radius:13px;opacity:.5">
          <span style="display:flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:6px;background:${T.mfg}">${icon("file",20,"#fff",1.9)}</span>
          <span style="font-size:12.8px;font-weight:600;color:${T.fg}">New Form / Other</span></div>
      </div>
      ${cardBox(`<div style="display:flex;align-items:flex-end;gap:14px;padding:15px 17px;flex-wrap:wrap">
        <div style="flex-grow:1;min-width:240px"><p style="margin:0 0 6px;font-size:12px;font-weight:600;color:${T.mfg}">Title</p>
          <div style="display:flex;align-items:center;height:34px;padding:0 12px;border-radius:9px;border:1px solid ${T.ring};box-shadow:0 0 0 3px rgba(87,135,206,.18);font-size:13.5px;color:${T.fg}">Q4 Budget Tracker<span style="width:1px;height:15px;margin-left:1px;background:${T.fg}"></span></div></div>
        <div style="width:280px"><p style="margin:0 0 6px;font-size:12px;font-weight:600;color:${T.mfg}">Share with</p>
          <div style="display:flex;align-items:center;justify-content:space-between;height:34px;padding:0 12px;border-radius:9px;border:1px solid ${T.border};font-size:13.5px;color:${T.fg}">Auto — follow team policy${icon("chevD",15,T.mfg,2)}</div></div>
        ${btn("Create","default",{size:"lg"})}
      </div>`)}
      <div style="display:flex;align-items:flex-start;gap:10px;margin-top:11px;padding:13px 16px;border-radius:12px;background:#e7f4ec;border:1px solid rgba(37,159,86,.28)">
        ${icon("check",16,"#166b3a",2.4)}
        <p style="margin:0;font-size:13px;line-height:1.5;color:#14512c"><span style="font-weight:700">“Q4 Budget Tracker”</span> filed in <span style="font-weight:700">Drive › Marketing</span> — auto-shared with Sarah Chen (team leader) and Jordan Blake (owner).</p>
      </div>
    </div>

    <div style="display:flex;gap:18px;align-items:flex-start">
      <div style="flex-grow:1;min-width:0">
        ${sec("My recent work", "Where each file landed, and who can see it.")}
        ${cardBox(`<div style="border-top:none">
          ${[["SHEET","Q4 Budget Tracker","Drive › Marketing","2 Sep","visible"],
             ["DOC","Q3 Marketing Plan","Drive › Marketing","31 Aug","visible"],
             ["SLIDE","Board Update — August","Drive › Marketing","31 Aug","visible"],
             ["SHEET","Content Calendar","Drive › Marketing","30 Aug","private"]]
            .map(([t,ti,fo,d,st],i) => `<div style="display:flex;align-items:center;gap:12px;padding:11px 16px;${i ? `border-top:1px solid ${T.border}` : ""}">
              ${docChip(t)}<span style="flex-grow:1;min-width:0"><span style="display:block;font-size:13.5px;font-weight:600;color:${T.fg}">${ti}</span>
              <span style="display:block;font-size:11.5px;color:${T.mfg}">${fo} · ${d}</span></span>${statusPill(st)}</div>`).join("")}
        </div>`, "overflow:hidden")}
      </div>
      <div style="width:250px;flex-shrink:0">
        ${sec("All apps")}
        ${cardBox(`<div style="display:flex;flex-wrap:wrap;gap:14px;padding:16px">
          ${[["Drive",T.gyellow],["Gmail",T.danger],["Meet",T.ggreen],["Chat",T.gblue],["Calendar",T.gblue],["Forms",T.ggreen]]
            .map(([n,c]) => `<div style="display:flex;flex-direction:column;align-items:center;gap:6px;width:56px">
              <span style="display:flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:10px;border:1px solid ${T.border};background:${T.card}">${icon("folder",17,c,1.9)}</span>
              <span style="font-size:11px;color:${T.mfg}">${n}</span></div>`).join("")}
        </div>`)}
      </div>
    </div>

    <div>
      ${sec("Shared with you", "Everything your team and your owner have surfaced to you.")}
      <div style="display:flex;gap:12px">
        ${["DOC","SHEET","SLIDE"].map((ty) => cardBox(`
          <div style="display:flex;align-items:center;justify-content:space-between;padding:11px 14px">
            <span style="display:flex;align-items:center;gap:8px;font-size:13px;font-weight:700;color:${T.fg}">${docChip(ty, 20)}Recent ${DOC_TYPES[ty].label}s</span>
            <span style="font-size:11.5px;color:${T.mfg}">${DOC_TYPES[ty].product}</span></div>
          ${{DOC:[["Company Handbook","Jordan Blake","2 Sep","everyone"],["Onboarding Checklist","Mike Ross","31 Aug","visible"],["Brand Guidelines Draft","David Kim","31 Aug","visible"]],
             SHEET:[["Vendor Contacts","David Kim","31 Aug","visible"],["Campaign Budget","Mike Ross","31 Aug","visible"],["Content Calendar","Jordan Blake","30 Aug","everyone"]],
             SLIDE:[["Product Launch Deck v2.1","Tom Alvarez","31 Aug","visible"],["All-Hands Agenda","Jordan Blake","2 Sep","everyone"],["Client Pitch Template","Priya Anand","30 Aug","visible"]]}[ty]
            .map(([ti,wh,wn,st]) => miniDoc(ty, ti, wh, wn, st)).join("")}
        `, "flex-grow:1;flex-basis:0;min-width:0;overflow:hidden")).join("")}
      </div>
    </div>
  </div>`
)}));

/* ------------------------------------------------------------ DOCUMENTS */
const ALLDOCS = [
  { t:"DOC", title:"Company Handbook", owner:"Jordan Blake", folder:"Company", date:"2 Sep", st:"everyone" },
  { t:"SHEET", title:"Q4 Budget Tracker", owner:"Mike Ross", folder:"Marketing", date:"2 Sep", st:"visible" },
  { t:"DOC", title:"All-Hands Agenda", owner:"Jordan Blake", folder:"Company", date:"2 Sep", st:"everyone" },
  { t:"SHEET", title:"Campaign Budget", owner:"Mike Ross", folder:"Marketing", date:"31 Aug", st:"hidden" },
  { t:"DOC", title:"Q3 Marketing Plan", owner:"Sarah Chen", folder:"Marketing", date:"31 Aug", st:"visible" },
  { t:"SLIDE", title:"Product Launch Deck v2.1", owner:"Tom Alvarez", folder:"Product", date:"31 Aug", st:"hidden" },
  { t:"DOC", title:"Brand Guidelines Draft", owner:"David Kim", folder:"Marketing", date:"31 Aug", st:"hidden" },
  { t:"SHEET", title:"Vendor Contacts", owner:"David Kim", folder:"Marketing", date:"31 Aug", st:"visible" },
  { t:"SLIDE", title:"Client Pitch Template", owner:"Priya Anand", folder:"Sales", date:"30 Aug", st:"hidden" },
  { t:"SHEET", title:"Content Calendar", owner:"Sarah Chen", folder:"Marketing", date:"30 Aug", st:"visible" },
];
writeFileSync("Documents.dc.html", page({ title:"Documents", w:1440, h:1010, body: shell(
  sidebar({ active:"docs", openGroup:"docs", activeChild:"All documents" }),
  `${topbar("Documents", "Every file Knowhow can see across your Google Workspace.", btn("New document","default",{icon:"plus",size:"lg"}))}
  <div style="padding:20px 28px 32px">
    ${tabs(["All documents","Shared with me","My documents","Drive folders"], "All documents")}
    <div style="display:flex;align-items:center;gap:9px;margin:16px 0 14px;flex-wrap:wrap">
      <div style="display:flex;align-items:center;gap:9px;width:330px;height:34px;padding:0 13px;border-radius:999px;background:${T.card};border:1px solid ${T.border}">
        ${icon("search",16,T.mfg,1.8)}<span style="font-size:13.5px;color:${T.fg}">budget</span><span style="width:1px;height:15px;background:${T.fg}"></span></div>
      ${dropChip("Any type")}${dropChip("All teams")}${dropChip("Anyone")}
      ${chip("Not shared with me", true, "alert")}
      <span style="margin-left:auto;font-size:12.5px;color:${T.mfg}">29 documents · 15 invisible to you</span>
    </div>
    ${cardBox(`${docHead()}${ALLDOCS.map((d) => docRow(d)).join("")}`, "overflow:hidden")}
    <div style="display:flex;align-items:center;justify-content:space-between;margin-top:13px">
      <span style="font-size:12.5px;color:${T.mfg}">Showing 10 of 29</span>
      <div style="display:flex;gap:7px">${btn("Previous","outline",{size:"sm"})}${btn("Next","outline",{size:"sm"})}</div>
    </div>
  </div>`
)}));

/* ----------------------------------------------------------- VISIBILITY */
const reasonCard = (n, count, desc, fix) => `<div style="flex-grow:1;flex-basis:0;min-width:0;padding:15px 16px;background:${T.card};border:1px solid ${T.border};border-radius:13px">
  <div style="display:flex;align-items:baseline;gap:9px">
    <span style="font-family:${FONT_DISPLAY};font-size:22px;font-weight:800;color:${T.fg};font-variant-numeric:tabular-nums">${count}</span>
    <span style="font-size:12.8px;font-weight:700;color:${T.fg}">${n}</span></div>
  <p style="margin:6px 0 9px;font-size:12px;line-height:1.5;color:${T.mfg}">${desc}</p>
  <span style="font-size:12px;font-weight:600;color:${T.primary}">${fix} →</span></div>`;

writeFileSync("Visibility.dc.html", page({ title:"Visibility", w:1440, h:1060, body: shell(
  sidebar({ active:"vis" }),
  `${topbar("Visibility", "15 documents in your organization were never shared up to you.", btn("Apply policy to all","default",{size:"lg"}))}
  <div style="display:flex;flex-direction:column;gap:22px;padding:22px 28px 32px">

    <div style="display:flex;gap:18px;align-items:stretch">
      ${cardBox(`<div style="padding:20px 22px;display:flex;align-items:center;gap:26px">
        <div>
          <p style="margin:0;font-family:${FONT_DISPLAY};font-size:46px;font-weight:800;color:${T.fg};letter-spacing:-0.035em;line-height:1;font-variant-numeric:tabular-nums">48%</p>
          <p style="margin:7px 0 0;font-size:13px;font-weight:600;color:${T.fg}">of documents are visible to you</p>
          <p style="margin:2px 0 0;font-size:12.5px;color:${T.mfg}">14 of 29 · up from 31% last week</p>
        </div>
        <div style="flex-grow:1;display:flex;flex-direction:column;gap:12px;padding-left:26px;border-left:1px solid ${T.border}">
          ${[["Marketing",60,"6 of 10"],["Sales",44,"4 of 9"],["Product",33,"3 of 9"],["Company",100,"1 of 1"]].map(([n,p,c]) => `
            <div style="display:flex;align-items:center;gap:14px">
              <span style="width:82px;font-size:12.8px;font-weight:600;color:${T.fg}">${n}</span>
              ${coverageBar(p, 240)}
              <span style="font-size:11.5px;color:${T.mfg}">${c}</span></div>`).join("")}
        </div>
      </div>`, "flex-grow:1;min-width:0")}
    </div>

    <div>
      ${sec("Why they're invisible", "Each gap has a cause and a one-click fix.")}
      <div style="display:flex;gap:12px">
        ${reasonCard("Created before the policy", 8, "These predate the team's auto-share rule, so nothing ever surfaced them.", "Share all 8 with me")}
        ${reasonCard("Policy is off for the team", 4, "Product has auto-share to owner switched off in Settings.", "Review Product policy")}
        ${reasonCard("Marked private by the owner", 3, "Deliberately private. Request access and the creator decides.", "Request access")}
      </div>
    </div>

    <div>
      ${sec("Gaps queue", "", `<div style="display:flex;gap:8px">${btn("Select all","ghost",{size:"sm"})}${btn("Apply team policy","outline",{size:"sm"})}</div>`)}
      <div style="display:flex;align-items:center;gap:12px;padding:10px 16px;border-radius:12px 12px 0 0;background:${T.primary};color:#fff">
        ${checkbox(true)}<span style="font-size:12.8px;font-weight:600">3 selected</span>
        <span style="margin-left:auto;display:flex;gap:8px">
          <span style="display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 11px;border-radius:999px;background:rgba(255,255,255,.14);font-size:12.5px;font-weight:600">${icon("share",13,"#fff",2)}Share with me</span>
          <span style="display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 11px;border-radius:999px;background:rgba(255,255,255,.14);font-size:12.5px;font-weight:600">${icon("settings",13,"#fff",2)}Apply team policy</span>
        </span></div>
      ${cardBox(`
        ${docRow({ t:"SHEET", title:"Campaign Budget", owner:"Mike Ross", folder:"Marketing", date:"31 Aug", st:"hidden" }, { check:true, reason:"Created before the Marketing auto-share policy", action:btn("Share","secondary",{size:"sm"}) })}
        ${docRow({ t:"DOC", title:"Brand Guidelines Draft", owner:"David Kim", folder:"Marketing", date:"31 Aug", st:"hidden" }, { check:true, reason:"Created before the Marketing auto-share policy", action:btn("Share","secondary",{size:"sm"}) })}
        ${docRow({ t:"SLIDE", title:"Client Pitch Template", owner:"Priya Anand", folder:"Sales", date:"30 Aug", st:"hidden" }, { check:true, reason:"Created before the Sales auto-share policy", action:btn("Share","secondary",{size:"sm"}) })}
        ${docRow({ t:"SLIDE", title:"Product Launch Deck v2.1", owner:"Tom Alvarez", folder:"Product", date:"31 Aug", st:"hidden" }, { check:false, reason:"Product has auto-share to owner switched off", action:btn("Review","outline",{size:"sm"}) })}
        ${docRow({ t:"DOC", title:"Interview Notes — Q3", owner:"Nina Patel", folder:"Product", date:"29 Aug", st:"private" }, { check:false, reason:"Marked private by Nina Patel", action:btn("Request","outline",{size:"sm"}) })}
      `, "border-radius:0 0 14px 14px;overflow:hidden;border-top:none")}
    </div>
  </div>`
)}));
console.log("wrote MemberHome, Documents, Visibility");
