export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { OpenAIConfigForm } from "./openai-config-form";
import {
  Sparkles,
  ImagePlus,
  Pencil,
  ScanEye,
  MessageSquareText,
  Layers,
  Video,
} from "lucide-react";

const CAPABILITIES = [
  {
    icon: ImagePlus,
    title: "Generacion de Imagenes",
    description:
      "Genera imagenes de productos con GPT Image (DALL-E). Ideal para fotos de producto, fondos y marketing.",
  },
  {
    icon: Pencil,
    title: "Edicion de Imagenes",
    description:
      "Edita y mejora fotos de productos: quitar fondos, agregar contexto, inpainting.",
  },
  {
    icon: ScanEye,
    title: "Analisis de Imagenes",
    description:
      "Analiza calidad de fotos, genera descripciones automaticas, detecta categorias con GPT-4o Vision.",
  },
  {
    icon: MessageSquareText,
    title: "Chat / Descripciones",
    description:
      "Genera titulos y descripciones optimizadas para publicaciones de MercadoLibre.",
  },
  {
    icon: Layers,
    title: "Batch API",
    description:
      "Procesa multiples imagenes o textos en lote con 50% de descuento. Ideal para operaciones masivas.",
  },
  {
    icon: Video,
    title: "Generacion de Video",
    description:
      "Genera videos de producto con Sora. Disponible hasta Sept 2026.",
  },
] as const;

export default async function OpenAIConfigPage() {
  const session = await verifySession();
  if (!session) redirect("/login");

  const config = await prisma.systemConfig.findUnique({
    where: { key: "openai_api_key" },
  });

  const isConfigured = !!config?.value;
  const maskedKey = config?.value
    ? "sk-****" + config.value.slice(-4)
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Configuracion OpenAI"
        description="Administra tu API key de OpenAI para generacion de imagenes, videos y analisis"
      />

      {/* Connection card */}
      <div className="conn-card">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-[9px] bg-accent/15">
              <Sparkles className="size-5 text-accent" />
            </div>
            <div>
              <h2 className="text-[15px] font-semibold tracking-[-0.01em]">OpenAI API</h2>
              <p className="text-[11.5px] text-muted-foreground">Clave de acceso</p>
            </div>
          </div>
          {isConfigured ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 dark:bg-green-900/30 px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.04em] text-green-700 dark:text-green-400">
              <span className="pulse-dot" />
              Conectado
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 dark:bg-red-900/30 px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.04em] text-red-700 dark:text-red-400">
              No configurado
            </span>
          )}
        </div>

        <OpenAIConfigForm isConfigured={isConfigured} maskedKey={maskedKey} />
      </div>

      {/* Capabilities */}
      <div className="rounded-[9px] border border-border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-[14px] font-semibold">Capacidades Disponibles</h2>
        </div>
        <div className="p-4">
          <div className="cap-grid">
            {CAPABILITIES.map((cap) => (
              <div key={cap.title} className="cap-tile">
                <div className="flex items-center gap-2.5">
                  <cap.icon className="size-4 text-accent shrink-0" />
                  <p className="text-[13px] font-medium">{cap.title}</p>
                </div>
                <p className="text-[11.5px] text-muted-foreground leading-[1.5]">
                  {cap.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
