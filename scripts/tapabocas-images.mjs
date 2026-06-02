// Generate 160 ML listing images for Tapabocas packs:
// 4 pack sizes (1000/500/400/300) x 5 visual variants x 8 photos = 160.
// gpt-image-2 edits, medium quality, single blue-mask reference. Portadas = ZERO text.
import { writeFile, readFile } from "node:fs/promises";

const API_URL = "https://echml.overcloud.us";
const API_KEY = "ech_caa7d736-42b4-4a2a-a83d-af84495074c7";
const REF = "/Users/ech/Documents/Dev/Projects/ECHML/generated-images/tapabocas/ref.png";

const PACKS = [
  { n: 1000, pile: "an abundant overflowing pile of many dozens of masks" },
  { n: 500,  pile: "a large generous pile of masks" },
  { n: 400,  pile: "a generous stack of masks" },
  { n: 300,  pile: "a neat tidy stack of masks" },
];

// Product lock — every prompt must reproduce the exact reference mask.
const P = "a light blue 3-ply disposable face mask (cubrebocas / tapabocas tricapa) with horizontal pleats, a soft white inner layer, soft white elastic ear loops and a bendable metal nose-clip strip at the top. CRITICAL: reproduce the EXACT mask from the reference image — same light-blue color, same pleated shape, same ear loops; do NOT invent a different mask, color or design.";
const NOTEXT = "ABSOLUTELY NO text, NO words, NO letters, NO numbers, NO watermark, NO logo, NO overlay of any kind anywhere in the image.";
const SPELL = "Any Spanish text must be correctly spelled, crisp, clean, professional, with comfortable margins and nothing cropped at the edges.";

// Each variant returns its 8 photo prompts for a given pack size n + pile description.
const VARIANTS = {
  // V1 — CLEAN E-COMMERCE
  clean: (n, pile) => [
    `Clean e-commerce studio cover (portada) on a pure white seamless background: ${pile} of ${P} neatly arranged and centered, bright even product lighting, soft shadow. Photorealistic, 1:1. ${NOTEXT}`,
    `E-commerce photo of ${P} shown as a packaged bundle on white. Add a clean bold dark-gray Spanish overlay title: "PAQUETE DE ${n} PIEZAS". ${SPELL}`,
    `Extreme macro of ${P} edge showing the three fabric layers separated. Add a short clean Spanish overlay: "3 CAPAS DE PROTECCIÓN". ${SPELL}`,
    `Close-up macro of the top of ${P} focusing on the bendable metal nose clip. Add a short clean Spanish overlay: "CLIP NASAL AJUSTABLE". ${SPELL}`,
    `Lifestyle photo of a friendly Mexican person comfortably wearing ${P} outdoors, natural daylight. ${NOTEXT}`,
    `Lifestyle context photo of a person wearing ${P} in an office / on the street. Add a small clean Spanish overlay: "USO DIARIO". ${SPELL}`,
    `Clean infographic on white with ${P} and three feature bullets in Spanish: "Tricapa", "Elástico suave", "Clip nasal ajustable", each with a simple line icon. ${SPELL}`,
    `Clean trust frame with ${P} and a Spanish overlay: "Calidad garantizada" plus a small check-mark icon, soft professional layout. ${SPELL}`,
  ],
  // V2 — LIFESTYLE EMOCIONAL
  lifestyle: (n, pile) => [
    `Warm emotional lifestyle cover (portada): a real person calmly wearing ${P}, soft warm background, shallow depth of field, natural light. Photorealistic, 1:1. ${NOTEXT}`,
    `Lifestyle photo of ${pile} of ${P} resting ready on a warm wooden table at home. Add a soft Spanish overlay: "LISTO PARA USAR". ${SPELL}`,
    `Close-up of a person wearing ${P}, gentle smile in the eyes. Add a soft Spanish overlay: "Ajuste cómodo". ${SPELL}`,
    `Close-up of the white ear loop of ${P} stretched gently over an ear. Add a soft Spanish overlay: "Se adapta perfectamente". ${SPELL}`,
    `Emotional everyday moment: a family or commuter wearing ${P}, warm tones. ${NOTEXT}`,
    `Relaxed daily scene of someone wearing ${P} walking in the city. Add a small Spanish overlay: "Protección para tu día". ${SPELL}`,
    `Soft lifestyle infographic with ${P} and three gentle Spanish bullets: "Cómodo", "Ligero", "Transpirable". ${SPELL}`,
    `Aspirational warm frame with ${P} and a Spanish overlay: "Cuida lo que más importa". ${SPELL}`,
  ],
  // V3 — FLAT LAY / COMPOSICION
  flatlay: (n, pile) => [
    `Top-down cenital flat-lay cover (portada): ${pile} of ${P} fanned out neatly on a soft pastel surface, bright airy light, premium composition. Photorealistic, 1:1. ${NOTEXT}`,
    `Flat-lay of ${P} with thin clean lines and small Spanish labels pointing to its parts (pliegues, clip nasal, elástico). ${SPELL}`,
    `Clean cross-section diagram of ${P} showing its 3 layers stacked, with a short Spanish caption "Tres capas filtrantes". ${SPELL}`,
    `Diagram of ${P} with arrows explaining the adjustable nose clip and pleats that expand. Short Spanish labels. ${SPELL}`,
    `Flat-lay of ${P} in use context (next to phone, keys, hand sanitizer) with a small Spanish info caption "Llévalo a todas partes". ${SPELL}`,
    `A hand holding a single ${P} over a pastel flat-lay, showing the pleats expanding. ${SPELL}`,
    `Detailed Spanish infographic with ${P}: bullets "Tricapa", "Clip nasal ajustable", "Elástico suave", "Color azul", "Uso diario". ${SPELL}`,
    `Spanish FAQ frame for ${P} with 2 short questions and answers: "¿Es reutilizable? Uso diario recomendado." and "¿Qué incluye? Paquete de ${n} piezas." ${SPELL}`,
  ],
  // V4 — PREMIUM / MARCA
  premium: (n, pile) => [
    `Premium elegant cover (portada): ${pile} of ${P} on a beige / cream surface with a soft elegant shadow, minimalist Apple-style product lighting. Photorealistic, 1:1. ${NOTEXT}`,
    `Premium aesthetic composition of ${P} arranged minimally on cream. Add a refined small Spanish overlay: "Diseño tricapa". ${SPELL}`,
    `Artistic macro of the pleated texture of ${P}, premium lighting. Add a minimal Spanish overlay: "Material suave". ${SPELL}`,
    `Clean minimal detail of the nose clip of ${P} on cream background. Add a minimal Spanish overlay: "Ajuste preciso". ${SPELL}`,
    `Clean premium lifestyle: a well-dressed person wearing ${P} in a bright modern home. ${NOTEXT}`,
    `Aspirational premium scene of a person wearing ${P} in a stylish setting. Add a minimal Spanish overlay: "Comodidad todo el día". ${SPELL}`,
    `Minimal elegant infographic with ${P} and three refined Spanish bullets: "Tricapa", "Cómodo", "Ligero". ${SPELL}`,
    `Premium trust frame with ${P} and Spanish overlay: "Calidad garantizada · Hecho para tu día a día". ${SPELL}`,
  ],
  // V5 — VALOR / PACK (mayoreo)
  valor: (n, pile) => [
    `Value-pack cover (portada): ${pile} of ${P} organized beautifully on a clean light background showing great quantity and abundance. Photorealistic, 1:1. ${NOTEXT}`,
    `Photo of the full bundle: ${pile} of ${P}. Add a bold Spanish overlay: "PAQUETE COMPLETO ${n} PIEZAS". ${SPELL}`,
    `Photo of ${P} highlighting quality. Add a Spanish overlay: "ALTA CALIDAD". ${SPELL}`,
    `Photo of several ${P} spread out. Add a Spanish overlay: "USO DIARIO". ${SPELL}`,
    `Lifestyle photo of a person wearing one ${P} from the pack. ${NOTEXT}`,
    `Collage-style photo of ${P} used in several everyday situations. Add a Spanish overlay: "PARA CADA MOMENTO". ${SPELL}`,
    `Value infographic with ${P} and Spanish bullets: "Económico", "Práctico", "${n} piezas". ${SPELL}`,
    `Bulk-savings frame with ${P} and a bold Spanish overlay: "AHORRA COMPRANDO POR MAYOREO". ${SPELL}`,
  ],
};

async function uploadFile(path, purpose, fname) {
  const data = await readFile(path);
  const form = new FormData();
  form.append("purpose", purpose);
  form.append("file", new Blob([data]), fname);
  const r = await fetch(`${API_URL}/api/openai/upload-file`, { method: "POST", headers: { Authorization: `Bearer ${API_KEY}` }, body: form });
  if (!r.ok) throw new Error(`upload ${r.status}: ${(await r.text()).slice(0,150)}`);
  return (await r.json()).id;
}
async function proxy(method, endpoint, payload) {
  const r = await fetch(`${API_URL}/api/openai/proxy`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${API_KEY}` }, body: JSON.stringify({ method, endpoint, payload }) });
  return r.json();
}

async function main() {
  console.log("uploading reference...");
  const fid = await uploadFile(REF, "vision", "tapabocas-ref.png");
  console.log("ref file:", fid);

  const lines = [];
  for (const { n, pile } of PACKS) {
    for (const [vname, fn] of Object.entries(VARIANTS)) {
      const prompts = fn(n, pile);
      prompts.forEach((prompt, i) => {
        lines.push(JSON.stringify({
          custom_id: `p${n}-${vname}-${i + 1}`,
          method: "POST",
          url: "/v1/images/edits",
          body: { model: "gpt-image-2", prompt, images: [{ file_id: fid }], size: "1024x1024", quality: "medium", n: 1 },
        }));
      });
    }
  }
  await writeFile("/tmp/tapabocas-batch.jsonl", lines.join("\n") + "\n");
  console.log(`JSONL: ${lines.length} requests`);
  const jid = await uploadFile("/tmp/tapabocas-batch.jsonl", "batch", "tapabocas-batch.jsonl");
  console.log("jsonl file:", jid);
  const batch = await proxy("POST", "/batches", { input_file_id: jid, endpoint: "/v1/images/edits", completion_window: "24h" });
  console.log("BATCH:", batch.id, batch.status);
  await writeFile("/Users/ech/Documents/Dev/Projects/ECHML/generated-images/tapabocas/batch-info.json", JSON.stringify({ batchId: batch.id, refFile: fid, count: lines.length, createdAt: "2026-06-02" }, null, 2));
}
main().catch(e => { console.error(e); process.exit(1); });
