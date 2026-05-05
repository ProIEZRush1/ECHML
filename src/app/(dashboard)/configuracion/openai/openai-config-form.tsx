"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Eye, EyeOff, Trash2 } from "lucide-react";

interface OpenAIConfigFormProps {
  isConfigured: boolean;
  maskedKey: string | null;
}

export function OpenAIConfigForm({ isConfigured, maskedKey }: OpenAIConfigFormProps) {
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [currentMasked, setCurrentMasked] = useState(maskedKey);
  const [configured, setConfigured] = useState(isConfigured);

  async function handleSave() {
    if (!apiKey.startsWith("sk-")) {
      toast.error("La API key debe comenzar con 'sk-'");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/openai/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al guardar");
      }

      const data = await res.json();
      setCurrentMasked(data.maskedKey);
      setConfigured(true);
      setApiKey("");
      toast.success("API key de OpenAI guardada correctamente");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Eliminar la API key de OpenAI?")) return;

    setDeleting(true);
    try {
      const res = await fetch("/api/openai/config", { method: "DELETE" });
      if (!res.ok) throw new Error("Error al eliminar");

      setCurrentMasked(null);
      setConfigured(false);
      toast.success("API key eliminada");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al eliminar");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      {configured && currentMasked && (
        <div className="flex items-center justify-between rounded-md border bg-muted/50 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-muted-foreground">API Key Actual</p>
            <code className="text-sm">{currentMasked}</code>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            disabled={deleting}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-1" />
            {deleting ? "Eliminando..." : "Eliminar"}
          </Button>
        </div>
      )}

      <div className="space-y-2">
        <label className="text-sm font-medium">
          {configured ? "Reemplazar API Key" : "API Key de OpenAI"}
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              type={showKey ? "text" : "password"}
              placeholder="sk-proj-..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <Button onClick={handleSave} disabled={saving || !apiKey}>
            {saving ? "Guardando..." : "Guardar"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Obtén tu API key en{" "}
          <a
            href="https://platform.openai.com/api-keys"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            platform.openai.com/api-keys
          </a>
        </p>
      </div>
    </div>
  );
}
