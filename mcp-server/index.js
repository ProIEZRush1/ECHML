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

// ─── Start Server ────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Error fatal:", error);
  process.exit(1);
});
