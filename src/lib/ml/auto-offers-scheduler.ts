const CHECK_INTERVAL_MS = 12 * 60 * 60 * 1000; // every 12 hours
const OFFER_CREATION_DAY = 25;

let schedulerStarted = false;

async function runAutoOffers(forceCurrentMonth: boolean = false): Promise<void> {
  const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  try {
    const { prisma } = await import("@/lib/prisma");

    const apiKey = await prisma.apiKey.findFirst({
      where: { isActive: true },
      select: { key: true },
    });

    if (!apiKey) {
      console.log("[auto-offers] No active API key found, skipping");
      return;
    }

    const res = await fetch(`${baseUrl}/api/ml/auto-offers`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey.key}`,
      },
      body: JSON.stringify({ dryRun: false, forceCurrentMonth }),
    });

    if (!res.ok) {
      console.error("[auto-offers] Failed:", res.status, await res.text());
      return;
    }

    const data = await res.json();
    console.log(`[auto-offers] Done: ${data.created} created, ${data.skipped} skipped, ${data.errors} errors`);
  } catch (e) {
    console.error("[auto-offers] Error:", e);
  }
}

async function checkAndRun(): Promise<void> {
  const now = new Date();
  const day = now.getDate();

  try {
    const { prisma } = await import("@/lib/prisma");
    const lastRun = await prisma.systemConfig.findUnique({
      where: { key: "auto_offers_last_run" },
    });

    if (lastRun) {
      const config = JSON.parse(lastRun.value);
      if (!config.dryRun) {
        const lastRunDate = new Date(config.lastRun);
        const hoursSinceLastRun = (now.getTime() - lastRunDate.getTime()) / (1000 * 60 * 60);
        if (hoursSinceLastRun < 20) return;
      }
    }
  } catch {
    // continue
  }

  if (day === OFFER_CREATION_DAY) {
    console.log("[auto-offers] Day 25: creating next month offers...");
    await runAutoOffers(false);
  } else if (day >= 1 && day <= 3) {
    console.log("[auto-offers] Month start: ensuring current month offers exist...");
    await runAutoOffers(true);
  }
}

export function startAutoOffersScheduler(): void {
  if (schedulerStarted) return;
  schedulerStarted = true;

  console.log("[auto-offers] Scheduler started — runs on the 25th (next month) and 1st-3rd (current month catchup)");
  setInterval(checkAndRun, CHECK_INTERVAL_MS);
  setTimeout(checkAndRun, 60_000);
}
