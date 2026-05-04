export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiKeysTable } from "./api-keys-table";
import { CreateApiKeyButton } from "./create-api-key-button";

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

  return (
    <div className="space-y-6">
      <PageHeader
        title="API Keys"
        description="Administra las claves de acceso para la API del CRM"
      >
        <CreateApiKeyButton />
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle>Claves Activas</CardTitle>
        </CardHeader>
        <CardContent>
          <ApiKeysTable apiKeys={maskedKeys} />
        </CardContent>
      </Card>
    </div>
  );
}
