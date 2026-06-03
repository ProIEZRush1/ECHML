// Wait for auto-offers deploy (GET now returns a `masks` group), then dry-run + real run.
const API = "https://echml.overcloud.us", KEY = "ech_caa7d736-42b4-4a2a-a83d-af84495074c7";
const H = { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` };
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function get() { try { const r = await fetch(`${API}/api/ml/auto-offers`, { headers: H }); const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; } return { status: r.status, j }; } catch { return { status: 0, j: null }; } }
async function post(body) { try { const r = await fetch(`${API}/api/ml/auto-offers`, { method: "POST", headers: H, body: JSON.stringify(body) }); const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; } return { status: r.status, j }; } catch (e) { return { status: 0, j: { error: String(e).slice(0,80) } }; } }

// 1) wait until the new code is live (response has `masks` key)
let live = false;
for (let a = 0; a < 60; a++) {
  const g = await get();
  if (g.status === 200 && g.j && typeof g.j === "object" && "masks" in g.j) {
    live = true;
    console.log(`masks targeted: ${g.j.masks.count} | playeras ${g.j.playeras.count} | timis ${g.j.timis.count}`);
    break;
  }
  process.stdout.write(".");
  await sleep(10000);
}
if (!live) { console.log("\nendpoint not updated after wait"); process.exit(1); }

// 2) dry run (current month so offers would start now), to show planned mask offers
console.log("\n--- DRY RUN (masks only, forceCurrentMonth) ---");
const dry = await post({ dryRun: true, forceCurrentMonth: true, only: "masks" });
const maskRows = (dry.j.results || []).filter(r => /cubrebocas|tapabocas/i.test(r.title || ""));
for (const r of maskRows) console.log(`${r.action}  $${r.basePrice} -> $${r.offerPrice}  ${r.title}`);
console.log(`dry: created=${dry.j.created} skipped=${dry.j.skipped} errors=${dry.j.errors} (mask rows=${maskRows.length})`);

// 3) real run
console.log("\n--- REAL RUN (masks only, forceCurrentMonth) ---");
const real = await post({ forceCurrentMonth: true, only: "masks" });
const realMask = (real.j.results || []).filter(r => /cubrebocas|tapabocas/i.test(r.title || ""));
let ok = 0, credErr = 0, other = 0;
for (const r of realMask) {
  if (r.action === "created") ok++;
  else if (/CREDIBILITY/i.test(r.error || "")) credErr++;
  else other++;
}
for (const r of realMask.slice(0, 6)) console.log(`${r.action}  $${r.offerPrice}  ${(r.error||"").slice(0,60)}`);
console.log(`\nREAL masks: created=${ok} credibility_blocked=${credErr} other=${other}`);
console.log(real.j.message);
