"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  ExternalLink,
  KeyRound,
  Loader2,
  ShieldCheck,
  Store,
} from "lucide-react";

type Step = "welcome" | "instructions" | "credentials";

export default function MLSetupPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("welcome");
  const [appId, setAppId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/ml/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appId, clientSecret }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Error al guardar las credenciales");
        return;
      }

      if (data.authUrl) {
        window.location.href = data.authUrl;
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Error de conexion. Intente de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Progress indicator */}
      <div className="flex items-center justify-center gap-2">
        {(["welcome", "instructions", "credentials"] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`flex size-8 items-center justify-center rounded-full text-sm font-medium transition-colors ${
                step === s
                  ? "bg-primary text-primary-foreground"
                  : (["welcome", "instructions", "credentials"].indexOf(step) > i)
                    ? "bg-green-100 text-green-700"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {["welcome", "instructions", "credentials"].indexOf(step) > i ? (
                <CheckCircle2 className="size-4" />
              ) : (
                i + 1
              )}
            </div>
            {i < 2 && (
              <div
                className={`h-0.5 w-8 transition-colors ${
                  ["welcome", "instructions", "credentials"].indexOf(step) > i
                    ? "bg-green-300"
                    : "bg-muted"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step: Welcome */}
      {step === "welcome" && (
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-amber-100">
              <Store className="size-8 text-amber-700" />
            </div>
            <CardTitle className="text-xl">
              Conecta tu cuenta de MercadoLibre
            </CardTitle>
            <CardDescription className="text-base">
              Para usar ECH necesitas vincular tu cuenta de vendedor de
              MercadoLibre. Esto permite sincronizar tus publicaciones,
              stock y ventas automaticamente.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 size-5 text-green-600 shrink-0" />
                <div>
                  <p className="text-sm font-medium">Conexion segura</p>
                  <p className="text-sm text-muted-foreground">
                    Tus credenciales se almacenan de forma cifrada y nunca se
                    comparten con terceros.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <KeyRound className="mt-0.5 size-5 text-blue-600 shrink-0" />
                <div>
                  <p className="text-sm font-medium">Necesitaras</p>
                  <p className="text-sm text-muted-foreground">
                    Tu App ID y Client Secret de la seccion de desarrolladores
                    de MercadoLibre.
                  </p>
                </div>
              </div>
            </div>
            <Button
              className="w-full"
              size="lg"
              onClick={() => setStep("instructions")}
            >
              Comenzar configuracion
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step: Instructions */}
      {step === "instructions" && (
        <Card>
          <CardHeader>
            <CardTitle>Como obtener tus credenciales</CardTitle>
            <CardDescription>
              Sigue estos pasos en el portal de desarrolladores de MercadoLibre
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ol className="space-y-4 text-sm">
              <li className="flex gap-3">
                <Badge variant="outline" className="size-6 shrink-0 items-center justify-center rounded-full">
                  1
                </Badge>
                <div>
                  <p className="font-medium">Ingresa al portal de desarrolladores</p>
                  <p className="text-muted-foreground">
                    Ve a{" "}
                    <a
                      href="https://developers.mercadolibre.com.mx/devcenter"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline inline-flex items-center gap-1"
                    >
                      developers.mercadolibre.com.mx
                      <ExternalLink className="size-3" />
                    </a>{" "}
                    e inicia sesion con tu cuenta de vendedor.
                  </p>
                </div>
              </li>
              <li className="flex gap-3">
                <Badge variant="outline" className="size-6 shrink-0 items-center justify-center rounded-full">
                  2
                </Badge>
                <div>
                  <p className="font-medium">Crea una nueva aplicacion</p>
                  <p className="text-muted-foreground">
                    Haz clic en &quot;Crear nueva aplicacion&quot;. Usa cualquier nombre
                    (ej: &quot;ECH CRM&quot;) y como Redirect URI pon:{" "}
                    <code className="rounded bg-muted px-1.5 py-0.5">
                      https://echml.overcloud.us/api/ml/auth/callback
                    </code>
                  </p>
                </div>
              </li>
              <li className="flex gap-3">
                <Badge variant="outline" className="size-6 shrink-0 items-center justify-center rounded-full">
                  3
                </Badge>
                <div>
                  <p className="font-medium">Copia las credenciales</p>
                  <p className="text-muted-foreground">
                    Una vez creada la app, copia el <strong>App ID</strong> (numero) y
                    el <strong>Client Secret</strong> (cadena larga).
                  </p>
                </div>
              </li>
            </ol>

            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setStep("welcome")}
              >
                Atras
              </Button>
              <Button
                className="flex-1"
                onClick={() => setStep("credentials")}
              >
                Ya tengo mis credenciales
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step: Credentials form */}
      {step === "credentials" && (
        <Card>
          <CardHeader>
            <CardTitle>Ingresa tus credenciales</CardTitle>
            <CardDescription>
              Estas se usan para autenticar las solicitudes a la API de
              MercadoLibre
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="appId">App ID</Label>
                <Input
                  id="appId"
                  type="text"
                  placeholder="123456789"
                  value={appId}
                  onChange={(e) => setAppId(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Numero que identifica tu aplicacion en ML
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="clientSecret">Client Secret</Label>
                <Input
                  id="clientSecret"
                  type="password"
                  placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Clave secreta de tu aplicacion (no la compartas)
                </p>
              </div>

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep("instructions")}
                >
                  Atras
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={loading || !appId || !clientSecret}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      Conectando...
                    </>
                  ) : (
                    "Conectar"
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
