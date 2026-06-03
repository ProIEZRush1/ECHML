// Apply safe PRICE_DISCOUNT offers to tapabocas (masks only): 5% off where ML allows
// a profitable (>=90%) price, skip the rest (margin floor). Waits for the floor deploy.
const API = "https://echml.overcloud.us", KEY = "ech_caa7d736-42b4-4a2a-a83d-af84495074c7";
const H = { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const isMask = t => /cubrebocas|tapabocas/i.test(t || "");
async function post(b) { try { const r = await fetch(`${API}/api/ml/auto-offers`, { method: "POST", headers: H, body: JSON.stringify(b) }); const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; } return { status: r.status, j }; } catch (e) { return { status: 0, j: { error: String(e).slice(0, 80) } }; } }

console.log("waiting ~170s for margin-floor deploy...");
await sleep(170000);

// confirm floor is live: dry-run should show some skip_below_margin_floor rows
let live = false;
for (let a = 0; a < 30; a++) {
  const d = await post({ dryRun: true, forceCurrentMonth: true, only: "masks" });
  const rows = Array.isArray(d.j?.results) ? d.j.results.filter(r => isMask(r.title)) : [];
  const floor = rows.filter(r => r.action === "skip_below_margin_floor").length;
  const wouldLoss = rows.filter(r => r.action === "would_create" && r.offerPrice < r.basePrice * 0.9).length;
  if (rows.length > 0 && wouldLoss === 0) { // no loss-making would_create -> floor active (or all profitable)
    live = true;
    console.log(`floor live. rows=${rows.length} floorSkips=${floor} wouldCreate=${rows.filter(r=>r.action==="would_create").length}`);
    break;
  }
  process.stdout.write(".");
  await sleep(15000);
}
if (!live) { console.log("\nfloor deploy not confirmed"); process.exit(1); }

console.log("\n--- REAL RUN (masks only, safe) ---");
const real = await post({ forceCurrentMonth: true, only: "masks" });
const rows = Array.isArray(real.j?.results) ? real.j.results.filter(r => isMask(r.title)) : [];
let ok = 0, floor = 0, cred = 0, other = 0;
for (const r of rows) {
  if (r.action === "created") { ok++; console.log(`  created $${r.offerPrice} (de $${r.basePrice})  ${r.title}`); }
  else if (r.action === "skip_below_margin_floor") floor++;
  else if (/CREDIBILITY/i.test(r.error || "")) cred++;
  else if (r.action === "error") { other++; console.log(`  ERR ${(r.error||"").slice(0,70)} ${r.title}`); }
}
console.log(`\nRESULT: created=${ok} skipped_floor=${floor} credibility=${cred} other=${other}`);
console.log(real.j.message);
