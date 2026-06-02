// Upload the 8 generated images per listing to ML and relink (portada = photo 1).
// Reads listings.json (item->pack map). Saves uploaded ML picture ids back to state
// under listings[v].pics for idempotency/reset. Re-running re-PUTs from saved pics.
import { readFile, writeFile } from "node:fs/promises";

const API = "https://echml.overcloud.us";
const KEY = "ech_caa7d736-42b4-4a2a-a83d-af84495074c7";
const DIR = "/Users/ech/Documents/Dev/Projects/ECHML/generated-images/tapabocas/out";
const STATE = "/Users/ech/Documents/Dev/Projects/ECHML/generated-images/tapabocas/listings.json";
const SIZE = { "BM-TAPABOCAS-1000": 1000, "BM-TAPABOCAS-500": 500, "BM-TAPABOCAS-400": 400, "BM-TAPABOCAS-300": 300 };

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function ml(method, endpoint, body) {
  const p = { method, endpoint }; if (body !== undefined) p.body = body;
  const r = await fetch(`${API}/api/ml/proxy`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` }, body: JSON.stringify(p) });
  const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; } return { status: r.status, j };
}
async function putRetry(endpoint, body) {
  let res; for (let a = 0; a < 5; a++) { res = await ml("PUT", endpoint, body); if (res.status < 400) return res; if (!(res.status === 429 || res.status >= 500)) return res; await sleep(1500 * (a + 1)); } return res;
}
async function upload(file) {
  const d = await readFile(`${DIR}/${file}`);
  for (let a = 0; a < 4; a++) {
    try {
      const form = new FormData(); form.append("file", new Blob([d], { type: "image/png" }), file);
      const r = await fetch(`${API}/api/ml/upload-picture`, { method: "POST", headers: { Authorization: `Bearer ${KEY}` }, body: form });
      if (!r.ok) throw new Error(String(r.status));
      const j = await r.json(); const id = j.id || j.picture_id || (j.body && j.body.id);
      if (!id) throw new Error("no id"); return id;
    } catch (e) { await sleep(1500 * (a + 1)); }
  }
  throw new Error("upload failed " + file);
}

const state = JSON.parse(await readFile(STATE, "utf8"));
let done = 0, err = 0;
for (const [sku, pack] of Object.entries(state.packs)) {
  const n = SIZE[sku];
  for (const [variant, listing] of Object.entries(pack.listings)) {
    if (!listing.itemId) { continue; }
    if (listing.picsApplied) { done++; console.log(`skip ${sku} ${variant} (already applied)`); continue; }
    try {
      // upload 8 (reuse saved ids if a prior run uploaded but failed the PUT)
      let pics = listing.pics;
      if (!pics || pics.length !== 8) {
        pics = [];
        for (let i = 1; i <= 8; i++) pics.push(await upload(`p${n}-${variant}-${i}.png`));
        listing.pics = pics; await writeFile(STATE, JSON.stringify(state, null, 2));
      }
      const res = await putRetry(`/items/${listing.itemId}`, { pictures: pics.map(id => ({ id })) });
      if (res.status < 400) { listing.picsApplied = true; done++; console.log(`OK ${sku} ${variant} -> ${listing.itemId} (8 pics)`); }
      else { err++; console.log(`PUT ERR ${sku} ${variant}: ${JSON.stringify(res.j).slice(0, 160)}`); }
      await writeFile(STATE, JSON.stringify(state, null, 2));
      await sleep(300);
    } catch (e) { err++; console.log(`ERR ${sku} ${variant}: ${String(e).slice(0, 140)}`); }
  }
}
console.log(`\nApplied images: done=${done} err=${err}`);
