import { createHmac } from "crypto";
import { prisma } from "@/lib/prisma";

const TT_AUTH_BASE = "https://auth.tiktok-shops.com";
const TT_API_BASE = "https://open-api.tiktokglobalshop.com";
const API_VERSION = "202309";

interface TikTokCredentialData {
  id: string;
  appKey: string;
  appSecret: string;
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: Date;
  shopId: string;
  shopCipher: string;
  shopName: string;
  openId: string;
  sellerRegion: string;
}

interface TikTokTokenResponse {
  code: number;
  message: string;
  data: {
    access_token: string;
    access_token_expire_in: number;
    refresh_token: string;
    refresh_token_expire_in: number;
    open_id: string;
    seller_name: string;
    seller_base_region: string;
    user_type: number;
  };
}

interface TikTokShopsResponse {
  code: number;
  message: string;
  data: {
    shops: Array<{
      id: string;
      name: string;
      region: string;
      cipher: string;
      seller_type: string;
    }>;
  };
}

interface TikTokFetchOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  params?: Record<string, string>;
  skipShopCipher?: boolean;
  isMultipart?: boolean;
  rawBody?: BodyInit;
  headers?: Record<string, string>;
}

export async function getTikTokCredentials(): Promise<TikTokCredentialData | null> {
  return prisma.tikTokCredential.findFirst();
}

export function buildTikTokAuthURL(appKey: string): string {
  const state = Math.random().toString(36).substring(2);
  return `${TT_AUTH_BASE}/oauth/authorize?app_key=${appKey}&state=${state}`;
}

function generateSignature(
  path: string,
  params: Record<string, string>,
  appSecret: string,
  body?: string
): string {
  const filteredParams = { ...params };
  delete filteredParams["sign"];
  delete filteredParams["access_token"];

  const sortedKeys = Object.keys(filteredParams).sort();
  let signString = path;
  for (const key of sortedKeys) {
    signString += key + filteredParams[key];
  }

  if (body) {
    signString += body;
  }

  signString = appSecret + signString + appSecret;

  return createHmac("sha256", appSecret).update(signString).digest("hex");
}

export async function exchangeTikTokCode(
  authCode: string
): Promise<TikTokTokenResponse> {
  const cred = await getTikTokCredentials();
  if (!cred) throw new Error("No TikTok credentials configured");

  const url = `${TT_AUTH_BASE}/api/v2/token/get?app_key=${cred.appKey}&app_secret=${cred.appSecret}&auth_code=${authCode}&grant_type=authorized_code`;

  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`TikTok token exchange failed: ${err}`);
  }

  const data: TikTokTokenResponse = await res.json();
  if (data.code !== 0) {
    throw new Error(`TikTok token error: ${data.message}`);
  }

  await prisma.tikTokCredential.update({
    where: { id: cred.id },
    data: {
      accessToken: data.data.access_token,
      refreshToken: data.data.refresh_token,
      tokenExpiresAt: new Date(data.data.access_token_expire_in * 1000),
      openId: data.data.open_id,
      sellerRegion: data.data.seller_base_region,
    },
  });

  return data;
}

export async function refreshTikTokToken(): Promise<boolean> {
  const cred = await getTikTokCredentials();
  if (!cred || !cred.refreshToken) return false;

  try {
    const url = `${TT_AUTH_BASE}/api/v2/token/refresh?app_key=${cred.appKey}&app_secret=${cred.appSecret}&refresh_token=${cred.refreshToken}&grant_type=refresh_token`;

    const res = await fetch(url);
    if (!res.ok) {
      console.error("TikTok token refresh failed:", await res.text());
      return false;
    }

    const data: TikTokTokenResponse = await res.json();
    if (data.code !== 0) {
      console.error("TikTok token refresh error:", data.message);
      return false;
    }

    await prisma.tikTokCredential.update({
      where: { id: cred.id },
      data: {
        accessToken: data.data.access_token,
        refreshToken: data.data.refresh_token,
        tokenExpiresAt: new Date(data.data.access_token_expire_in * 1000),
      },
    });

    return true;
  } catch (e) {
    console.error("TikTok token refresh error:", e);
    return false;
  }
}

async function ensureValidToken(): Promise<string | null> {
  const cred = await getTikTokCredentials();
  if (!cred) return null;

  if (cred.accessToken && cred.tokenExpiresAt > new Date(Date.now() + 60000)) {
    return cred.accessToken;
  }

  if (cred.refreshToken) {
    const refreshed = await refreshTikTokToken();
    if (refreshed) {
      const updated = await getTikTokCredentials();
      return updated?.accessToken || null;
    }
  }

  return null;
}

export async function hasValidTikTokToken(): Promise<boolean> {
  const token = await ensureValidToken();
  return !!token;
}

export async function fetchAuthorizedShops(): Promise<TikTokShopsResponse["data"]["shops"]> {
  const cred = await getTikTokCredentials();
  if (!cred) throw new Error("No TikTok credentials configured");

  const data = await tiktokFetch<TikTokShopsResponse["data"]>(
    `/authorization/${API_VERSION}/shops`,
    { skipShopCipher: true }
  );

  if (data.shops && data.shops.length > 0) {
    const shop = data.shops[0];
    await prisma.tikTokCredential.update({
      where: { id: cred.id },
      data: {
        shopId: shop.id,
        shopCipher: shop.cipher,
        shopName: shop.name,
      },
    });
  }

  return data.shops;
}

export async function tiktokFetch<T = unknown>(
  path: string,
  options: TikTokFetchOptions = {}
): Promise<T> {
  const token = await ensureValidToken();
  if (!token) {
    throw new Error("No hay token valido de TikTok Shop. Reconecta tu cuenta.");
  }

  const cred = await getTikTokCredentials();
  if (!cred) throw new Error("No TikTok credentials configured");

  const method = options.method || "GET";
  const timestamp = Math.floor(Date.now() / 1000).toString();

  const queryParams: Record<string, string> = {
    app_key: cred.appKey,
    timestamp,
    ...options.params,
  };

  if (!options.skipShopCipher && cred.shopCipher) {
    queryParams["shop_cipher"] = cred.shopCipher;
  }

  let bodyString: string | undefined;
  if (options.body && !options.isMultipart) {
    bodyString = JSON.stringify(options.body);
  }

  const sign = generateSignature(path, queryParams, cred.appSecret, bodyString);
  queryParams["sign"] = sign;

  const qs = new URLSearchParams(queryParams).toString();
  const url = `${TT_API_BASE}${path}?${qs}`;

  const fetchOptions: RequestInit = { method };

  if (options.isMultipart && options.rawBody) {
    fetchOptions.body = options.rawBody;
    fetchOptions.headers = {
      "x-tts-access-token": token,
      ...options.headers,
    };
  } else {
    fetchOptions.headers = {
      "x-tts-access-token": token,
      "Content-Type": "application/json",
      ...options.headers,
    };
    if (bodyString) {
      fetchOptions.body = bodyString;
    }
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);
  let response: Response;
  try {
    response = await fetch(url, { ...fetchOptions, signal: controller.signal });
  } catch (e) {
    clearTimeout(timer);
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`TikTok API error 0: request failed (${msg})`);
  }
  clearTimeout(timer);

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`TikTok API error ${response.status}: ${text || "(empty body)"}`);
  }

  // Some endpoints (e.g. promotion add-products) reply 200 with an empty or
  // non-JSON body on success. Tolerate that instead of crashing the handler.
  if (!text || !text.trim()) {
    return {} as T;
  }

  let result: { code?: number; message?: string; data?: unknown };
  try {
    result = JSON.parse(text);
  } catch {
    return { raw: text } as T;
  }

  if (result.code !== undefined && result.code !== 0) {
    throw new Error(`TikTok API error ${result.code}: ${result.message}`);
  }

  return (result.data !== undefined ? result.data : result) as T;
}

export async function uploadTikTokImageData(
  data: ArrayBuffer,
  filename: string,
  useCase: string = "MAIN_IMAGE"
): Promise<{ uri: string; url: string }> {
  const formData = new FormData();
  const blob = new Blob([data], { type: "image/jpeg" });
  formData.append("data", blob, filename);
  formData.append("use_case", useCase);

  return tiktokFetch(`/product/${API_VERSION}/images/upload`, {
    method: "POST",
    isMultipart: true,
    rawBody: formData,
    skipShopCipher: true,
  });
}

export async function uploadTikTokImage(
  imageUrl: string,
  filename: string,
  useCase: string = "MAIN_IMAGE"
): Promise<{ uri: string; url: string }> {
  const imageRes = await fetch(imageUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      Accept: "image/avif,image/webp,image/*,*/*;q=0.8",
    },
  });
  if (!imageRes.ok) {
    throw new Error(`Failed to fetch source image ${imageUrl}: ${imageRes.status}`);
  }
  const arrayBuffer = await imageRes.arrayBuffer();
  return uploadTikTokImageData(arrayBuffer, filename, useCase);
}

export async function getCategories(): Promise<unknown> {
  return tiktokFetch(`/product/${API_VERSION}/categories`, {
    params: { locale: "es-MX" },
  });
}

export async function recommendCategory(
  productTitle: string
): Promise<unknown> {
  return tiktokFetch(`/product/${API_VERSION}/categories/recommend`, {
    method: "POST",
    body: { product_title: productTitle },
  });
}

export async function getCategoryAttributes(
  categoryId: string
): Promise<unknown> {
  return tiktokFetch(`/product/${API_VERSION}/categories/${categoryId}/attributes`, {
    params: { locale: "es-MX" },
  });
}

export async function getCategoryRules(
  categoryId: string
): Promise<unknown> {
  return tiktokFetch(`/product/${API_VERSION}/categories/${categoryId}/rules`);
}

export async function createProduct(payload: unknown): Promise<unknown> {
  return tiktokFetch(`/product/${API_VERSION}/products`, {
    method: "POST",
    body: payload,
  });
}

export async function searchProducts(): Promise<unknown> {
  return tiktokFetch(`/product/${API_VERSION}/products/search`, {
    method: "POST",
    body: { page_size: 100 },
  });
}
