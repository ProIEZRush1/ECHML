import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";
import { DisconnectButton } from "./disconnect-button";

export default async function MLConfigPage() {
  const credential = await prisma.mLCredential.findFirst();

  const webhookUrl = process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL}/api/ml/webhook`
    : "/api/ml/webhook";

  const hasValidToken =
    credential &&
    credential.accessToken !== "" &&
    credential.tokenExpiresAt > new Date();

  // Mask app ID
  const maskedAppId = credential
    ? credential.appId.length > 4
      ? "****" + credential.appId.slice(-4)
      : credential.appId
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Configuracion MercadoLibre"
        description="Estado de la conexion con MercadoLibre"
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            Estado de Conexion
            {credential ? (
              <Badge className="bg-green-100 text-green-800">Conectado</Badge>
            ) : (
              <Badge variant="destructive">No conectado</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {credential ? (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">App ID</p>
                  <p className="font-mono">{maskedAppId}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">ML User ID</p>
                  <p className="font-mono">
                    {credential.mlUserId.toString() === "0"
                      ? "Pendiente (OAuth requerido)"
                      : credential.mlUserId.toString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Token</p>
                  <p className="text-sm">
                    {hasValidToken ? (
                      <Badge className="bg-green-100 text-green-800">Valido</Badge>
                    ) : (
                      <Badge variant="secondary">Sin token activo</Badge>
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Scope</p>
                  <p className="text-sm">{credential.scope}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Token Expira</p>
                  <p className="text-sm">
                    {credential.tokenExpiresAt.getTime() === 0
                      ? "N/A"
                      : formatDateTime(credential.tokenExpiresAt)}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Ultima Actualizacion</p>
                  <p className="text-sm">{formatDateTime(credential.updatedAt)}</p>
                </div>
              </div>

              <div className="border-t pt-4">
                <DisconnectButton />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                No se ha configurado la conexion con MercadoLibre. Conecta tu
                cuenta para sincronizar publicaciones y stock.
              </p>
              <a
                href="/setup/mercadolibre"
                className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground ring-offset-background transition-colors hover:bg-primary/90"
              >
                Conectar con MercadoLibre
              </a>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Webhook</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Configura esta URL en tu aplicacion de MercadoLibre para recibir
            notificaciones:
          </p>
          <div className="rounded-md border bg-muted/50 px-4 py-3">
            <code className="text-sm">{webhookUrl}</code>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
