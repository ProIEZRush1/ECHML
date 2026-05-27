export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAnyAuth } from "@/lib/api-auth";

const VARIANT_MAP: Record<string, Record<string, string>> = {
  negro: { s: "pv-play-negro-s", m: "pv-play-negro-m", l: "pv-play-negro-l", xl: "pv-play-negro-xl" },
  blanco: { s: "pv-play-blanco-s", m: "pv-play-blanco-m", l: "pv-play-blanco-l", xl: "pv-play-blanco-xl" },
  gris: { s: "pv-play-gris-s", m: "pv-play-gris-m", l: "pv-play-gris-l", xl: "pv-play-gris-xl" },
};

function parsePackName(name: string): { color: string; size: string; qty: number } | null {
  const n = name.toLowerCase().trim();
  if (!["playera", "oversize", "oversized"].some((kw) => n.includes(kw))) return null;

  let qty = 6;
  if (/\bpack\s*3\b/.test(n) || /^3\s/.test(n)) qty = 3;
  else if (/\bpack\s*4\b/.test(n) || /^4\s/.test(n)) qty = 4;

  let size = "m";
  if (n.endsWith("xl")) size = "xl";
  else if (n.endsWith(" l")) size = "l";
  else if (n.endsWith(" s")) size = "s";
  else if (n.endsWith(" m")) size = "m";

  let color = "negro";
  if (n.includes("multicolor") || n.includes("multi")) color = "multi";
  else if (n.includes("blanco")) color = "blanco";
  else if (n.includes("gris")) color = "gris";
  else if (n.includes("negro")) color = "negro";

  return { color, size, qty };
}

export async function POST(request: NextRequest) {
  const user = await verifyAnyAuth(request);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const allPacks = await prisma.pack.findMany({
    select: {
      id: true,
      name: true,
      items: { select: { id: true } },
    },
  });

  const orphans = allPacks.filter((p) => {
    const parsed = parsePackName(p.name);
    return parsed && p.items.length === 0;
  });

  let fixed = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const pack of orphans) {
    const parsed = parsePackName(pack.name);
    if (!parsed) { skipped++; continue; }

    try {
      if (parsed.color === "multi") {
        const perColor = Math.floor(parsed.qty / 3);
        await prisma.packItem.createMany({
          data: [
            { packId: pack.id, productVariantId: VARIANT_MAP.negro[parsed.size], quantity: perColor },
            { packId: pack.id, productVariantId: VARIANT_MAP.blanco[parsed.size], quantity: perColor },
            { packId: pack.id, productVariantId: VARIANT_MAP.gris[parsed.size], quantity: perColor },
          ],
          skipDuplicates: true,
        });
      } else {
        const variantId = VARIANT_MAP[parsed.color]?.[parsed.size];
        if (!variantId) { skipped++; continue; }
        await prisma.packItem.create({
          data: { packId: pack.id, productVariantId: variantId, quantity: parsed.qty },
        });
      }
      fixed++;
    } catch (e: unknown) {
      errors.push(`${pack.id}: ${e instanceof Error ? e.message : "unknown"}`);
    }
  }

  return NextResponse.json({ total: orphans.length, fixed, skipped, errors: errors.slice(0, 10) });
}
