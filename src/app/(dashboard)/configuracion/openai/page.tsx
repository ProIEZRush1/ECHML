export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { OpenAIConfigForm } from "./openai-config-form";

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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            Estado de Conexion
            {isConfigured ? (
              <Badge className="bg-green-100 text-green-800">Configurado</Badge>
            ) : (
              <Badge variant="destructive">No configurado</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <OpenAIConfigForm isConfigured={isConfigured} maskedKey={maskedKey} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Capacidades Disponibles</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border p-4 space-y-1">
              <p className="font-medium text-sm">Generacion de Imagenes</p>
              <p className="text-xs text-muted-foreground">
                Genera imagenes de productos con GPT Image (DALL-E). Ideal para fotos de producto, fondos y marketing.
              </p>
            </div>
            <div className="rounded-lg border p-4 space-y-1">
              <p className="font-medium text-sm">Edicion de Imagenes</p>
              <p className="text-xs text-muted-foreground">
                Edita y mejora fotos de productos: quitar fondos, agregar contexto, inpainting.
              </p>
            </div>
            <div className="rounded-lg border p-4 space-y-1">
              <p className="font-medium text-sm">Analisis de Imagenes</p>
              <p className="text-xs text-muted-foreground">
                Analiza calidad de fotos, genera descripciones automaticas, detecta categorias con GPT-4o Vision.
              </p>
            </div>
            <div className="rounded-lg border p-4 space-y-1">
              <p className="font-medium text-sm">Chat / Descripciones</p>
              <p className="text-xs text-muted-foreground">
                Genera titulos y descripciones optimizadas para publicaciones de MercadoLibre.
              </p>
            </div>
            <div className="rounded-lg border p-4 space-y-1">
              <p className="font-medium text-sm">Batch API</p>
              <p className="text-xs text-muted-foreground">
                Procesa multiples imagenes o textos en lote con 50% de descuento. Ideal para operaciones masivas.
              </p>
            </div>
            <div className="rounded-lg border p-4 space-y-1">
              <p className="font-medium text-sm">Generacion de Video</p>
              <p className="text-xs text-muted-foreground">
                Genera videos de producto con Sora. Disponible hasta Sept 2026.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
