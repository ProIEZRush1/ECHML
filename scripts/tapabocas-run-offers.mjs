// Apply PRICE_DISCOUNT offers to tapabocas (masks only) via /api/ml/auto-offers.
// Waits for deploy of the promotion_type fix, retrying the real run (spaced, since
// the endpoint scans ~880 listings/run) until ML stops returning "Invalid promotion type".
const API = "https://echml.overcloud.us", KEY = "ech_caa7d736-42b4-4a2a-a83d-af84495074c7";
const H = { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const isMaskTitle = t => /cubrebocas|tapabocas/i.test(t || "");

async function post(body) {
  try {
    const r = await fetch(`${API}/api/ml/auto-offers`, { method: "POST", headers: H, body: JSON.stringify(body) });
    const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; }
    return { status: r.status, j };
  } catch (e) { return { status: 0, j: { error: String(e).slice(0, 80) } }; }
}

console.log("waiting ~150s for Coolify deploy...");
await sleep(150000);

let final = null;
for (let attempt = 1; attempt <= 8; attempt++) {
  console.log(`\n=== attempt ${attempt} (real run, masks only) ===`);
  const res = await post({ forceCurrentMonth: true, only: "masks" });
  const rows = Array.isArray(res.j?.results) ? res.j.results.filter(r => isMaskTitle(r.title)) : [];
  const invalidType = rows.filter(r => /Invalid promotion type/i.test(r.error || "")).length;
  let ok = 0, cred = 0, other = 0;
  for (const r of rows) {
    if (r.action === "created") ok++;
    else if (/CREDIBILITY/i.test(r.error || "")) cred++;
    else if (r.action === "error") other++;
  }
  console.log(`rows=${rows.length} created=${ok} credibility=${cred} invalidType=${invalidType} otherErr=${other - invalidType}`);
  if (invalidType === rows.length && rows.length > 0) {
    console.log("  -> old code still live, waiting 60s");
    await sleep(60000);
    continue;
  }
  // new code is live (no more invalid-type) — capture and stop
  final = res.j;
  for (const r of rows) console.log(`  ${r.action} $${r.offerPrice} ${(r.error || "").slice(0, 70)}`);
  break;
}
if (final) console.log(`\nFINAL: ${final.message}`);
else console.log("\nstill blocked after retries");
