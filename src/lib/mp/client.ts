import { mlFetch, getMLCredentials } from "@/lib/ml/client";
import { prisma } from "@/lib/prisma";

interface MPBalanceResponse {
  available_balance: number;
  total_amount: number;
  unavailable_balance: number;
}

interface MPMovementDetail {
  label: string;
  description: string;
}

interface MPMovement {
  id: number;
  type: "credit" | "debit";
  date_created: string;
  amount: number;
  balance_change: number;
  status: string;
  detail: MPMovementDetail;
  reference_id: string | null;
}

interface MPMovementsResponse {
  results: MPMovement[];
  paging: { total: number; offset: number; limit: number };
}

export interface MPBalance {
  available: number;
  total: number;
  unavailable: number;
}

export interface MPMovementParsed {
  id: number;
  type: "credit" | "debit";
  dateCreated: string;
  amount: number;
  balanceChange: number;
  status: string;
  label: string;
  description: string;
  referenceId: string | null;
}

/**
 * Get MP account balance using the ML access token.
 */
export async function getMPBalance(): Promise<MPBalance> {
  const cred = await getMLCredentials();
  if (!cred) {
    throw new Error("No hay credenciales de MercadoLibre configuradas.");
  }

  const data = await mlFetch<MPBalanceResponse>(
    `/users/${cred.mlUserId}/mercadopago_account/balance`
  );

  return {
    available: data.available_balance,
    total: data.total_amount,
    unavailable: data.unavailable_balance,
  };
}

/**
 * Get MP movements with pagination.
 */
export async function getMPMovements(options?: {
  offset?: number;
  limit?: number;
  dateFrom?: string;
  dateTo?: string;
}): Promise<{ movements: MPMovementParsed[]; total: number }> {
  const params: Record<string, string> = {
    offset: String(options?.offset ?? 0),
    limit: String(options?.limit ?? 50),
  };

  if (options?.dateFrom) {
    params.begin_date = options.dateFrom;
  }
  if (options?.dateTo) {
    params.end_date = options.dateTo;
  }

  const data = await mlFetch<MPMovementsResponse>(
    "/mercadopago_account/movements/search",
    { params }
  );

  const movements: MPMovementParsed[] = data.results.map((m) => ({
    id: m.id,
    type: m.type,
    dateCreated: m.date_created,
    amount: m.amount,
    balanceChange: m.balance_change,
    status: m.status,
    label: m.detail?.label || "other",
    description: m.detail?.description || "",
    referenceId: m.reference_id || null,
  }));

  return { movements, total: data.paging.total };
}

/**
 * Sync movements from MP API into the MPTransaction database table.
 * Fetches all movements (paginated) and upserts by mpId.
 */
export async function syncMPTransactions(): Promise<{
  synced: number;
  total: number;
}> {
  let offset = 0;
  const limit = 50;
  let total = Infinity;
  let synced = 0;

  while (offset < total) {
    const data = await getMPMovements({ offset, limit });
    total = data.total;

    for (const movement of data.movements) {
      // Try to link to an ML order if it's a sale
      let mlOrderId: bigint | null = null;
      let packId: string | null = null;

      if (movement.label === "sale" && movement.referenceId) {
        const order = await prisma.mLOrder.findUnique({
          where: { mlOrderId: BigInt(movement.referenceId) },
          select: { mlOrderId: true, mlItemId: true },
        });

        if (order) {
          mlOrderId = order.mlOrderId;

          // Try to find the pack via MLListing
          const listing = await prisma.mLListing.findUnique({
            where: { mlItemId: order.mlItemId },
            select: { packId: true },
          });

          if (listing) {
            packId = listing.packId;
          }
        }
      }

      await prisma.mPTransaction.upsert({
        where: { mpId: BigInt(movement.id) },
        create: {
          mpId: BigInt(movement.id),
          type: movement.type,
          amount: movement.amount,
          balanceChange: movement.balanceChange,
          status: movement.status,
          label: movement.label,
          description: movement.description || null,
          referenceId: movement.referenceId,
          mlOrderId,
          packId,
          dateCreated: new Date(movement.dateCreated),
        },
        update: {
          type: movement.type,
          amount: movement.amount,
          balanceChange: movement.balanceChange,
          status: movement.status,
          label: movement.label,
          description: movement.description || null,
          referenceId: movement.referenceId,
          mlOrderId,
          packId,
          syncedAt: new Date(),
        },
      });

      synced++;
    }

    offset += limit;
  }

  return { synced, total };
}
