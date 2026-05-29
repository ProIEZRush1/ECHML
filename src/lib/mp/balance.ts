import { prisma } from "@/lib/prisma";
import { mlFetch, getMLCredentials } from "@/lib/ml/client";

export interface RealMpBalance {
  disponible: number;
  futuro: number; // "a liberar" / pending release
  total: number;
  source: "api" | "manual" | "none";
  asOf: string | null;
  note?: string;
}

const MANUAL_KEY = "mp_balance_manual";

/**
 * Real Mercado Pago wallet balance.
 * 1) Tries the MP wallet endpoint via the ML token. Requires the MP read scope —
 *    currently 403 until the app is re-authorized; falls through gracefully.
 * 2) Falls back to a manually-entered balance stored in SystemConfig.
 */
export async function getRealMpBalance(): Promise<RealMpBalance> {
  try {
    const cred = await getMLCredentials();
    if (cred) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = await mlFetch<any>(`/users/${cred.mlUserId}/mercadopago_account/balance`);
      const disponible = Number(data?.available_balance ?? data?.available ?? 0);
      const total = Number(data?.total_balance ?? data?.total ?? disponible);
      const futuro = Number(data?.unavailable_balance ?? data?.pending ?? Math.max(0, total - disponible));
      if (!Number.isNaN(disponible) && (disponible !== 0 || total !== 0)) {
        return { disponible, futuro, total: total || disponible + futuro, source: "api", asOf: new Date().toISOString() };
      }
    }
  } catch (err) {
    // No MP scope yet (403) or transient failure → manual fallback. Log for troubleshooting.
    console.debug("MP balance API unavailable, using manual fallback:", err instanceof Error ? err.message : err);
  }

  const cfg = await prisma.systemConfig.findUnique({ where: { key: MANUAL_KEY } });
  if (cfg) {
    try {
      const m = JSON.parse(cfg.value) as { disponible?: number; futuro?: number; asOf?: string; note?: string };
      const disponible = Number(m.disponible || 0);
      const futuro = Number(m.futuro || 0);
      if (Number.isNaN(disponible) || Number.isNaN(futuro)) {
        return { disponible: 0, futuro: 0, total: 0, source: "none", asOf: null };
      }
      return { disponible, futuro, total: disponible + futuro, source: "manual", asOf: m.asOf ?? null, note: m.note };
    } catch {
      /* corrupt config → none */
    }
  }

  return { disponible: 0, futuro: 0, total: 0, source: "none", asOf: null };
}

export async function setManualMpBalance(disponible: number, futuro: number, note?: string): Promise<void> {
  const value = JSON.stringify({ disponible, futuro, asOf: new Date().toISOString(), note: note || "" });
  await prisma.systemConfig.upsert({
    where: { key: MANUAL_KEY },
    update: { value },
    create: { key: MANUAL_KEY, value },
  });
}
