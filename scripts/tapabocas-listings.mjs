// Create the tapabocas ML listings: 4 pack sizes x 5 variants = 20.
// Pack1000-V1 (clean) already exists (MLM2976093275) and is skipped.
// Placeholder image for all; real images swapped in once the batch is done.
// Saves item->pack map to generated-images/tapabocas/listings.json
import { writeFile, readFile } from "node:fs/promises";

const API = "https://echml.overcloud.us";
const KEY = "ech_caa7d736-42b4-4a2a-a83d-af84495074c7";
const PLACEHOLDER = "690607-MLM111570211866_062026";
const STATE = "/Users/ech/Documents/Dev/Projects/ECHML/generated-images/tapabocas/listings.json";

// pack size -> price, available qty (packs), package weight(g) + dims(cm), pack SKU
const PACKS = {
  1000: { price: 849, qty: 200, weight: 4000, dim: [25, 30, 40], sku: "BM-TAPABOCAS-1000" },
  500:  { price: 469, qty: 400, weight: 2200, dim: [20, 28, 35], sku: "BM-TAPABOCAS-500" },
  400:  { price: 389, qty: 500, weight: 1800, dim: [20, 25, 30], sku: "BM-TAPABOCAS-400" },
  300:  { price: 309, qty: 666, weight: 1400, dim: [18, 22, 30], sku: "BM-TAPABOCAS-300" },
};

// variant -> family_name builder (ML appends " Azul" from COLOR; keep <=54 chars)
const VARIANTS = {
  clean:     n => `Cubrebocas Tricapa Desechable ${n} Piezas Mayoreo`,
  lifestyle: n => `Tapabocas 3 Capas ${n} Piezas Clip Nasal Uso Diario`,
  flatlay:   n => `Cubrebocas Desechable Tricapa ${n} Piezas Caja Adulto`,
  premium:   n => `Tapabocas Tricapa ${n} Piezas Elástico Suave Adulto`,
  valor:     n => `Cubrebocas ${n} Piezas Tricapa Desechable Por Mayor`,
};
const VNUM = { clean: 1, lifestyle: 2, flatlay: 3, premium: 4, valor: 5 };

// already-created (pack1000 clean)
const PREEXISTING = { "1000-clean": "MLM2976093275" };

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function ml(method, endpoint, body) {
  const p = { method, endpoint };
  if (body !== undefined) p.body = body;
  const r = await fetch(`${API}/api/ml/proxy`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` }, body: JSON.stringify(p) });
  const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; }
  return { status: r.status, j };
}
async function createRetry(body) {
  let res;
  for (let a = 0; a < 4; a++) {
    res = await ml("POST", "/items", body);
    if (res.status < 400) return res;
    const retry = res.status === 429 || res.status >= 500;
    if (!retry) return res;
    await sleep(1500 * (a + 1));
  }
  return res;
}

function buildBody(n, variant) {
  const p = PACKS[n];
  const [h, w, l] = p.dim;
  return {
    family_name: VARIANTS[variant](n),
    category_id: "MLM178498",
    price: p.price,
    currency_id: "MXN",
    available_quantity: p.qty,
    buying_mode: "buy_it_now",
    listing_type_id: "gold_pro",
    condition: "new",
    pictures: [{ id: PLACEHOLDER }],
    shipping: { mode: "me2", local_pick_up: false, free_shipping: false },
    attributes: [
      { id: "BRAND", value_name: "Genérica" },
      { id: "MODEL", value_name: "Tricapa Desechable" },
      { id: "MATERIAL", value_id: "2482319" },
      { id: "COLOR", value_id: "52028" },
      { id: "SALE_FORMAT", value_id: "1359392" },
      { id: "UNITS_PER_PACK", value_name: String(n) },
      { id: "UNITS_PER_PACKAGE", value_name: String(n) },
      { id: "LAYERS_NUMBER", value_name: "3" },
      { id: "MASK_GRIP_TYPE", value_id: "2528345" },
      { id: "AGE_GROUP", value_id: "6725189" },
      { id: "WITH_NASAL_ADJUSTMENT", value_id: "242085" },
      { id: "IS_DISPOSABLE", value_id: "242085" },
      { id: "IS_SURGICAL", value_id: "242084" },
      { id: "IS_INDUSTRIAL", value_id: "242084" },
      { id: "EMPTY_GTIN_REASON", value_id: "17055159" },
      { id: "SELLER_SKU", value_name: `${p.sku}-V${VNUM[variant]}` },
      { id: "SELLER_PACKAGE_WEIGHT", value_name: `${p.weight} g` },
      { id: "SELLER_PACKAGE_HEIGHT", value_name: `${h} cm` },
      { id: "SELLER_PACKAGE_WIDTH", value_name: `${w} cm` },
      { id: "SELLER_PACKAGE_LENGTH", value_name: `${l} cm` },
    ],
  };
}

async function main() {
  let state = { packs: {} };
  try { state = JSON.parse(await readFile(STATE, "utf8")); } catch {}
  state.packs ||= {};
  let made = 0, skip = 0, err = 0;
  for (const n of [1000, 500, 400, 300]) {
    const sku = PACKS[n].sku;
    state.packs[sku] ||= { size: n, price: PACKS[n].price, listings: {} };
    for (const variant of Object.keys(VARIANTS)) {
      const key = `${n}-${variant}`;
      if (state.packs[sku].listings[variant]?.itemId) { skip++; continue; }
      if (PREEXISTING[key]) {
        state.packs[sku].listings[variant] = { itemId: PREEXISTING[key], sku: `${sku}-V${VNUM[variant]}` };
        skip++; continue;
      }
      const res = await createRetry(buildBody(n, variant));
      if (res.status < 400 && res.j?.id) {
        state.packs[sku].listings[variant] = { itemId: res.j.id, sku: `${sku}-V${VNUM[variant]}`, title: res.j.title, permalink: res.j.permalink };
        made++;
        console.log(`OK ${key} -> ${res.j.id}  "${res.j.title}"`);
      } else {
        err++;
        console.log(`ERR ${key}: ${JSON.stringify(res.j).slice(0, 200)}`);
      }
      await writeFile(STATE, JSON.stringify(state, null, 2));
      await sleep(400);
    }
  }
  console.log(`\nDone. created=${made} skipped=${skip} err=${err}`);
  // flat list of all item ids
  const all = [];
  for (const [sku, p] of Object.entries(state.packs)) for (const [v, l] of Object.entries(p.listings)) all.push(`${sku} ${v} ${l.itemId}`);
  console.log(all.join("\n"));
}
main().catch(e => { console.error(e); process.exit(1); });
