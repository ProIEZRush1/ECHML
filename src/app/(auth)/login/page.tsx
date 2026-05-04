"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
    <div className="mx-auto max-w-sm rounded-2xl border border-white/10 bg-white/5 p-8 shadow-2xl shadow-black/20 backdrop-blur-xl">
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="email" className="text-sm font-medium text-white/80">
          Correo electronico
        </Label>
        <Input
          id="email"
          type="email"
          placeholder="tu@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          className="border-white/10 bg-white/5 text-white placeholder:text-white/30 focus-visible:border-teal-400/50 focus-visible:ring-teal-400/20"
        />
      </div>
      <div className="space-y-2">
        <Label
          htmlFor="password"
          className="text-sm font-medium text-white/80"
        >
          Contrasena
        </Label>
        <Input
          id="password"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
          className="border-white/10 bg-white/5 text-white placeholder:text-white/30 focus-visible:border-teal-400/50 focus-visible:ring-teal-400/20"
        />
      </div>
      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2">
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}
      <Button
        type="submit"
        className="w-full bg-gradient-to-r from-teal-500 to-blue-500 font-medium text-white shadow-lg shadow-teal-500/20 transition-all hover:from-teal-400 hover:to-blue-400 hover:shadow-teal-500/30"
        disabled={loading}
      >
        {loading ? "Ingresando..." : "Iniciar Sesion"}
      </Button>
    </form>
    </div>
  );
}
