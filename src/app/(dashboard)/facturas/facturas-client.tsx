"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import {
  Plus,
  FileText,
  Upload,
  Trash2,
  Eye,
  Pencil,
  Building2,
  Loader2,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { toast } from "sonner";

interface ProductGroup {
  id: string;
  name: string;
  color: string;
  facturaSobreMercancia: boolean;
}

interface Factura {
  id: string;
  folio: string | null;
  rfcEmisor: string | null;
  rfcReceptor: string | null;
  fechaEmision: string | null;
  subtotal: number | null;
  iva: number | null;
  total: number;
  conceptos: string | null;
  status: string;
  productGroupId: string | null;
  notes: string | null;
  createdAt: string;
  productGroup: { id: string; name: string; color: string } | null;
}

interface FacturasClientProps {
  facturas: Factura[];
  productGroups: ProductGroup[];
}

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  pendiente: { label: "Pendiente", cls: "tx-pill flex" },
  pagada: { label: "Pagada", cls: "tx-pill sale" },
  cancelada: { label: "Cancelada", cls: "tx-pill expense" },
};

const EMPTY_FORM = {
  folio: "",
  rfcEmisor: "",
  rfcReceptor: "",
  fechaEmision: "",
  subtotal: "",
  iva: "",
  total: "",
  productGroupId: "",
  notes: "",
};

export function FacturasClient({
  facturas,
  productGroups,
}: FacturasClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [extractedData, setExtractedData] = useState<Record<string, unknown> | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Factura | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [viewTarget, setViewTarget] = useState<Factura | null>(null);

  const currentGroupId = searchParams.get("productGroupId") || "";
  const currentStatus = searchParams.get("status") || "";

  function handleFilterChange(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`/facturas?${params.toString()}`);
  }

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setExtractedData(null);
  }

  function handleEdit(factura: Factura) {
    setForm({
      folio: factura.folio || "",
      rfcEmisor: factura.rfcEmisor || "",
      rfcReceptor: factura.rfcReceptor || "",
      fechaEmision: factura.fechaEmision ? factura.fechaEmision.split("T")[0] : "",
      subtotal: factura.subtotal != null ? String(factura.subtotal) : "",
      iva: factura.iva != null ? String(factura.iva) : "",
      total: String(factura.total),
      productGroupId: factura.productGroupId || "",
      notes: factura.notes || "",
    });
    setEditingId(factura.id);
    setDialogOpen(true);
  }

  async function handleSave() {
    const total = parseFloat(form.total);
    if (!total || total <= 0) {
      toast.error("El total debe ser mayor a 0");
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        total,
        folio: form.folio || undefined,
        rfcEmisor: form.rfcEmisor || undefined,
        rfcReceptor: form.rfcReceptor || undefined,
        fechaEmision: form.fechaEmision || undefined,
        subtotal: form.subtotal ? parseFloat(form.subtotal) : undefined,
        iva: form.iva ? parseFloat(form.iva) : undefined,
        productGroupId: form.productGroupId || undefined,
        notes: form.notes || undefined,
      };

      const url = editingId ? `/api/facturas/${editingId}` : "/api/facturas";
      const method = editingId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Error al guardar factura");
        return;
      }

      toast.success(editingId ? "Factura actualizada" : "Factura registrada");
      setDialogOpen(false);
      resetForm();
      router.refresh();
    } catch {
      toast.error("Error de conexion");
    } finally {
      setSaving(false);
    }
  }

  async function handlePdfUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      toast.error("Solo se aceptan archivos PDF");
      return;
    }

    setUploading(true);
    try {
      const buffer = await file.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
      );

      const res = await fetch("/api/facturas/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdfBase64: base64 }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Error al extraer datos del PDF");
        return;
      }

      const extracted = await res.json();
      setExtractedData(extracted);

      // Prefill form with extracted data
      setForm({
        folio: extracted.folio || "",
        rfcEmisor: extracted.rfcEmisor || "",
        rfcReceptor: extracted.rfcReceptor || "",
        fechaEmision: extracted.fechaEmision || "",
        subtotal: extracted.subtotal != null ? String(extracted.subtotal) : "",
        iva: extracted.iva != null ? String(extracted.iva) : "",
        total: extracted.total != null ? String(extracted.total) : "",
        productGroupId: form.productGroupId,
        notes: form.notes,
      });

      toast.success("Datos extraidos del PDF. Revisa y confirma.");
    } catch {
      toast.error("Error al procesar el PDF");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/facturas/${deleteTarget.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Error al eliminar factura");
        return;
      }

      toast.success("Factura eliminada");
      router.refresh();
    } catch {
      toast.error("Error de conexion");
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  return (
    <>
      {/* Top actions + Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Button className="gap-2" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          Nueva Factura
        </Button>

        <div className="h-6 w-px bg-border mx-1 hidden sm:block" />
        <Select
          value={currentGroupId}
          onValueChange={(v) => handleFilterChange("productGroupId", v === "__all__" ? "" : v ?? "")}
        >
          <SelectTrigger className="w-[200px] h-8 text-[12px]">
            <SelectValue placeholder="Todos los grupos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos los grupos</SelectItem>
            {productGroups.map((g) => (
              <SelectItem key={g.id} value={g.id}>
                <span className="flex items-center gap-2">
                  <span
                    className="h-2 w-2 rounded-full shrink-0"
                    style={{ background: g.color }}
                  />
                  {g.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={currentStatus}
          onValueChange={(v) => handleFilterChange("status", v === "__all__" ? "" : v ?? "")}
        >
          <SelectTrigger className="w-[160px] h-8 text-[12px]">
            <SelectValue placeholder="Todos los estados" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos los estados</SelectItem>
            <SelectItem value="pendiente">Pendiente</SelectItem>
            <SelectItem value="pagada">Pagada</SelectItem>
            <SelectItem value="cancelada">Cancelada</SelectItem>
          </SelectContent>
        </Select>

        {(currentGroupId || currentStatus) && (
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-[12px]"
            onClick={() => router.push("/facturas")}
          >
            Limpiar filtros
          </Button>
        )}
      </div>

      {/* Table */}
      {facturas.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Sin facturas registradas"
          description="Las facturas apareceran aqui cuando las registres."
        />
      ) : (
        <div className="rounded-xl border border-border bg-card glass overflow-x-auto">
          <Table className="min-w-[700px]">
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="text-[11px] uppercase tracking-wider">Folio</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider">RFC Emisor</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider">Fecha</TableHead>
                <TableHead className="text-right text-[11px] uppercase tracking-wider">Total</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider">Status</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider">Grupo</TableHead>
                <TableHead className="text-right text-[11px] uppercase tracking-wider">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {facturas.map((factura) => {
                const statusConfig = STATUS_CONFIG[factura.status] || STATUS_CONFIG.pendiente;
                return (
                  <TableRow key={factura.id} className="hover:bg-muted/50">
                    <TableCell className="font-medium text-[12.5px]">
                      {factura.folio || (
                        <span className="text-muted-foreground text-[11px]">Sin folio</span>
                      )}
                    </TableCell>
                    <TableCell className="text-[12.5px] font-mono text-muted-foreground">
                      {factura.rfcEmisor || "-"}
                    </TableCell>
                    <TableCell className="text-[12.5px] text-muted-foreground whitespace-nowrap">
                      {factura.fechaEmision ? formatDate(factura.fechaEmision) : "-"}
                    </TableCell>
                    <TableCell className="text-right num font-semibold">
                      {formatCurrency(factura.total)}
                    </TableCell>
                    <TableCell>
                      <span className={statusConfig.cls}>{statusConfig.label}</span>
                    </TableCell>
                    <TableCell>
                      {factura.productGroup ? (
                        <span
                          className="inline-flex items-center gap-1 text-[10.5px] font-medium px-1.5 py-0.5 rounded-full"
                          style={{
                            background: factura.productGroup.color + "20",
                            color: factura.productGroup.color,
                          }}
                        >
                          <span
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ background: factura.productGroup.color }}
                          />
                          {factura.productGroup.name}
                        </span>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleEdit(factura)}
                          title="Editar"
                        >
                          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setViewTarget(factura)}
                          title="Ver detalle"
                        >
                          <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setDeleteTarget(factura)}
                          title="Eliminar"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Nueva Factura Dialog */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Factura" : "Nueva Factura"}</DialogTitle>
          </DialogHeader>

          <Tabs defaultValue={0}>
            <TabsList className="w-full">
              <TabsTrigger value={0} className="flex-1 gap-1.5">
                <FileText className="h-3.5 w-3.5" />
                Manual
              </TabsTrigger>
              <TabsTrigger value={1} className="flex-1 gap-1.5">
                <Upload className="h-3.5 w-3.5" />
                Subir PDF
              </TabsTrigger>
            </TabsList>

            {/* Manual Tab */}
            <TabsContent value={0}>
              <div className="space-y-3 pt-3">
                <FacturaFormFields
                  form={form}
                  setForm={setForm}
                  productGroups={productGroups}
                />
                <Button
                  className="w-full"
                  onClick={handleSave}
                  disabled={saving || !form.total}
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  {editingId ? "Actualizar Factura" : "Guardar Factura"}
                </Button>
              </div>
            </TabsContent>

            {/* PDF Upload Tab */}
            <TabsContent value={1}>
              <div className="space-y-3 pt-3">
                <div className="space-y-1.5">
                  <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Archivo PDF
                  </Label>
                  <Input
                    type="file"
                    accept=".pdf"
                    onChange={handlePdfUpload}
                    disabled={uploading}
                    className="text-[12px]"
                  />
                  {uploading && (
                    <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Extrayendo datos del PDF...
                    </div>
                  )}
                </div>

                {extractedData && (
                  <>
                    <div className="rounded-md border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20 p-3">
                      <p className="text-[11px] uppercase tracking-wider text-green-700 dark:text-green-400 font-medium mb-2">
                        Datos extraidos - revisa y confirma
                      </p>
                      {(() => {
                        const conceptos = extractedData.conceptos;
                        if (!conceptos || !Array.isArray(conceptos) || conceptos.length === 0) return null;
                        const items = conceptos as Array<{ descripcion: string; cantidad: number; unitario: number; importe: number }>;
                        return (
                          <div className="space-y-1">
                            <p className="text-[10.5px] text-muted-foreground font-medium">Conceptos:</p>
                            {items.map((c, i) => (
                              <p key={i} className="text-[11px] text-muted-foreground">
                                {c.cantidad}x {c.descripcion} - {formatCurrency(c.importe)}
                              </p>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                    <FacturaFormFields
                      form={form}
                      setForm={setForm}
                      productGroups={productGroups}
                    />
                    <Button
                      className="w-full"
                      onClick={handleSave}
                      disabled={saving || !form.total}
                    >
                      {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                      Confirmar y Guardar
                    </Button>
                  </>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* View Detail Dialog */}
      <Dialog open={!!viewTarget} onOpenChange={(open) => !open && setViewTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Factura {viewTarget?.folio || ""}
            </DialogTitle>
          </DialogHeader>
          {viewTarget && (
            <div className="space-y-3">
              <DetailRow label="Folio" value={viewTarget.folio} />
              <DetailRow label="RFC Emisor" value={viewTarget.rfcEmisor} mono />
              <DetailRow label="RFC Receptor" value={viewTarget.rfcReceptor} mono />
              <DetailRow
                label="Fecha Emision"
                value={viewTarget.fechaEmision ? formatDate(viewTarget.fechaEmision) : null}
              />
              <div className="border-t border-border pt-2 space-y-2">
                <DetailRow
                  label="Subtotal"
                  value={viewTarget.subtotal != null ? formatCurrency(viewTarget.subtotal) : null}
                />
                <DetailRow
                  label="IVA"
                  value={viewTarget.iva != null ? formatCurrency(viewTarget.iva) : null}
                />
                <div className="flex items-center justify-between">
                  <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                    Total
                  </span>
                  <span className="num font-bold text-[14px]">
                    {formatCurrency(viewTarget.total)}
                  </span>
                </div>
              </div>
              {viewTarget.productGroup && (
                <div className="flex items-center justify-between">
                  <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                    Grupo
                  </span>
                  <span
                    className="inline-flex items-center gap-1 text-[10.5px] font-medium px-1.5 py-0.5 rounded-full"
                    style={{
                      background: viewTarget.productGroup.color + "20",
                      color: viewTarget.productGroup.color,
                    }}
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: viewTarget.productGroup.color }}
                    />
                    {viewTarget.productGroup.name}
                  </span>
                </div>
              )}
              {viewTarget.status && (
                <div className="flex items-center justify-between">
                  <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                    Status
                  </span>
                  <span className={(STATUS_CONFIG[viewTarget.status] || STATUS_CONFIG.pendiente).cls}>
                    {(STATUS_CONFIG[viewTarget.status] || STATUS_CONFIG.pendiente).label}
                  </span>
                </div>
              )}
              {viewTarget.notes && (
                <div className="space-y-1">
                  <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                    Notas
                  </span>
                  <p className="text-[12px] text-muted-foreground">{viewTarget.notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Eliminar factura"
        description={`¿Estas seguro de que quieres eliminar la factura "${deleteTarget?.folio || deleteTarget?.id}"? Esta accion no se puede deshacer.`}
        onConfirm={handleDelete}
        variant="destructive"
      />
    </>
  );
}

function FacturaFormFields({
  form,
  setForm,
  productGroups,
}: {
  form: typeof EMPTY_FORM;
  setForm: React.Dispatch<React.SetStateAction<typeof EMPTY_FORM>>;
  productGroups: ProductGroup[];
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Folio
          </Label>
          <Input
            value={form.folio}
            onChange={(e) => setForm({ ...form, folio: e.target.value })}
            placeholder="A-001"
            className="text-[12px] h-8"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Fecha Emision
          </Label>
          <Input
            type="date"
            value={form.fechaEmision}
            onChange={(e) => setForm({ ...form, fechaEmision: e.target.value })}
            className="text-[12px] h-8"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
            RFC Emisor
          </Label>
          <Input
            value={form.rfcEmisor}
            onChange={(e) => setForm({ ...form, rfcEmisor: e.target.value.toUpperCase() })}
            placeholder="XAXX010101000"
            className="text-[12px] h-8 font-mono"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
            RFC Receptor
          </Label>
          <Input
            value={form.rfcReceptor}
            onChange={(e) => setForm({ ...form, rfcReceptor: e.target.value.toUpperCase() })}
            placeholder="XAXX010101000"
            className="text-[12px] h-8 font-mono"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Subtotal
          </Label>
          <Input
            type="number"
            step="0.01"
            value={form.subtotal}
            onChange={(e) => {
              const subtotal = e.target.value;
              const iva = subtotal ? String(parseFloat(subtotal) * 0.16) : "";
              const total = subtotal && iva ? String(parseFloat(subtotal) + parseFloat(iva)) : "";
              setForm({ ...form, subtotal, iva, total });
            }}
            placeholder="0.00"
            className="text-[12px] h-8 num"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
            IVA
          </Label>
          <Input
            type="number"
            step="0.01"
            value={form.iva}
            onChange={(e) => {
              const iva = e.target.value;
              const total = form.subtotal && iva
                ? String(parseFloat(form.subtotal) + parseFloat(iva))
                : "";
              setForm({ ...form, iva, total });
            }}
            placeholder="0.00"
            className="text-[12px] h-8 num"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Total *
          </Label>
          <Input
            type="number"
            step="0.01"
            value={form.total}
            onChange={(e) => setForm({ ...form, total: e.target.value })}
            placeholder="0.00"
            className="text-[12px] h-8 num font-semibold"
            required
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
          Grupo de Producto
        </Label>
        <Select
          value={form.productGroupId}
          onValueChange={(v) => setForm({ ...form, productGroupId: v === "__none__" ? "" : v ?? "" })}
        >
          <SelectTrigger className="h-8 text-[12px]">
            <SelectValue placeholder="Sin grupo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Sin grupo</SelectItem>
            {productGroups.map((g) => (
              <SelectItem key={g.id} value={g.id}>
                <span className="flex items-center gap-2">
                  <Building2 className="h-3 w-3" style={{ color: g.color }} />
                  {g.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
          Notas
        </Label>
        <Textarea
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          placeholder="Notas opcionales..."
          className="text-[12px] min-h-[60px]"
          rows={2}
        />
      </div>
    </div>
  );
}

function DetailRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
        {label}
      </span>
      <span className={`text-[12.5px] ${mono ? "font-mono" : ""}`}>
        {value || <span className="text-muted-foreground">-</span>}
      </span>
    </div>
  );
}
