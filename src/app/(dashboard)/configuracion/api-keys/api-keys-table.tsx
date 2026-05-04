"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Trash2 } from "lucide-react";

interface ApiKeyRow {
  id: string;
  name: string;
  key: string;
  isActive: boolean;
  lastUsedAt: string | null;
  createdAt: string;
}

export function ApiKeysTable({ apiKeys }: { apiKeys: ApiKeyRow[] }) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(id: string) {
    if (!confirm("Estas seguro de que deseas eliminar esta API key?")) return;

    setDeletingId(id);
    try {
      const res = await fetch(`/api/api-keys/${id}`, { method: "DELETE" });
      if (res.ok) {
        router.refresh();
      } else {
        alert("Error al eliminar la API key");
      }
    } finally {
      setDeletingId(null);
    }
  }

  if (apiKeys.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        No hay claves API creadas. Genera una nueva para comenzar.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nombre</TableHead>
          <TableHead>Clave</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead>Creada</TableHead>
          <TableHead>Ultimo uso</TableHead>
          <TableHead className="w-[80px]"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {apiKeys.map((apiKey) => (
          <TableRow key={apiKey.id}>
            <TableCell className="font-medium">{apiKey.name}</TableCell>
            <TableCell>
              <code className="text-xs bg-muted px-2 py-1 rounded">
                {apiKey.key}
              </code>
            </TableCell>
            <TableCell>
              <Badge variant={apiKey.isActive ? "default" : "secondary"}>
                {apiKey.isActive ? "Activa" : "Inactiva"}
              </Badge>
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {new Date(apiKey.createdAt).toLocaleDateString("es-AR")}
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {apiKey.lastUsedAt
                ? new Date(apiKey.lastUsedAt).toLocaleDateString("es-AR")
                : "Nunca"}
            </TableCell>
            <TableCell>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDelete(apiKey.id)}
                disabled={deletingId === apiKey.id}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
