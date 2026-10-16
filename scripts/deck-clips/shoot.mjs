// Records the landing deck's demo clips (Ronald, 2026-10-15): each feature
// card's screen from the local /demo, with a keynote-style camera (push-ins,
// cuts, pans) and a drawn cursor. Needs `npm run dev` + the backend running.
//   cd scripts/deck-clips && npm i --no-save playwright && npx playwright install chromium
//   node shoot.mjs [unified,auto-own,...]          # all clips if no ids
//   python3 encode.py .out/raw/<id> ../../public/deck/clips/<id>
//   ffmpeg -i ../../public/deck/clips/<id>.mp4 -frames:v 1 -q:v 3 ../../public/deck/clips/<id>.jpg
// Ids match DECK_CARDS in src/components/deck/deck.tsx.
import { chromium } from "playwright";
import fs from "node:fs";
const BASE = "http://localhost:3000";
const only = process.argv[2];
const CAM = fs.readFileSync(new URL("./cam.js", import.meta.url), "utf8");
const b = await chromium.launch();
if (!fs.existsSync(".out/state.json")) {
  const ctx = await b.newContext(); const p = await ctx.newPage();
  await p.goto(`${BASE}/demo`); await p.waitForURL(/\/home/, { timeout: 60000 });
  await ctx.storageState({ path: ".out/state.json" }); await ctx.close();
}
const wait = (p, ms) => p.waitForTimeout(ms);
let mouse = { x: 800, y: 980 };
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
async function moveTo(p, x, y, ms = 750) {
  const from = { ...mouse }, n = Math.max(8, Math.round(ms / 16));
  // A slight arc, like a hand.
  const bend = Math.min(60, Math.hypot(x - from.x, y - from.y) * 0.12);
  for (let i = 1; i <= n; i++) {
    const t = ease(i / n);
    const arc = Math.sin(Math.PI * t) * bend;
    await p.mouse.move(from.x + (x - from.x) * t, from.y + (y - from.y) * t - arc);
    await wait(p, 16);
  }
  mouse = { x, y };
}
async function pt(loc) { const r = await loc.boundingBox(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }
async function hover(p, loc, ms) { const c = await pt(loc); await moveTo(p, c.x, c.y, ms); }
async function click(p, loc, ms) { await hover(p, loc, ms); await wait(p, 120); await p.mouse.down(); await wait(p, 90); await p.mouse.up(); }
// Camera: frame an element at scale s over ms (0 = a cut), then settle.
async function cam(p, loc, s, ms, dx = 0, dy = 0) {
  console.log("  cam", String(loc).slice(0, 90));
  await loc.evaluate((el, a) => window.__camEl(el, a.s, a.ms, a.dx, a.dy), { s, ms, dx, dy }, { timeout: 8000 });
  await wait(p, ms + 60);
}
async function camAt(p, x, y, s, ms) { await p.evaluate((a) => window.__camPoint(a.x, a.y, a.s, a.ms), { x, y, s, ms }); await wait(p, ms + 60); }
async function wide(p, ms) { await p.evaluate((ms) => window.__camWide(ms), ms); await wait(p, ms + 60); }
async function dismissPills(p) {
  await wait(p, 1800);
  const x = p.getByRole("button", { name: /^close$/i }).first();
  if (await x.isVisible().catch(() => false)) await x.click().catch(() => {});
  await wait(p, 700);
}
const SLOW = 1400, MED = 1000;

const clips = {
  async unified(p) {
    await p.goto(`${BASE}/workspace`); await dismissPills(p);
    return async () => {
      const f = (n) => p.getByRole("button", { name: n, exact: true });
      await wait(p, 700);
      await cam(p, f("Engineering"), 1.35, SLOW);                       // push in
      for (const n of ["Design", "Engineering", "Finance"]) { await hover(p, f(n), 650); await wait(p, 450); }
      await cam(p, f("Q4 launch"), 2.1, 0);                              // cut
      await hover(p, f("Q4 launch"), 600); await wait(p, 700);
      await click(p, f("Q4 launch"), 200); await wait(p, 900);
      await wide(p, 0);                                                  // cut
      await wait(p, 600);
      await cam(p, p.getByText("Q4 launch plan").first(), 1.9, SLOW, 260, 10);
      await hover(p, p.getByText("Pricing page wireframes").first(), 700); await wait(p, 1200);
      await wide(p, SLOW); await wait(p, 600);
    };
  },
  async "auto-own"(p) {
    await p.goto(`${BASE}/ownership`); await dismissPills(p);
    return async () => {
      await wait(p, 600);
      const tab = p.getByRole("tab", { name: /^Sales/ }).first();
      await cam(p, tab, 2.2, 0, -250, 0);                                // cut close on the tabs
      await click(p, tab, 800); await wait(p, 800);
      await wide(p, 0); await wait(p, 300);                              // cut
      const boxes = p.getByRole("checkbox");
      await cam(p, boxes.nth(2), 1.7, SLOW, 380, 0);
      for (const i of [1, 2, 3]) { await click(p, boxes.nth(i), 450); await wait(p, 300); }
      await wait(p, 400);
      const move = p.getByRole("button", { name: /^Move \d+ files?$/ });
      await cam(p, move, 2.4, 0, -60, 40);                               // cut to the action
      await hover(p, move, 700); await wait(p, 1300);
      await wide(p, SLOW); await wait(p, 500);
    };
  },
  async "auto-share"(p) {
    await p.goto(`${BASE}/sharing`); await dismissPills(p);
    return async () => {
      await wait(p, 600);
      const edit = p.getByRole("button", { name: "Edit" }).nth(1);
      const card = p.getByText("Everyone on Design, plus Alex");
      await cam(p, card, 1.9, SLOW, 0, 40);                              // push in on a rule
      await hover(p, card, 600); await wait(p, 500);
      await click(p, edit, 600); await wait(p, 700);
      const dlg = p.getByRole("dialog").filter({ hasText: "Design rule" });
      await cam(p, dlg, 1.25, MED);
      await wait(p, 500);
      const comment = dlg.getByText("Can comment", { exact: true });
      await cam(p, comment, 2.3, 0, -60, 0);                             // cut to access
      await hover(p, comment, 600); await wait(p, 500);
      await hover(p, dlg.getByText("Can edit", { exact: true }), 500); await wait(p, 900);
      await wide(p, SLOW); await wait(p, 500);
    };
  },
  async oversight(p) {
    await p.goto(`${BASE}/home`); await wait(p, 2500);
    return async () => {
      await wait(p, 600);
      const bell = p.locator('[data-slot="notification-bell"]').first();
      await cam(p, bell, 2.6, 0, -120, 60);                              // cut close on the bell
      await click(p, bell, 800); await wait(p, 300);
      const dlg = p.getByRole("dialog").filter({ hasText: "Notifications" });
      await wide(p, 0); await wait(p, 300);                              // cut
      await cam(p, dlg, 1.45, MED);
      const teams = dlg.getByRole("button", { name: /^Teams/ }).or(dlg.getByRole("tab", { name: /^Teams/ })).first();
      await click(p, teams, 650); await wait(p, 600);
      await cam(p, dlg.getByText("Document created").first(), 2.1, SLOW, 110, 20);
      await wait(p, 1500);
      await wide(p, SLOW); await wait(p, 500);
    };
  },
  async deepsearch(p) {
    await p.goto(`${BASE}/home`); await wait(p, 2500);
    return async () => {
      await wait(p, 600);
      const box = p.getByPlaceholder("Search").first();
      await cam(p, box, 2.6, SLOW);                                      // push in on search
      await click(p, box, 700); await wait(p, 300);
      await box.pressSequentially("launch plan", { delay: 110 }); await wait(p, 400);
      await box.press("Enter"); await wait(p, 500);
      const dlg = p.getByRole("dialog").filter({ hasText: "launch plan" });
      await wide(p, 0);                                                  // cut
      await cam(p, dlg, 1.7, MED);
      await hover(p, dlg.getByText("Q4 launch plan"), 700); await wait(p, 1600);
      await wide(p, SLOW); await wait(p, 500);
    };
  },
  async "org-chart"(p) {
    await p.goto(`${BASE}/home`); await wait(p, 3000);
    return async () => {
      await wait(p, 900);
      await cam(p, p.getByText("Alex Morgan").first(), 1.8, SLOW, 0, 40); // push in on the top
      await wait(p, 500);
      const chev = p.locator("main button[aria-expanded]");
      await cam(p, chev.nth(0), 1.9, 0, -80, 80);                        // cut to a team
      await click(p, chev.nth(0), 700); await wait(p, 1200);
      await cam(p, chev.nth(3), 1.9, SLOW, -80, 80);                     // pan across
      await click(p, chev.nth(3), 600); await wait(p, 1200);
      await wide(p, SLOW); await wait(p, 900);
    };
  },
  async offboard(p) {
    await p.goto(`${BASE}/offboarding`); await dismissPills(p);
    return async () => {
      await wait(p, 600);
      const name = p.getByText("Ben Carter", { exact: true }).first();
      await cam(p, name, 2.0, SLOW, 120, 0);                             // push in on a person
      await wait(p, 500);
      const btn = p.getByRole("button", { name: "Offboard", exact: true }).nth(1);
      await cam(p, btn, 2.2, 0, -200, 0);                                // cut to their row's button
      await click(p, btn, 800); await wait(p, 500);
      const dlg = p.getByRole("dialog").filter({ hasText: "Who takes over" });
      await wide(p, 0); await wait(p, 600);                              // cut
      const r = await dlg.boundingBox();
      const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
      await camAt(p, cx, cy, 1.4, MED);
      await camAt(p, cx, cy - 150, 2.1, 0);                              // cut to who takes over
      await wait(p, 1000);
      await camAt(p, cx, cy + 40, 2.1, SLOW);                            // pan down the files
      await wait(p, 1200);
      await camAt(p, cx, cy, 1.4, MED);
      await hover(p, dlg.getByText(/^Offboard \w+$/), 700); await wait(p, 900);
      await wide(p, SLOW); await wait(p, 500);
    };
  },
};

for (const [id, setup] of Object.entries(clips)) {
  if (only && !only.split(",").includes(id)) continue;
  const dir = `.out/raw/${id}`; fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const ctx = await b.newContext({ storageState: ".out/state.json", viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
  await ctx.addInitScript(CAM);
  const p = await ctx.newPage();
  mouse = { x: 800, y: 980 };
  try {
    const act = await setup(p);
    await p.mouse.move(mouse.x, mouse.y);
    await wait(p, 300);
    // Chrome's own screencast: every changed frame, 2x, with its timestamp.
    const cdp = await ctx.newCDPSession(p);
    const frames = [];
    let n = 0;
    cdp.on("Page.screencastFrame", async (f) => {
      const file = `${dir}/${String(n++).padStart(5, "0")}.jpg`;
      fs.writeFileSync(file, Buffer.from(f.data, "base64"));
      frames.push({ file, t: f.metadata.timestamp });
      cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {});
    });
    await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: 3200, maxHeight: 1800, everyNthFrame: 1 });
    // Nudge a repaint so the first frame lands now.
    await p.mouse.move(mouse.x + 1, mouse.y); await p.mouse.move(mouse.x, mouse.y);
    await wait(p, 200);
    await act();
    const end = Date.now() / 1000;
    await cdp.send("Page.stopScreencast");
    frames.push({ file: null, t: end });
    fs.writeFileSync(`${dir}/frames.json`, JSON.stringify(frames));
    console.log(id, "ok", n, "frames", (end - frames[0].t).toFixed(1) + "s");
  } catch (e) { console.log(id, "FAILED", e.message.split("\n")[0]); await p.screenshot({ path: `${dir}/fail.png` }); }
  await ctx.close();
}
await b.close();
