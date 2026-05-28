import { NextRequest, NextResponse } from "next/server";
import { mlFetch, getMLCredentials } from "@/lib/ml/client";

export const maxDuration = 300;

const PLAYERA_DOMAINS = ["MLM-T_SHIRTS"];

// Targeted replacements to make the fabric claim truthful.
// Buyers complained the shirts are thin/see-through, not the advertised
// "premium pesado 220gsm". Real fabric is lightweight cotton ~150-180gsm.
// Order matters: most specific first.
const REPLACEMENTS: [RegExp, string][] = [
  [/100% Algod[oó]n premium pesado 220\s*gsm/gi, "100% Algodón ligero 150-180 gsm"],
  [/Algod[oó]n premium pesado 220\s*gsm/gi, "Algodón ligero 150-180 gsm"],
  [/de algod[oó]n premium de alta calidad/gi, "de algodón ligero, frescas y cómodas"],
  [/PLAYERAS OVERSIZE PREMIUM/g, "PLAYERAS OVERSIZE"],
  [/Tela: Suave, transpirable, resistente al encogimiento/gi, "Tela: Ligera, fresca y transpirable, ideal para clima cálido"],
  [/playera premium mexico/gi, "playera ligera mexico"],
  [/playera premium calidad/gi, "playera ligera calidad"],
  // Catch-alls for any remaining stragglers
  [/220\s*gsm/gi, "150-180 gsm"],
  [/algod[oó]n premium pesado/gi, "algodón ligero"],
  [/premium pesado/gi, "ligero"],
];

function transform(text: string): string {
  let out = text;
  for (const [pattern, replacement] of REPLACEMENTS) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

export async function POST(request: NextRequest) {
  const log: string[] = [];
  const url = new URL(request.url);
  const dryRun = url.searchParams.get("dryRun") === "true";
  const limitParam = url.searchParams.get("limit");
  const limit = limitParam ? parseInt(limitParam, 10) : null;

  try {
    const creds = await getMLCredentials();
    if (!creds) return NextResponse.json({ success: false, error: "No ML credentials", log }, { status: 500 });
    const sellerId = creds.mlUserId.toString();

    // 1. Get all active listings
    const allItems: string[] = [];
    let offset = 0;
    while (true) {
      const page = await mlFetch<{ results: string[]; paging: { total: number } }>(
        `/users/${sellerId}/items/search?status=active&limit=100&offset=${offset}`
      );
      allItems.push(...page.results);
      if (offset + 100 >= page.paging.total) break;
      offset += 100;
    }
    log.push(`Total active listings: ${allItems.length}`);

    // 2. Filter to playeras by domain
    const playeraIds: string[] = [];
    for (let i = 0; i < allItems.length; i += 20) {
      const batch = allItems.slice(i, i + 20);
      const items = await mlFetch<{ code: number; body: { id: string; domain_id: string } }[]>(
        `/items?ids=${batch.join(",")}&attributes=id,domain_id`
      );
      for (const item of items) {
        if (item.code === 200 && PLAYERA_DOMAINS.includes(item.body.domain_id)) {
          playeraIds.push(item.body.id);
        }
      }
    }
    log.push(`Playera listings found: ${playeraIds.length}`);

    const targets = limit ? playeraIds.slice(0, limit) : playeraIds;

    let updated = 0;
    let skippedNoDesc = 0;
    let skippedNoChange = 0;
    let errors = 0;
    const samples: { id: string; before: string; after: string }[] = [];

    for (let i = 0; i < targets.length; i += 3) {
      const batch = targets.slice(i, i + 3);
      await Promise.all(batch.map(async (id) => {
        try {
          let current: { plain_text?: string };
          try {
            current = await mlFetch<{ plain_text?: string }>(`/items/${id}/description`);
          } catch {
            skippedNoDesc++;
            return;
          }
          const before = current.plain_text || "";
          if (!before.trim()) { skippedNoDesc++; return; }

          const after = transform(before);
          if (after === before) { skippedNoChange++; return; }

          if (samples.length < 3) samples.push({ id, before, after });

          if (!dryRun) {
            await mlFetch(`/items/${id}/description`, {
              method: "PUT",
              body: JSON.stringify({ plain_text: after }),
            });
          }
          updated++;
          log.push(`${dryRun ? "WOULD UPDATE" : "OK"} ${id}`);
        } catch (err) {
          errors++;
          log.push(`ERR ${id}: ${String(err).substring(0, 120)}`);
        }
      }));
    }

    log.push(`Done: ${updated} ${dryRun ? "would be updated" : "updated"}, ${skippedNoDesc} no description, ${skippedNoChange} no change needed, ${errors} errors`);
    return NextResponse.json({ success: true, dryRun, updated, skippedNoDesc, skippedNoChange, errors, samples, log });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error), log }, { status: 500 });
  }
}
