// Switch all 20 tapabocas listings to Clásica (gold_special) and set new profitable prices.
import { readFile } from "node:fs/promises";
const API = "https://echml.overcloud.us", KEY = "ech_caa7d736-42b4-4a2a-a83d-af84495074c7";
const STATE = "/Users/ech/Documents/Dev/Projects/ECHML/generated-images/tapabocas/listings.json";
const PRICE = { "BM-TAPABOCAS-1000": 1180, "BM-TAPABOCAS-500": 700, "BM-TAPABOCAS-400": 610, "BM-TAPABOCAS-300": 510 };
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function ml(method, endpoint, body) {
  const p = { method, endpoint }; if (body !== undefined) p.body = body;
  const r = await fetch(`${API}/api/ml/proxy`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` }, body: JSON.stringify(p) });
  const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; } return { status: r.status, j };
}
const state = JSON.parse(await readFile(STATE, "utf8"));
let ok = 0, err = 0;
for (const [sku, pack] of Object.entries(state.packs)) {
  const price = PRICE[sku]; if (!price) continue;
  for (const [variant, l] of Object.entries(pack.listings)) {
    if (!l.itemId) continue;
    // 1) ensure Clásica
    const lt = await ml("POST", `/items/${l.itemId}/listing_type`, { id: "gold_special" });
    // 2) set new price
    const pr = await ml("PUT", `/items/${l.itemId}`, { price });
    if (lt.status < 400 && pr.status < 400) { ok++; console.log(`OK ${sku} ${variant} -> Clásica $${price}`); }
    else { err++; console.log(`ERR ${sku} ${variant}: lt=${lt.status} pr=${pr.status} ${JSON.stringify(pr.j).slice(0,100)}`); }
    await sleep(300);
  }
}
console.log(`\nClásica+precios: ok=${ok} err=${err}`);
