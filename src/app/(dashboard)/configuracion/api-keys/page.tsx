export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { ApiKeysTable } from "./api-keys-table";
import { CreateApiKeyButton } from "./create-api-key-button";
import { KeyRound } from "lucide-react";

export default async function ApiKeysPage() {
  const session = await verifySession();
  if (!session) redirect("/login");

  const apiKeys = await prisma.apiKey.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      key: true,
      isActive: true,
      lastUsedAt: true,
      createdAt: true,
    },
  });

  const maskedKeys = apiKeys.map((k) => ({
    ...k,
    key: "ech_****" + k.key.slice(-8),
    lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
    createdAt: k.createdAt.toISOString(),
  }));

  const activeCount = apiKeys.filter((k) => k.isActive).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="API Keys"
        description="Administra las claves de acceso para la API del CRM"
      >
        <CreateApiKeyButton />
      </PageHeader>

      {/* Stats bar */}
      <div className="flex items-center gap-4 text-[12.5px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <KeyRound className="size-3.5" />
          {apiKeys.length} clave{apiKeys.length !== 1 ? "s" : ""} total
        </span>
        <span className="text-border">|</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block size-1.5 rounded-full bg-green-500" />
          {activeCount} activa{activeCount !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Keys table */}
      <div className="rounded-[9px] border border-border bg-card overflow-hidden">
        <ApiKeysTable apiKeys={maskedKeys} />
      </div>
    </div>
  );
}
