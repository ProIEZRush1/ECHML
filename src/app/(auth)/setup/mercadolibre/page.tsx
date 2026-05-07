"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ExternalLink, Loader2, Store } from "lucide-react";

type Step = "welcome" | "instructions" | "credentials";
const STEPS: Step[] = ["welcome", "instructions", "credentials"];

export default function MLSetupPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("welcome");
  const [appId, setAppId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const stepIdx = STEPS.indexOf(step);

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
    <div className="auth-screen">
      <div className="auth-card" style={{ maxWidth: 520 }}>
        {/* Wizard progress */}
        <div className="wizard-steps">
          {STEPS.map((s, i) => (
            <div key={s} className="contents">
              <div
                className={`wizard-step ${
                  stepIdx > i ? "done" : stepIdx === i ? "on" : ""
                }`}
              >
                {stepIdx > i ? (
                  <CheckCircle2 className="size-3.5" />
                ) : (
                  i + 1
                )}
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={`wizard-line ${stepIdx > i ? "done" : ""}`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step: Welcome */}
        {step === "welcome" && (
          <>
            <div className="auth-logo">
              <Store className="size-6" />
            </div>

            <h2 className="mb-1 text-center text-[18px] font-semibold text-white">
              Conecta tu cuenta de MercadoLibre
            </h2>
            <p className="mb-5 text-center text-[12.5px] text-white/55">
              Para usar ECH necesitas vincular tu cuenta de vendedor de
              MercadoLibre. Esto permite sincronizar tus publicaciones, stock y
              ventas automaticamente.
            </p>

            <div className="mb-5 space-y-3 rounded-lg border border-white/8 bg-white/[0.03] p-4">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 text-green-400">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                </span>
                <div>
                  <p className="text-[12.5px] font-medium text-white/80">
                    Conexion segura
                  </p>
                  <p className="text-[11.5px] text-white/45">
                    Tus credenciales se almacenan de forma cifrada y nunca se
                    comparten con terceros.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="mt-0.5 text-blue-400">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
                </span>
                <div>
                  <p className="text-[12.5px] font-medium text-white/80">
                    Necesitaras
                  </p>
                  <p className="text-[11.5px] text-white/45">
                    Tu App ID y Client Secret de la seccion de desarrolladores
                    de MercadoLibre.
                  </p>
                </div>
              </div>
            </div>

            <button
              className="auth-btn"
              onClick={() => setStep("instructions")}
            >
              Comenzar configuracion
            </button>
          </>
        )}

        {/* Step: Instructions */}
        {step === "instructions" && (
          <>
            <h2 className="mb-1 text-center text-[18px] font-semibold text-white">
              Como obtener tus credenciales
            </h2>
            <p className="mb-5 text-center text-[12.5px] text-white/55">
              Sigue estos pasos en el portal de desarrolladores de MercadoLibre
            </p>

            <ol className="mb-5 space-y-4 text-[12.5px]">
              <li className="flex gap-3">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-white/10 font-mono text-[10px] font-semibold text-white/60">
                  1
                </span>
                <div>
                  <p className="font-medium text-white/80">
                    Ingresa al portal de desarrolladores
                  </p>
                  <p className="text-white/45">
                    Ve a{" "}
                    <a
                      href="https://developers.mercadolibre.com.mx/devcenter"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-blue-400 underline"
                    >
                      developers.mercadolibre.com.mx
                      <ExternalLink className="size-3" />
                    </a>{" "}
                    e inicia sesion con tu cuenta de vendedor.
                  </p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-white/10 font-mono text-[10px] font-semibold text-white/60">
                  2
                </span>
                <div>
                  <p className="font-medium text-white/80">
                    Crea una nueva aplicacion
                  </p>
                  <p className="text-white/45">
                    Haz clic en &quot;Crear nueva aplicacion&quot;. Usa cualquier
                    nombre (ej: &quot;ECH CRM&quot;) y como Redirect URI pon:{" "}
                    <code className="rounded bg-white/5 px-1.5 py-0.5 text-[11px] text-white/70">
                      https://echml.overcloud.us/api/ml/auth/callback
                    </code>
                  </p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-white/10 font-mono text-[10px] font-semibold text-white/60">
                  3
                </span>
                <div>
                  <p className="font-medium text-white/80">
                    Copia las credenciales
                  </p>
                  <p className="text-white/45">
                    Una vez creada la app, copia el{" "}
                    <strong className="text-white/70">App ID</strong> (numero) y
                    el{" "}
                    <strong className="text-white/70">Client Secret</strong>{" "}
                    (cadena larga).
                  </p>
                </div>
              </li>
            </ol>

            <div className="flex gap-3">
              <button
                className="rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-[13px] font-medium text-white/70 transition-colors hover:bg-white/10"
                onClick={() => setStep("welcome")}
              >
                Atras
              </button>
              <button
                className="auth-btn flex-1"
                onClick={() => setStep("credentials")}
              >
                Ya tengo mis credenciales
              </button>
            </div>
          </>
        )}

        {/* Step: Credentials form */}
        {step === "credentials" && (
          <>
            <h2 className="mb-1 text-center text-[18px] font-semibold text-white">
              Ingresa tus credenciales
            </h2>
            <p className="mb-5 text-center text-[12.5px] text-white/55">
              Estas se usan para autenticar las solicitudes a la API de
              MercadoLibre
            </p>

            <form onSubmit={handleSubmit}>
              <div className="auth-field">
                <label htmlFor="appId">App ID</label>
                <input
                  id="appId"
                  type="text"
                  placeholder="123456789"
                  value={appId}
                  onChange={(e) => setAppId(e.target.value)}
                  required
                />
                <span className="text-[10.5px] text-white/35">
                  Numero que identifica tu aplicacion en ML
                </span>
              </div>

              <div className="auth-field">
                <label htmlFor="clientSecret">Client Secret</label>
                <input
                  id="clientSecret"
                  type="password"
                  placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  required
                />
                <span className="text-[10.5px] text-white/35">
                  Clave secreta de tu aplicacion (no la compartas)
                </span>
              </div>

              {error && (
                <div className="mb-3 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2">
                  <p className="text-sm text-red-300">{error}</p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  className="rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-[13px] font-medium text-white/70 transition-colors hover:bg-white/10"
                  onClick={() => setStep("instructions")}
                >
                  Atras
                </button>
                <button
                  type="submit"
                  className="auth-btn flex-1"
                  disabled={loading || !appId || !clientSecret}
                >
                  {loading ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="size-4 animate-spin" />
                      Conectando...
                    </span>
                  ) : (
                    "Conectar"
                  )}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
