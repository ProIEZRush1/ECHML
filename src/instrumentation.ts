export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startAutoOffersScheduler } = await import("@/lib/ml/auto-offers-scheduler");
    startAutoOffersScheduler();
  }
}
