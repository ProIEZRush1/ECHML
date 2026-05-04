#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const API_URL = process.env.ECH_API_URL || "https://echml.overcloud.us";
const API_KEY = process.env.ECH_API_KEY;

if (!API_KEY) {
  console.error("Error: ECH_API_KEY es requerida");
  process.exit(1);
}

/**
 * Helper para hacer requests autenticados a la API del CRM.
 */
async function apiRequest(path, options = {}) {
  const url = `${API_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
      ...options.headers,
    },
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    throw new Error(`API error ${res.status}: ${errorText || res.statusText}`);
  }

  return res.json();
}

const server = new McpServer({
  name: "ech-crm-mcp",
  version: "1.0.0",
});

// ─── Products ────────────────────────────────────────────────────────────────

server.tool(
  "list_products",
  "Listar todos los productos con stock por color",
  {},
  async () => {
    const data = await apiRequest("/api/products");
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

server.tool(
  "get_product",
  "Obtener detalle de un producto por ID",
  { id: z.string().describe("ID del producto") },
  async ({ id }) => {
    const data = await apiRequest(`/api/products/${id}`);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

server.tool(
  "create_product",
  "Crear un nuevo producto",
  {
    name: z.string().describe("Nombre del producto"),
    supplierCode: z.string().describe("Codigo del proveedor"),
    unitCost: z.number().describe("Costo unitario"),
    supplierId: z.string().describe("ID del proveedor"),
    description: z.string().optional().describe("Descripcion del producto"),
  },
  async (params) => {
    const data = await apiRequest("/api/products", {
      method: "POST",
      body: JSON.stringify(params),
    });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

server.tool(
  "update_product",
  "Actualizar campos de un producto",
  {
    id: z.string().describe("ID del producto"),
    name: z.string().optional().describe("Nombre del producto"),
    supplierCode: z.string().optional().describe("Codigo del proveedor"),
    unitCost: z.number().optional().describe("Costo unitario"),
    description: z.string().optional().describe("Descripcion del producto"),
  },
  async ({ id, ...updates }) => {
    const data = await apiRequest(`/api/products/${id}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

server.tool(
  "delete_product",
  "Eliminar un producto",
  { id: z.string().describe("ID del producto") },
  async ({ id }) => {
    const data = await apiRequest(`/api/products/${id}`, { method: "DELETE" });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

// ─── Packs ───────────────────────────────────────────────────────────────────

server.tool(
  "list_packs",
  "Listar todos los packs con composicion y stock",
  {},
  async () => {
    const data = await apiRequest("/api/packs");
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

server.tool(
  "get_pack",
  "Obtener detalle de un pack por ID",
  { id: z.string().describe("ID del pack") },
  async ({ id }) => {
    const data = await apiRequest(`/api/packs/${id}`);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

server.tool(
  "create_pack",
  "Crear un nuevo pack con items",
  {
    sku: z.string().describe("SKU unico del pack"),
    name: z.string().describe("Nombre del pack"),
    salePrice: z.number().describe("Precio de venta"),
    description: z.string().optional().describe("Descripcion del pack"),
    items: z.array(z.object({
      productVariantId: z.string().describe("ID de la variante de producto"),
      quantity: z.number().describe("Cantidad de la variante en el pack"),
    })).describe("Items que componen el pack"),
  },
  async (params) => {
    const data = await apiRequest("/api/packs", {
      method: "POST",
      body: JSON.stringify(params),
    });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

server.tool(
  "update_pack",
  "Actualizar un pack existente",
  {
    id: z.string().describe("ID del pack"),
    sku: z.string().optional().describe("SKU del pack"),
    name: z.string().optional().describe("Nombre del pack"),
    salePrice: z.number().optional().describe("Precio de venta"),
    description: z.string().optional().describe("Descripcion del pack"),
  },
  async ({ id, ...updates }) => {
    const data = await apiRequest(`/api/packs/${id}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

server.tool(
  "delete_pack",
  "Eliminar un pack",
  { id: z.string().describe("ID del pack") },
  async ({ id }) => {
    const data = await apiRequest(`/api/packs/${id}`, { method: "DELETE" });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

// ─── Stock ───────────────────────────────────────────────────────────────────

server.tool(
  "get_stock_overview",
  "Obtener matriz de inventario (producto x color)",
  {},
  async () => {
    const data = await apiRequest("/api/products");
    const overview = data.map((p) => ({
      id: p.id,
      name: p.name,
      supplierCode: p.supplierCode,
      variants: p.variants,
      totalStock: p.variants.reduce((sum, v) => sum + v.stock, 0),
    }));
    return { content: [{ type: "text", text: JSON.stringify(overview, null, 2) }] };
  }
);

server.tool(
  "add_stock",
  "Agregar entrada de stock",
  {
    supplierId: z.string().describe("ID del proveedor"),
    notes: z.string().optional().describe("Notas de la entrada"),
    items: z.array(z.object({
      productVariantId: z.string().describe("ID de la variante de producto"),
      quantity: z.number().describe("Cantidad a agregar"),
      unitCost: z.number().describe("Costo unitario"),
    })).describe("Items de la entrada de stock"),
  },
  async (params) => {
    const data = await apiRequest("/api/stock/entry", {
      method: "POST",
      body: JSON.stringify(params),
    });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

server.tool(
  "get_stock_history",
  "Obtener historial de cambios de stock",
  {
    productVariantId: z.string().optional().describe("Filtrar por variante de producto"),
    limit: z.number().optional().describe("Limite de resultados (por defecto 50)"),
  },
  async ({ productVariantId, limit = 50 }) => {
    let path = `/api/stock/entry?limit=${limit}`;
    if (productVariantId) path += `&productVariantId=${productVariantId}`;
    const data = await apiRequest(path);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

// ─── ML Listings ─────────────────────────────────────────────────────────────

server.tool(
  "list_listings",
  "Listar todas las publicaciones de MercadoLibre con estado de sincronizacion",
  {},
  async () => {
    const data = await apiRequest("/api/ml/import-listings");
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

server.tool(
  "sync_listings",
  "Disparar sincronizacion de publicaciones con MercadoLibre",
  {},
  async () => {
    const data = await apiRequest("/api/ml/import-listings", { method: "POST" });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

// ─── Dashboard ───────────────────────────────────────────────────────────────

server.tool(
  "get_dashboard",
  "Obtener estadisticas y KPIs del panel principal",
  {},
  async () => {
    const [products, packs] = await Promise.all([
      apiRequest("/api/products"),
      apiRequest("/api/packs"),
    ]);

    const totalProducts = products.length;
    const totalPacks = packs.length;
    const totalStock = products.reduce(
      (sum, p) => sum + p.variants.reduce((vs, v) => vs + v.stock, 0),
      0
    );
    const lowStockProducts = products.filter(
      (p) => p.variants.some((v) => v.stock <= 3 && v.stock > 0)
    );
    const outOfStockProducts = products.filter(
      (p) => p.variants.every((v) => v.stock === 0)
    );

    const dashboard = {
      totalProducts,
      totalPacks,
      totalStock,
      lowStockCount: lowStockProducts.length,
      outOfStockCount: outOfStockProducts.length,
      lowStockProducts: lowStockProducts.map((p) => ({
        id: p.id,
        name: p.name,
        variants: p.variants.filter((v) => v.stock <= 3),
      })),
    };

    return { content: [{ type: "text", text: JSON.stringify(dashboard, null, 2) }] };
  }
);

// ─── Orders ──────────────────────────────────────────────────────────────────

server.tool(
  "list_orders",
  "Listar ordenes recientes de MercadoLibre",
  {
    limit: z.number().optional().describe("Limite de resultados (por defecto 20)"),
  },
  async ({ limit = 20 }) => {
    // Try the ventas/orders API endpoint
    let data;
    try {
      data = await apiRequest(`/api/ml/import-listings?type=orders&limit=${limit}`);
    } catch {
      // Fallback: get orders from the pack listings info
      const packs = await apiRequest("/api/packs");
      data = {
        message: "Endpoint de ordenes no disponible directamente. Mostrando packs con listings activos.",
        packs: packs.filter((p) => p._count?.mlListings > 0).map((p) => ({
          id: p.id,
          name: p.name,
          sku: p.sku,
          stock: p.stock,
          listingsCount: p._count?.mlListings,
        })),
      };
    }
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

// ─── Cash Flow ──────────────────────────────────────────────────────────────

server.tool(
  "get_cashflow",
  "Obtener reporte de flujo de caja: ingresos por pack, retiros, balance en MP",
  {},
  async () => {
    const data = await apiRequest("/api/cashflow");
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

server.tool(
  "list_withdrawals",
  "Listar todos los retiros de Mercado Pago con sus asignaciones",
  {},
  async () => {
    const data = await apiRequest("/api/withdrawals");
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

server.tool(
  "create_withdrawal",
  "Registrar un retiro de Mercado Pago con asignacion a packs/productos",
  {
    amount: z.number().describe("Monto del retiro en MXN"),
    date: z.string().describe("Fecha del retiro (YYYY-MM-DD)"),
    concept: z.string().describe("Concepto del retiro (ej: Transferencia a banco)"),
    method: z.enum(["bank", "cash", "provider"]).optional().describe("Metodo: bank, cash, provider"),
    reference: z.string().optional().describe("Referencia bancaria"),
    notes: z.string().optional().describe("Notas adicionales"),
    allocations: z.array(z.object({
      packId: z.string().optional().describe("ID del pack al que se asigna"),
      productId: z.string().optional().describe("ID del producto al que se asigna"),
      amount: z.number().describe("Monto asignado a este pack/producto"),
    })).optional().describe("Asignaciones del retiro a packs/productos"),
  },
  async (params) => {
    const data = await apiRequest("/api/withdrawals", {
      method: "POST",
      body: JSON.stringify(params),
    });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

server.tool(
  "list_expenses",
  "Listar gastos operativos",
  {},
  async () => {
    const data = await apiRequest("/api/expenses");
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

server.tool(
  "create_expense",
  "Registrar un gasto operativo",
  {
    amount: z.number().describe("Monto del gasto en MXN"),
    date: z.string().describe("Fecha del gasto (YYYY-MM-DD)"),
    category: z.enum(["proveedor", "envio", "suscripcion", "publicidad", "otro"]).describe("Categoria"),
    concept: z.string().describe("Concepto del gasto"),
    supplierId: z.string().optional().describe("ID del proveedor (si aplica)"),
    notes: z.string().optional().describe("Notas"),
  },
  async (params) => {
    const data = await apiRequest("/api/expenses", {
      method: "POST",
      body: JSON.stringify(params),
    });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

// ─── Start Server ────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Error fatal:", error);
  process.exit(1);
});
