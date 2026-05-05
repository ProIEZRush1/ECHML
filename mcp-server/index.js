#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

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

// ─── Mercado Pago ───────────────────────────────────────────────────────────

server.tool(
  "sync_mp_transactions",
  "Sincronizar movimientos de Mercado Pago (ventas, comisiones, envios, retiros)",
  {},
  async () => {
    const data = await apiRequest("/api/mp/sync", { method: "POST" });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

server.tool(
  "get_mp_balance",
  "Obtener balance en tiempo real de Mercado Pago (disponible, total, no disponible)",
  {},
  async () => {
    const data = await apiRequest("/api/mp/balance");
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

// ─── Sync Operations ────────────────────────────────────────────────────────

server.tool(
  "sync_ml_listings",
  "Sincronizar todas las publicaciones desde MercadoLibre (importar nuevas, actualizar existentes)",
  {},
  async () => {
    const data = await apiRequest("/api/ml/import-listings", { method: "POST" });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

server.tool(
  "sync_mp_orders",
  "Sincronizar ordenes y datos financieros desde MercadoLibre/Mercado Pago",
  {},
  async () => {
    const data = await apiRequest("/api/mp/sync", { method: "POST" });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

server.tool(
  "get_mp_transactions",
  "Listar transacciones de Mercado Pago con filtros opcionales",
  {
    label: z.enum(["sale", "fee", "shipping"]).optional().describe("Filtrar por tipo: sale, fee, shipping"),
    packId: z.string().optional().describe("Filtrar por pack ID"),
    limit: z.number().optional().describe("Limite de resultados (default 50)"),
  },
  async ({ label, packId, limit = 50 }) => {
    let path = `/api/mp/transactions?limit=${limit}`;
    if (label) path += `&label=${label}`;
    if (packId) path += `&packId=${packId}`;
    const data = await apiRequest(path);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

server.tool(
  "delete_withdrawal",
  "Eliminar un retiro por ID",
  { id: z.string().describe("ID del retiro a eliminar") },
  async ({ id }) => {
    const data = await apiRequest(`/api/withdrawals/${id}`, { method: "DELETE" });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

server.tool(
  "delete_expense",
  "Eliminar un gasto por ID",
  { id: z.string().describe("ID del gasto a eliminar") },
  async ({ id }) => {
    const data = await apiRequest(`/api/expenses/${id}`, { method: "DELETE" });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

server.tool(
  "list_suppliers",
  "Listar todos los proveedores",
  {},
  async () => {
    const data = await apiRequest("/api/suppliers");
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

server.tool(
  "create_supplier",
  "Crear un nuevo proveedor",
  {
    name: z.string().describe("Nombre del proveedor"),
    contact: z.string().optional().describe("Contacto"),
    phone: z.string().optional().describe("Telefono"),
    notes: z.string().optional().describe("Notas"),
  },
  async (params) => {
    const data = await apiRequest("/api/suppliers", {
      method: "POST",
      body: JSON.stringify(params),
    });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

// ─── Product Groups ────────────────────────────────────────────────────────

server.tool(
  "list_product_groups",
  "Listar todos los grupos de productos con sus productos asignados",
  {},
  async () => {
    const data = await apiRequest("/api/product-groups");
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

server.tool(
  "seed_product_groups",
  "Crear grupos de productos predeterminados (Magnesios Isaac, Magnesios Eduardo, Bluemango, Timi's)",
  {},
  async () => {
    const data = await apiRequest("/api/product-groups/seed", { method: "POST" });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

server.tool(
  "get_cashflow_report",
  "Obtener reporte de flujo de caja con filtro de fechas opcional",
  {
    from: z.string().optional().describe("Fecha inicio (YYYY-MM-DD)"),
    to: z.string().optional().describe("Fecha fin (YYYY-MM-DD)"),
  },
  async ({ from, to }) => {
    let path = "/api/cashflow";
    const params = [];
    if (from) params.push(`from=${from}`);
    if (to) params.push(`to=${to}`);
    if (params.length > 0) path += `?${params.join("&")}`;
    const data = await apiRequest(path);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

// ─── ML API Direct (via Proxy) ─────────────────────────────────────────────

/**
 * Helper para llamar la API de MercadoLibre via el proxy del CRM.
 * El proxy maneja tokens y auto-inyecta userId donde se necesite.
 */
async function mlProxy(method, endpoint, body) {
  const payload = { method, endpoint };
  if (body !== undefined) payload.body = body;
  return apiRequest("/api/ml/proxy", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// ─── ML Items/Listings ──────────────────────────────────────────────────────

server.tool(
  "ml_get_item",
  "Obtener detalle completo de una publicacion de MercadoLibre",
  { itemId: z.string().describe("ID de la publicacion, ej: MLM5259271618") },
  async ({ itemId }) => {
    const data = await mlProxy("GET", `/items/${itemId}`);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

server.tool(
  "ml_get_items",
  "Obtener multiples publicaciones a la vez (batch, max 20)",
  { itemIds: z.string().describe("IDs separados por coma, ej: MLM123,MLM456") },
  async ({ itemIds }) => {
    const data = await mlProxy("GET", `/items?ids=${itemIds}`);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

server.tool(
  "ml_create_item",
  "Crear una nueva publicacion en MercadoLibre",
  {
    title: z.string().describe("Titulo de la publicacion"),
    price: z.number().describe("Precio de venta"),
    category_id: z.string().describe("ID de la categoria, ej: MLM1234"),
    currency_id: z.string().describe("Moneda, ej: MXN"),
    available_quantity: z.number().describe("Cantidad disponible"),
    buying_mode: z.string().describe("Modo de compra: buy_it_now o auction"),
    listing_type_id: z.string().describe("Tipo de publicacion: gold_special, gold_pro, etc"),
    condition: z.string().describe("Condicion: new o used"),
    description: z.string().optional().describe("Descripcion en texto plano"),
    pictures: z.string().optional().describe("JSON array de URLs de imagenes, ej: [\"https://...\"]"),
  },
  async ({ title, price, category_id, currency_id, available_quantity, buying_mode, listing_type_id, condition, description, pictures }) => {
    const body = {
      title,
      price,
      category_id,
      currency_id,
      available_quantity,
      buying_mode,
      listing_type_id,
      condition,
    };
    if (description) body.description = { plain_text: description };
    if (pictures) {
      try {
        body.pictures = JSON.parse(pictures).map((url) => ({ source: url }));
      } catch {
        body.pictures = [];
      }
    }
    const data = await mlProxy("POST", "/items", body);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

server.tool(
  "ml_update_item",
  "Actualizar una publicacion existente (precio, stock, status, titulo, etc.)",
  {
    itemId: z.string().describe("ID de la publicacion"),
    updates: z.string().describe("JSON con los campos a actualizar, ej: {\"price\": 299, \"title\": \"...\"}"),
  },
  async ({ itemId, updates }) => {
    let body;
    try {
      body = JSON.parse(updates);
    } catch {
      return { content: [{ type: "text", text: "Error: 'updates' debe ser JSON valido" }] };
    }
    const data = await mlProxy("PUT", `/items/${itemId}`, body);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

server.tool(
  "ml_update_item_stock",
  "Actualizar stock de una publicacion rapidamente",
  {
    itemId: z.string().describe("ID de la publicacion"),
    available_quantity: z.number().describe("Nueva cantidad disponible"),
  },
  async ({ itemId, available_quantity }) => {
    const data = await mlProxy("PUT", `/items/${itemId}`, { available_quantity });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

server.tool(
  "ml_update_item_price",
  "Actualizar precio de una publicacion rapidamente",
  {
    itemId: z.string().describe("ID de la publicacion"),
    price: z.number().describe("Nuevo precio"),
  },
  async ({ itemId, price }) => {
    const data = await mlProxy("PUT", `/items/${itemId}`, { price });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

server.tool(
  "ml_pause_item",
  "Pausar una publicacion de MercadoLibre",
  { itemId: z.string().describe("ID de la publicacion") },
  async ({ itemId }) => {
    const data = await mlProxy("PUT", `/items/${itemId}`, { status: "paused" });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

server.tool(
  "ml_activate_item",
  "Reactivar una publicacion pausada de MercadoLibre",
  { itemId: z.string().describe("ID de la publicacion") },
  async ({ itemId }) => {
    const data = await mlProxy("PUT", `/items/${itemId}`, { status: "active" });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

server.tool(
  "ml_close_item",
  "Cerrar una publicacion de MercadoLibre permanentemente",
  { itemId: z.string().describe("ID de la publicacion") },
  async ({ itemId }) => {
    const data = await mlProxy("PUT", `/items/${itemId}`, { status: "closed" });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

server.tool(
  "ml_get_item_description",
  "Obtener la descripcion de una publicacion",
  { itemId: z.string().describe("ID de la publicacion") },
  async ({ itemId }) => {
    const data = await mlProxy("GET", `/items/${itemId}/description`);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

server.tool(
  "ml_update_item_description",
  "Actualizar la descripcion de una publicacion",
  {
    itemId: z.string().describe("ID de la publicacion"),
    plain_text: z.string().describe("Nuevo texto de la descripcion"),
  },
  async ({ itemId, plain_text }) => {
    const data = await mlProxy("PUT", `/items/${itemId}/description`, { plain_text });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

// ─── ML Orders ──────────────────────────────────────────────────────────────

server.tool(
  "ml_get_order",
  "Obtener detalle de una orden de MercadoLibre",
  { orderId: z.string().describe("ID de la orden") },
  async ({ orderId }) => {
    const data = await mlProxy("GET", `/orders/${orderId}`);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

server.tool(
  "ml_search_orders",
  "Buscar ordenes de MercadoLibre con filtros",
  {
    status: z.string().optional().describe("Estado: paid, cancelled, etc."),
    dateFrom: z.string().optional().describe("Fecha desde (ISO 8601, ej: 2024-01-01T00:00:00.000-00:00)"),
    dateTo: z.string().optional().describe("Fecha hasta (ISO 8601)"),
    limit: z.number().optional().describe("Limite de resultados (default 50)"),
  },
  async ({ status, dateFrom, dateTo, limit = 50 }) => {
    let endpoint = `/orders/search?seller={userId}&limit=${limit}`;
    if (status) endpoint += `&order.status=${status}`;
    if (dateFrom) endpoint += `&order.date_created.from=${encodeURIComponent(dateFrom)}`;
    if (dateTo) endpoint += `&order.date_created.to=${encodeURIComponent(dateTo)}`;
    const data = await mlProxy("GET", endpoint);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

server.tool(
  "ml_get_order_items",
  "Obtener los items de una orden",
  { orderId: z.string().describe("ID de la orden") },
  async ({ orderId }) => {
    const data = await mlProxy("GET", `/orders/${orderId}`);
    const items = data?.order_items || [];
    return { content: [{ type: "text", text: JSON.stringify(items, null, 2) }] };
  }
);

// ─── ML User/Account ────────────────────────────────────────────────────────

server.tool(
  "ml_get_me",
  "Obtener informacion de la cuenta de MercadoLibre conectada",
  {},
  async () => {
    const data = await mlProxy("GET", "/users/me");
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

server.tool(
  "ml_get_user_items",
  "Listar todas las publicaciones del vendedor en MercadoLibre",
  {
    status: z.string().optional().describe("Filtrar por estado: active, paused, closed"),
    limit: z.number().optional().describe("Limite de resultados (default 50)"),
  },
  async ({ status, limit = 50 }) => {
    let endpoint = `/users/{userId}/items/search?limit=${limit}`;
    if (status) endpoint += `&status=${status}`;
    const data = await mlProxy("GET", endpoint);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

// ─── ML Shipping ────────────────────────────────────────────────────────────

server.tool(
  "ml_get_shipment",
  "Obtener detalle de un envio de MercadoLibre",
  { shipmentId: z.string().describe("ID del envio") },
  async ({ shipmentId }) => {
    const data = await mlProxy("GET", `/shipments/${shipmentId}`);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

// ─── ML Questions ───────────────────────────────────────────────────────────

server.tool(
  "ml_get_questions",
  "Obtener preguntas de una publicacion de MercadoLibre",
  { itemId: z.string().describe("ID de la publicacion") },
  async ({ itemId }) => {
    const data = await mlProxy("GET", `/questions/search?item_id=${itemId}`);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

server.tool(
  "ml_answer_question",
  "Responder una pregunta de un comprador en MercadoLibre",
  {
    questionId: z.string().describe("ID de la pregunta"),
    text: z.string().describe("Texto de la respuesta"),
  },
  async ({ questionId, text }) => {
    const data = await mlProxy("POST", "/answers", { question_id: questionId, text });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

// ─── ML Categories ──────────────────────────────────────────────────────────

server.tool(
  "ml_get_categories",
  "Listar todas las categorias principales de MercadoLibre Mexico",
  {},
  async () => {
    const data = await mlProxy("GET", "/sites/MLM/categories");
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

server.tool(
  "ml_search_category",
  "Buscar categoria por palabra clave en MercadoLibre Mexico",
  { query: z.string().describe("Palabra clave para buscar, ej: 'termos'") },
  async ({ query }) => {
    const data = await mlProxy("GET", `/sites/MLM/domain_discovery/search?q=${encodeURIComponent(query)}`);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

server.tool(
  "ml_get_category",
  "Obtener detalle de una categoria de MercadoLibre",
  { categoryId: z.string().describe("ID de la categoria, ej: MLM1234") },
  async ({ categoryId }) => {
    const data = await mlProxy("GET", `/categories/${categoryId}`);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

// ─── ML Messaging ───────────────────────────────────────────────────────────

server.tool(
  "ml_get_messages",
  "Obtener mensajes de una venta en MercadoLibre",
  { packId: z.string().describe("ML pack_id de la venta (no el ID del CRM)") },
  async ({ packId }) => {
    const data = await mlProxy("GET", `/messages/packs/${packId}/sellers/{userId}`);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

// ─── ML Generic API ─────────────────────────────────────────────────────────

server.tool(
  "ml_api_call",
  "Hacer cualquier llamada a la API de MercadoLibre (proxy generico). Usa {userId} en el endpoint para auto-inyectar el ID del vendedor.",
  {
    method: z.enum(["GET", "POST", "PUT", "DELETE"]).describe("Metodo HTTP"),
    endpoint: z.string().describe("Endpoint de la API, ej: /items/MLM123 o /users/{userId}/items/search"),
    body: z.string().optional().describe("Body en JSON (para POST/PUT)"),
  },
  async ({ method, endpoint, body }) => {
    let parsedBody;
    if (body) {
      try {
        parsedBody = JSON.parse(body);
      } catch {
        return { content: [{ type: "text", text: "Error: 'body' debe ser JSON valido" }] };
      }
    }
    const data = await mlProxy(method, endpoint, parsedBody);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

// ─── OpenAI Integration ────────────────────────────────────────────────────────

/**
 * Helper para llamar la API de OpenAI via el proxy del CRM.
 * El proxy obtiene la API key de la DB automaticamente.
 */
async function openaiProxy(endpoint, payload, method = "POST") {
  return apiRequest("/api/openai/proxy", {
    method: "POST",
    body: JSON.stringify({ method, endpoint, payload }),
  });
}

// --- OpenAI Config ---

server.tool(
  "openai_get_config",
  "Verificar si la API key de OpenAI esta configurada",
  {},
  async () => {
    const data = await apiRequest("/api/openai/config");
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

server.tool(
  "openai_set_config",
  "Configurar la API key de OpenAI",
  { apiKey: z.string().describe("API key de OpenAI (comienza con sk-)") },
  async ({ apiKey }) => {
    const data = await apiRequest("/api/openai/config", {
      method: "PUT",
      body: JSON.stringify({ apiKey }),
    });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

// --- Image Generation ---

server.tool(
  "openai_generate_image",
  "Generar imagen con OpenAI (GPT Image / DALL-E). Ideal para fotos de producto, marketing, etc.",
  {
    prompt: z.string().describe("Descripcion detallada de la imagen a generar"),
    model: z.string().optional().describe("Modelo: gpt-image-1 (default), gpt-image-1-mini (economico)"),
    size: z.string().optional().describe("Tamaño: 1024x1024 (default), 1536x1024, 1024x1536"),
    quality: z.string().optional().describe("Calidad: low, medium, high, auto (default)"),
    n: z.number().optional().describe("Numero de imagenes a generar (default 1)"),
  },
  async ({ prompt, model = "gpt-image-1", size = "1024x1024", quality = "auto", n = 1 }) => {
    const payload = { model, prompt, size, quality, n };
    if (model.startsWith("dall-e")) payload.response_format = "url";
    const data = await openaiProxy("/images/generations", payload);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

server.tool(
  "openai_edit_image",
  "Editar/mejorar una imagen existente con OpenAI. Quitar fondos, agregar contexto, inpainting.",
  {
    prompt: z.string().describe("Instrucciones de edicion para la imagen"),
    imageUrl: z.string().describe("URL de la imagen a editar"),
    model: z.string().optional().describe("Modelo: gpt-image-1 (default)"),
    size: z.string().optional().describe("Tamaño de salida: 1024x1024 (default)"),
  },
  async ({ prompt, imageUrl, model = "gpt-image-1", size = "1024x1024" }) => {
    // Fetch the image and convert to base64 for the API
    const data = await openaiProxy("/images/edits", {
      model,
      prompt,
      image: imageUrl,
      size,
    });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

// --- Vision / Image Analysis ---

server.tool(
  "openai_analyze_image",
  "Analizar una imagen con GPT-4o Vision. Ideal para evaluar calidad de fotos de producto, generar descripciones automaticas, etc.",
  {
    imageUrl: z.string().describe("URL de la imagen a analizar"),
    prompt: z.string().optional().describe("Instruccion especifica (default: analisis general de producto)"),
    model: z.string().optional().describe("Modelo: gpt-4o (default), gpt-4o-mini (economico)"),
  },
  async ({ imageUrl, prompt = "Analiza esta imagen de producto. Describe el producto, evalúa la calidad de la foto para venta en MercadoLibre, y sugiere mejoras.", model = "gpt-4o" }) => {
    const data = await openaiProxy("/chat/completions", {
      model,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: imageUrl, detail: "high" } },
          ],
        },
      ],
      max_tokens: 1000,
    });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

server.tool(
  "openai_analyze_multiple_images",
  "Analizar multiples imagenes a la vez con GPT-4o Vision",
  {
    imageUrls: z.string().describe("URLs de imagenes separadas por coma"),
    prompt: z.string().optional().describe("Instruccion especifica para el analisis"),
    model: z.string().optional().describe("Modelo: gpt-4o (default)"),
  },
  async ({ imageUrls, prompt = "Analiza estas imagenes de producto. Compara calidad, consistencia y sugiere la mejor para usar como imagen principal en MercadoLibre.", model = "gpt-4o" }) => {
    const urls = imageUrls.split(",").map((u) => u.trim());
    const content = [
      { type: "text", text: prompt },
      ...urls.map((url) => ({
        type: "image_url",
        image_url: { url, detail: "high" },
      })),
    ];
    const data = await openaiProxy("/chat/completions", {
      model,
      messages: [{ role: "user", content }],
      max_tokens: 2000,
    });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

// --- Chat Completions (for descriptions, titles, etc.) ---

server.tool(
  "openai_chat",
  "Usar GPT-4o para generar texto: titulos, descripciones de producto, respuestas a preguntas, etc.",
  {
    prompt: z.string().describe("Instruccion o pregunta para GPT-4o"),
    systemPrompt: z.string().optional().describe("Prompt de sistema (contexto/rol)"),
    model: z.string().optional().describe("Modelo: gpt-4o (default), gpt-4o-mini (economico)"),
    maxTokens: z.number().optional().describe("Tokens maximos de respuesta (default 1000)"),
  },
  async ({ prompt, systemPrompt, model = "gpt-4o", maxTokens = 1000 }) => {
    const messages = [];
    if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
    messages.push({ role: "user", content: prompt });

    const data = await openaiProxy("/chat/completions", {
      model,
      messages,
      max_tokens: maxTokens,
    });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

server.tool(
  "openai_generate_ml_title",
  "Generar titulo optimizado para una publicacion de MercadoLibre",
  {
    productName: z.string().describe("Nombre del producto"),
    brand: z.string().optional().describe("Marca del producto"),
    variant: z.string().optional().describe("Variante (color, tamaño, etc.)"),
    category: z.string().optional().describe("Categoria del producto"),
    keywords: z.string().optional().describe("Palabras clave adicionales"),
  },
  async ({ productName, brand, variant, category, keywords }) => {
    const prompt = `Genera un titulo optimizado para MercadoLibre Mexico (max 60 caracteres) para:
Producto: ${productName}
${brand ? `Marca: ${brand}` : ""}
${variant ? `Variante: ${variant}` : ""}
${category ? `Categoria: ${category}` : ""}
${keywords ? `Keywords: ${keywords}` : ""}

El titulo debe incluir palabras clave relevantes para SEO en MercadoLibre. No uses signos de exclamacion. Responde SOLO con el titulo.`;

    const data = await openaiProxy("/chat/completions", {
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 100,
    });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

server.tool(
  "openai_generate_ml_description",
  "Generar descripcion optimizada para una publicacion de MercadoLibre",
  {
    productName: z.string().describe("Nombre del producto"),
    brand: z.string().optional().describe("Marca"),
    features: z.string().optional().describe("Caracteristicas principales del producto"),
    variant: z.string().optional().describe("Variante"),
  },
  async ({ productName, brand, features, variant }) => {
    const prompt = `Genera una descripcion profesional para MercadoLibre Mexico:
Producto: ${productName}
${brand ? `Marca: ${brand}` : ""}
${features ? `Caracteristicas: ${features}` : ""}
${variant ? `Variante: ${variant}` : ""}

La descripcion debe:
- Ser persuasiva y profesional
- Incluir caracteristicas y beneficios
- Tener formato con viñetas/secciones claras
- Ser apta para MercadoLibre Mexico
- Maximo 2000 caracteres`;

    const data = await openaiProxy("/chat/completions", {
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 800,
    });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

// --- Batch API ---

server.tool(
  "openai_create_batch",
  "Crear un batch de OpenAI para procesar multiples requests con 50% de descuento. Primero sube el archivo JSONL, luego crea el batch.",
  {
    inputFileId: z.string().describe("ID del archivo JSONL subido (file-xxx)"),
    endpoint: z.string().describe("Endpoint del batch: /v1/chat/completions, /v1/images/generations, /v1/embeddings"),
    description: z.string().optional().describe("Descripcion del batch"),
  },
  async ({ inputFileId, endpoint, description }) => {
    const payload = {
      input_file_id: inputFileId,
      endpoint,
      completion_window: "24h",
    };
    if (description) payload.metadata = { description };
    const data = await openaiProxy("/batches", payload);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

server.tool(
  "openai_get_batch",
  "Obtener estado de un batch de OpenAI (validating, in_progress, completed, failed)",
  { batchId: z.string().describe("ID del batch (batch_xxx)") },
  async ({ batchId }) => {
    const data = await openaiProxy(`/batches/${batchId}`, undefined, "GET");
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

server.tool(
  "openai_list_batches",
  "Listar todos los batches de OpenAI con su estado",
  {
    limit: z.number().optional().describe("Limite de resultados (default 20)"),
  },
  async ({ limit = 20 }) => {
    const data = await openaiProxy(`/batches?limit=${limit}`, undefined, "GET");
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

server.tool(
  "openai_cancel_batch",
  "Cancelar un batch de OpenAI en progreso",
  { batchId: z.string().describe("ID del batch (batch_xxx)") },
  async ({ batchId }) => {
    const data = await openaiProxy(`/batches/${batchId}/cancel`, {});
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

// --- File Upload (for Batch API) ---

server.tool(
  "openai_upload_file",
  "Subir un archivo a OpenAI (JSONL para batch, imagenes, etc.)",
  {
    content: z.string().describe("Contenido del archivo (JSONL para batch)"),
    purpose: z.string().optional().describe("Proposito: batch (default), fine-tune, assistants"),
    filename: z.string().optional().describe("Nombre del archivo (default: batch.jsonl)"),
  },
  async ({ content, purpose = "batch", filename = "batch.jsonl" }) => {
    // We need to use the proxy to upload
    // The proxy will handle FormData on the server side
    const data = await apiRequest("/api/openai/proxy", {
      method: "POST",
      body: JSON.stringify({
        method: "POST",
        endpoint: "/files",
        payload: { content, purpose, filename },
      }),
    });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

server.tool(
  "openai_get_file",
  "Obtener informacion de un archivo subido a OpenAI",
  { fileId: z.string().describe("ID del archivo (file-xxx)") },
  async ({ fileId }) => {
    const data = await openaiProxy(`/files/${fileId}`, undefined, "GET");
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

server.tool(
  "openai_get_file_content",
  "Descargar el contenido de un archivo de OpenAI a disco local. Para batch outputs (JSONL grande, 30MB+), guarda a /tmp/ y retorna la ruta del archivo.",
  {
    fileId: z.string().describe("ID del archivo (file-xxx)"),
    outputDir: z.string().optional().describe("Directorio de salida (default: /tmp)"),
  },
  async ({ fileId, outputDir }) => {
    const dir = outputDir || tmpdir();
    const filePath = join(dir, `openai_${fileId}.jsonl`);

    const url = `${API_URL}/api/openai/files/${fileId}/content`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${API_KEY}` },
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      throw new Error(`Download failed ${res.status}: ${errorText || res.statusText}`);
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    await mkdir(dir, { recursive: true });
    await writeFile(filePath, buffer);

    const sizeMB = (buffer.length / 1024 / 1024).toFixed(2);
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          saved_to: filePath,
          size_bytes: buffer.length,
          size_mb: sizeMB,
          file_id: fileId,
          message: `Archivo descargado a ${filePath} (${sizeMB} MB). Procesa con: python3 -c "for line in open('${filePath}'): import json; obj=json.loads(line); print(obj['custom_id'])"`,
        }, null, 2),
      }],
    };
  }
);

// --- Video Generation (Sora) ---

server.tool(
  "openai_generate_video",
  "Generar video de producto con Sora (disponible hasta Sept 2026). Crea un video corto para showcase.",
  {
    prompt: z.string().describe("Descripcion del video a generar"),
    model: z.string().optional().describe("Modelo: sora-2 (default, rapido), sora-2-pro (alta calidad)"),
    size: z.string().optional().describe("Tamaño: 1280x720 (landscape, default), 720x1280 (vertical)"),
    seconds: z.number().optional().describe("Duracion en segundos: 4, 8 o 12 (default 8)"),
  },
  async ({ prompt, model = "sora-2", size = "1280x720", seconds = 8 }) => {
    const validSeconds = [4, 8, 12];
    const nearest = validSeconds.reduce((prev, curr) => Math.abs(curr - seconds) < Math.abs(prev - seconds) ? curr : prev);
    const data = await openaiProxy("/videos", {
      model,
      prompt,
      size,
      seconds: String(nearest),
    });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

server.tool(
  "openai_get_video",
  "Obtener estado de un video generado con Sora (queued, in_progress, completed)",
  { videoId: z.string().describe("ID del video") },
  async ({ videoId }) => {
    const data = await openaiProxy(`/videos/${videoId}`, undefined, "GET");
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

server.tool(
  "openai_get_video_content",
  "Descargar el video MP4 generado con Sora a disco local. El video debe estar en status 'completed'.",
  {
    videoId: z.string().describe("ID del video"),
    outputDir: z.string().optional().describe("Directorio de salida (default: /tmp)"),
  },
  async ({ videoId, outputDir }) => {
    const dir = outputDir || tmpdir();
    const filePath = join(dir, `openai_video_${videoId}.mp4`);

    const url = `${API_URL}/api/openai/videos/${videoId}/content`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${API_KEY}` },
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      throw new Error(`Download failed ${res.status}: ${errorText || res.statusText}`);
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    await mkdir(dir, { recursive: true });
    await writeFile(filePath, buffer);

    const sizeMB = (buffer.length / 1024 / 1024).toFixed(2);
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          saved_to: filePath,
          size_bytes: buffer.length,
          size_mb: sizeMB,
          video_id: videoId,
          message: `Video MP4 descargado a ${filePath} (${sizeMB} MB)`,
        }, null, 2),
      }],
    };
  }
);

server.tool(
  "openai_list_videos",
  "Listar todos los videos generados con Sora",
  {
    limit: z.number().optional().describe("Limite de resultados (default 20)"),
  },
  async ({ limit = 20 }) => {
    const data = await openaiProxy(`/videos?limit=${limit}`, undefined, "GET");
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

// --- Models ---

server.tool(
  "openai_list_models",
  "Listar todos los modelos disponibles en tu cuenta de OpenAI",
  {},
  async () => {
    const data = await openaiProxy("/models", undefined, "GET");
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

// --- Generic OpenAI API ---

server.tool(
  "openai_api_call",
  "Hacer cualquier llamada a la API de OpenAI (proxy generico)",
  {
    method: z.enum(["GET", "POST", "PUT", "DELETE"]).describe("Metodo HTTP"),
    endpoint: z.string().describe("Endpoint de la API, ej: /chat/completions, /images/generations"),
    payload: z.string().optional().describe("Payload en JSON (para POST/PUT)"),
  },
  async ({ method, endpoint, payload }) => {
    let parsedPayload;
    if (payload) {
      try {
        parsedPayload = JSON.parse(payload);
      } catch {
        return { content: [{ type: "text", text: "Error: 'payload' debe ser JSON valido" }] };
      }
    }
    const data = await openaiProxy(endpoint, parsedPayload, method);
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
