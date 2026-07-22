// Production UI journey: hire a worker through the real UI, give it a real job,
// watch the live floor, verify the result lands in work history, then clean up
// via the API. Screenshots land in stress_shots/, findings in stress_ui_report.json.
const { chromium } = require("playwright");
const fs = require("fs");

const FRONTEND = (process.env.FRONTEND_URL || "https://frontend-production-a9cc3.up.railway.app").replace(/\/$/, "");
const BACKEND = (process.env.BACKEND_URL || "https://backend-production-a20b.up.railway.app").replace(/\/$/, "");
const RUN_ID = Math.random().toString(36).slice(2, 8);
const AGENT_NAME = `ZZ-STRESS-UI-${RUN_ID}`;
const OUT = "stress_shots";
fs.mkdirSync(OUT, { recursive: true });

const report = { run_id: RUN_ID, steps: [], console_errors: {}, failed_requests: {}, findings: [] };
const step = (name, ok, detail = "") => {
  report.steps.push({ name, ok, detail: String(detail).slice(0, 400) });
  console.log(`${ok ? "PASS" : "FAIL"} ${name} ${detail}`);
};
const finding = (severity, text) => {
  report.findings.push({ severity, text });
  console.log(`FINDING [${severity}] ${text}`);
};

async function apiDeleteAgent() {
  // drain-then-delete: never delete while a task may still be running
  try {
    const list = await (await fetch(`${BACKEND}/agents/`)).json();
    const mine = list.filter((a) => a.name === AGENT_NAME);
    for (const a of mine) {
      for (let i = 0; i < 40; i++) {
        const cur = await (await fetch(`${BACKEND}/agents/${a.id}`)).json();
        if (["idle", "error"].includes(cur.status)) break;
        await new Promise((r) => setTimeout(r, 5000));
      }
      const del = await fetch(`${BACKEND}/agents/${a.id}`, { method: "DELETE" });
      step("cleanup: delete UI agent via API", del.ok, `status ${del.status}`);
    }
  } catch (e) {
    step("cleanup: delete UI agent via API", false, e.message);
  }
}

(async () => {
  const browser = await chromium.launch();
  const instrument = (page, tag) => {
    report.console_errors[tag] = [];
    report.failed_requests[tag] = [];
    page.on("console", (m) => {
      if (m.type() === "error") report.console_errors[tag].push(m.text().slice(0, 300));
    });
    page.on("requestfailed", (r) => {
      report.failed_requests[tag].push(`${r.method()} ${r.url().slice(0, 120)} ${r.failure()?.errorText}`);
    });
    page.on("pageerror", (e) => report.console_errors[tag].push("pageerror: " + e.message.slice(0, 300)));
  };

  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  instrument(page, "desktop");

  try {
    // 1) home
    let t0 = Date.now();
    await page.goto(FRONTEND + "/", { waitUntil: "networkidle", timeout: 45000 }).catch((e) => step("home load", false, e.message));
    const homeMs = Date.now() - t0;
    await page.waitForTimeout(4000);
    await page.screenshot({ path: `${OUT}/prod-home.png` });
    step("home load", true, `${homeMs}ms to networkidle`);
    if (homeMs > 8000) finding("P2", `Home took ${homeMs}ms to reach network idle on a fast runner`);

    // 2) hire flow through the real create studio
    await page.goto(FRONTEND + "/agents/new", { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(3500);
    const hireBtn = page.getByRole("button", { name: /hire worker/i });
    const disabledBefore = await hireBtn.isDisabled().catch(() => null);
    step("hire button gated before input", disabledBefore === true, `disabled=${disabledBefore}`);
    await page.fill("#ag-name", AGENT_NAME);
    await page.fill("#ag-title", "UI Journey Probe");
    await page.selectOption("#ag-dept", "Operations");
    await page.selectOption("#ag-model", "claude-haiku-4-5-20251001").catch(async () => {
      // option values are model ids; fall back to label match
      await page.selectOption("#ag-model", { label: "Fastest" }).catch(() => {});
    });
    await page.screenshot({ path: `${OUT}/prod-create-filled.png` });
    t0 = Date.now();
    await hireBtn.click();
    // MintReveal overlay then CTA -> profile
    const mint = await page
      .waitForSelector("text=/welcome|joined|minted|meet/i", { timeout: 20000 })
      .catch(() => null);
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${OUT}/prod-mint-reveal.png` });
    step("hire via UI produced reveal moment", !!mint, `${Date.now() - t0}ms`);
    // find any CTA button on the overlay and click it to continue
    const cta = page
      .getByRole("button", { name: /meet|continue|go|profile|floor|start/i })
      .first();
    if (await cta.count()) await cta.click().catch(() => {});
    await page.waitForTimeout(3000);
    const onProfile = page.url().includes("/agents/");
    step("landed on agent profile after hire", onProfile, page.url());
    await page.screenshot({ path: `${OUT}/prod-profile.png` });

    // 3) run a real job through RunTaskDialog
    const giveJob = page.getByRole("button", { name: /give a job/i }).first();
    if (await giveJob.count()) {
      await giveJob.click();
      await page.waitForTimeout(1000);
      await page.getByText("Write something", { exact: false }).first().click();
      await page.waitForTimeout(600);
      const req = page.locator("textarea, input[type=text]").first();
      await req.fill("Write one short, warm sentence welcoming a new teammate named Sam.");
      await page.screenshot({ path: `${OUT}/prod-run-dialog.png` });
      const submit = page.getByRole("button", { name: /send|start|run|go|write/i }).last();
      await submit.click();
      await page.waitForTimeout(1500);
      const toast = await page.getByText(/is on it/i).count();
      step("job queued via dialog (toast)", toast > 0, `toasts=${toast}`);
    } else {
      step("job queued via dialog (toast)", false, "Give a job button not found");
    }

    // 4) live floor while the task runs
    await page.goto(FRONTEND + "/live", { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(6000);
    await page.screenshot({ path: `${OUT}/prod-live-during.png` });
    const streamingPill = await page.getByText(/streaming|reconnecting|connecting/i).count();
    step("live floor shows stream state pill", streamingPill > 0, `matches=${streamingPill}`);

    // 5) poll the API for the finished work row (UI has no push into history)
    let row = null;
    const agents = await (await fetch(`${BACKEND}/agents/`)).json();
    const mine = agents.find((a) => a.name === AGENT_NAME);
    if (mine) {
      for (let i = 0; i < 36 && !row; i++) {
        const rows = await (await fetch(`${BACKEND}/work-log/${mine.id}?limit=10`)).json();
        row = rows.find((r) => (r.result || "").length > 0) || null;
        if (!row) await new Promise((r) => setTimeout(r, 5000));
      }
    }
    step("task finished on backend", !!row, row ? `tokens=${row.tokens_used}` : "no row in 180s");

    // 6) does the finished result actually surface in the profile UI?
    if (mine) {
      await page.goto(`${FRONTEND}/agents/${mine.id}`, { waitUntil: "domcontentloaded", timeout: 45000 });
      await page.waitForTimeout(4000);
      const overviewTab = page.getByRole("button", { name: /overview/i }).first();
      if (await overviewTab.count()) await overviewTab.click().catch(() => {});
      await page.waitForTimeout(1500);
      const hasHistory = await page.getByText(/work history|no tasks recorded/i).count();
      const resultShown = row
        ? await page.getByText(row.result.slice(0, 40), { exact: false }).count()
        : 0;
      await page.screenshot({ path: `${OUT}/prod-profile-after.png`, fullPage: true });
      step("result visible in profile work history", resultShown > 0,
        `historySection=${hasHistory} resultMatch=${resultShown}`);
      if (row && resultShown === 0)
        finding("P1", "Finished task result not visible on the profile page without a hard refresh — recent_work only loads on server render");
    }

    // 7) other pages, desktop + mobile
    for (const [name, path] of [["hq", "/hq"], ["network", "/network"]]) {
      await page.goto(FRONTEND + path, { waitUntil: "domcontentloaded", timeout: 45000 }).catch(() => {});
      await page.waitForTimeout(5000);
      await page.screenshot({ path: `${OUT}/prod-${name}.png` });
    }
    const mob = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    instrument(mob, "mobile");
    for (const [name, path] of [["home", "/"], ["live", "/live"], ["new", "/agents/new"]]) {
      await mob.goto(FRONTEND + path, { waitUntil: "domcontentloaded", timeout: 45000 }).catch(() => {});
      await mob.waitForTimeout(4500);
      await mob.screenshot({ path: `${OUT}/prod-m-${name}.png`, fullPage: true });
      const spill = await mob.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (spill > 2) finding("P2", `mobile ${path} horizontal overflow ${spill}px`);
    }
    await mob.close();
  } catch (e) {
    step("journey crashed", false, e.message);
    await page.screenshot({ path: `${OUT}/prod-crash.png` }).catch(() => {});
  } finally {
    await apiDeleteAgent();
    for (const tag of Object.keys(report.console_errors)) {
      const errs = report.console_errors[tag];
      if (errs.length) finding("P2", `${tag}: ${errs.length} console errors, first: ${errs[0]}`);
    }
    fs.writeFileSync("stress_ui_report.json", JSON.stringify(report, null, 1));
    await browser.close();
  }
})();
