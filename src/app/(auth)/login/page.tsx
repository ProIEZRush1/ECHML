"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Error al iniciar sesion");
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setError("Error de conexion. Intente de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-logo">e</div>

        <h1 className="text-center text-[22px] font-semibold tracking-[-0.02em] text-white">
          ECH
        </h1>
        <p className="mb-6 text-center text-[12.5px] text-white/55">
          Sistema de Gestion de Inventario
        </p>

        <form onSubmit={handleSubmit}>
          <div className="auth-field">
            <label htmlFor="email">Correo electronico</label>
            <input
              id="email"
              type="email"
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="auth-field">
            <label htmlFor="password">Contrasena</label>
            <input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div className="mb-3 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2">
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? "Ingresando..." : "Iniciar Sesion"}
          </button>
        </form>

        <p className="mt-6 text-center text-[11px] text-white/40">
          echml.overcloud.us
        </p>
      </div>
    </div>
  );
}
