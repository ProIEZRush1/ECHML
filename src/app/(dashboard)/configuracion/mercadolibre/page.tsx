export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { formatDateTime } from "@/lib/utils";
import { DisconnectButton } from "./disconnect-button";
import {
  CircleCheck,
  CircleX,
  KeyRound,
  Clock,
  Shield,
  User,
  RefreshCw,
  Webhook,
  ExternalLink,
} from "lucide-react";

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

      {/* Connection status card */}
      <div className="conn-card">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-[9px] bg-accent/15">
              <ExternalLink className="size-5 text-accent" />
            </div>
            <div>
              <h2 className="text-[15px] font-semibold tracking-[-0.01em]">Estado de Conexion</h2>
              <p className="text-[11.5px] text-muted-foreground">MercadoLibre API</p>
            </div>
          </div>
          {credential && hasValidToken ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 dark:bg-green-900/30 px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.04em] text-green-700 dark:text-green-400">
              <span className="pulse-dot" />
              Activa
            </span>
          ) : credential ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 dark:bg-amber-900/30 px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.04em] text-amber-700 dark:text-amber-400">
              Requiere auth
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 dark:bg-red-900/30 px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.04em] text-red-700 dark:text-red-400">
              <CircleX className="size-3" />
              No configurado
            </span>
          )}
        </div>

        {credential ? (
          <>
            {/* Info grid */}
            <div className="grid gap-px rounded-[9px] border border-border bg-border overflow-hidden sm:grid-cols-3">
              <div className="bg-card glass px-4 py-3 flex items-start gap-3">
                <KeyRound className="size-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10.5px] uppercase tracking-[0.05em] text-muted-foreground font-medium">App ID</p>
                  <p className="text-[13px] font-mono font-medium truncate">{maskedAppId}</p>
                </div>
              </div>
              <div className="bg-card glass px-4 py-3 flex items-start gap-3">
                <User className="size-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10.5px] uppercase tracking-[0.05em] text-muted-foreground font-medium">ML User ID</p>
                  <p className="text-[13px] font-mono font-medium truncate">
                    {credential.mlUserId.toString() === "0"
                      ? "Pendiente (OAuth)"
                      : credential.mlUserId.toString()}
                  </p>
                </div>
              </div>
              <div className="bg-card glass px-4 py-3 flex items-start gap-3">
                {hasValidToken ? (
                  <CircleCheck className="size-4 text-green-600 mt-0.5 shrink-0" />
                ) : (
                  <CircleX className="size-4 text-red-500 mt-0.5 shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-[10.5px] uppercase tracking-[0.05em] text-muted-foreground font-medium">Token</p>
                  <p className="text-[13px] font-medium">
                    {hasValidToken ? (
                      <span className="text-green-700 dark:text-green-400">Valido</span>
                    ) : (
                      <span className="text-red-600 dark:text-red-400">Sin token activo</span>
                    )}
                  </p>
                </div>
              </div>
              <div className="bg-card glass px-4 py-3 flex items-start gap-3">
                <Clock className="size-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10.5px] uppercase tracking-[0.05em] text-muted-foreground font-medium">Token Expira</p>
                  <p className="text-[13px] font-medium truncate">
                    {credential.tokenExpiresAt.getTime() === 0
                      ? "N/A"
                      : formatDateTime(credential.tokenExpiresAt)}
                  </p>
                </div>
              </div>
              <div className="bg-card glass px-4 py-3 flex items-start gap-3">
                <Shield className="size-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10.5px] uppercase tracking-[0.05em] text-muted-foreground font-medium">Scope</p>
                  <p className="text-[13px] font-medium truncate">{credential.scope}</p>
                </div>
              </div>
              <div className="bg-card glass px-4 py-3 flex items-start gap-3">
                <RefreshCw className="size-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10.5px] uppercase tracking-[0.05em] text-muted-foreground font-medium">Ultima Actualizacion</p>
                  <p className="text-[13px] font-medium truncate">{formatDateTime(credential.updatedAt)}</p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 mt-5">
              {!hasValidToken && (
                <a
                  href="/api/ml/auth"
                  className="inline-flex h-9 items-center justify-center rounded-[7px] bg-accent px-4 text-[13px] font-medium text-accent-foreground transition-colors hover:bg-accent/90"
                >
                  Autorizar con MercadoLibre
                </a>
              )}
              <DisconnectButton />
            </div>
          </>
        ) : (
          <div className="space-y-4">
            <p className="text-[13px] text-muted-foreground">
              No se ha configurado la conexion con MercadoLibre. Conecta tu
              cuenta para sincronizar publicaciones y stock.
            </p>
            <a
              href="/setup/mercadolibre"
              className="inline-flex h-9 items-center justify-center rounded-[7px] bg-accent px-4 text-[13px] font-medium text-accent-foreground transition-colors hover:bg-accent/90"
            >
              Conectar con MercadoLibre
            </a>
          </div>
        )}
      </div>

      {/* Webhook card */}
      <div className="rounded-[9px] border border-border bg-card glass overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center gap-3">
          <Webhook className="size-4 text-muted-foreground" />
          <h2 className="text-[14px] font-semibold">Webhook</h2>
        </div>
        <div className="px-5 py-4 space-y-2">
          <p className="text-[12.5px] text-muted-foreground">
            Configura esta URL en tu aplicacion de MercadoLibre para recibir
            notificaciones:
          </p>
          <div className="rounded-[7px] border border-border bg-muted/50 px-4 py-3">
            <code className="text-[12.5px] mono">{webhookUrl}</code>
          </div>
        </div>
      </div>
    </div>
  );
}
