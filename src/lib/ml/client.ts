import { prisma } from "@/lib/prisma";

const ML_API_BASE = "https://api.mercadolibre.com";
const ML_AUTH_URL = "https://auth.mercadolibre.com.mx/authorization";
const ML_TOKEN_URL = "https://api.mercadolibre.com/oauth/token";

interface MLCredentialData {
  id: string;
  appId: string;
  clientSecret: string;
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: Date;
  mlUserId: bigint;
  scope: string;
}

interface MLFetchOptions extends RequestInit {
  params?: Record<string, string>;
}

interface MLTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  user_id: number;
  refresh_token: string;
}

export async function getMLCredentials(): Promise<MLCredentialData | null> {
  return prisma.mLCredential.findFirst();
}

export function buildAuthURL(appId: string, redirectUri: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: appId,
    redirect_uri: redirectUri,
  });
  return `${ML_AUTH_URL}?${params.toString()}`;
}

export async function exchangeCodeForToken(
  code: string,
  redirectUri: string
): Promise<MLTokenResponse> {
  const cred = await getMLCredentials();
  if (!cred) throw new Error("No credentials configured");

  const res = await fetch(ML_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: cred.appId,
      client_secret: cred.clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token exchange failed: ${err}`);
  }

  const data: MLTokenResponse = await res.json();

  await prisma.mLCredential.update({
    where: { id: cred.id },
    data: {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      tokenExpiresAt: new Date(Date.now() + data.expires_in * 1000),
      mlUserId: BigInt(data.user_id),
      scope: data.scope,
    },
  });

  return data;
}

export async function refreshAccessToken(): Promise<boolean> {
  const cred = await getMLCredentials();
  if (!cred || !cred.refreshToken) return false;

  try {
    const res = await fetch(ML_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: cred.appId,
        client_secret: cred.clientSecret,
        refresh_token: cred.refreshToken,
      }),
    });

    if (!res.ok) {
      console.error("Token refresh failed:", await res.text());
      return false;
    }

    const data: MLTokenResponse = await res.json();

    await prisma.mLCredential.update({
      where: { id: cred.id },
      data: {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        tokenExpiresAt: new Date(Date.now() + data.expires_in * 1000),
      },
    });

    return true;
  } catch (e) {
    console.error("Token refresh error:", e);
    return false;
  }
}

async function ensureValidToken(): Promise<string | null> {
  const cred = await getMLCredentials();
  if (!cred) return null;

  if (cred.accessToken && cred.tokenExpiresAt > new Date(Date.now() + 60000)) {
    return cred.accessToken;
  }

  if (cred.refreshToken) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      const updated = await getMLCredentials();
      return updated?.accessToken || null;
    }
  }

  return null;
}

export async function hasValidToken(): Promise<boolean> {
  const token = await ensureValidToken();
  return !!token;
}

export async function mlFetch<T = unknown>(
  endpoint: string,
  options: MLFetchOptions = {}
): Promise<T> {
  const token = await ensureValidToken();
  if (!token) {
    throw new Error("No hay token valido de MercadoLibre. Reconecta tu cuenta.");
  }

  const { params, ...fetchOptions } = options;
  let url = `${ML_API_BASE}${endpoint}`;

  if (params) {
    url += `?${new URLSearchParams(params).toString()}`;
  }

  const response = await fetch(url, {
    ...fetchOptions,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...fetchOptions.headers,
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`ML API error ${response.status}: ${errorBody}`);
  }

  return response.json() as Promise<T>;
}

interface MLItemSearchResponse {
  seller_id: string;
  results: string[];
  paging: { total: number; offset: number; limit: number };
}

interface MLItemDetail {
  id: string;
  title: string;
  permalink: string;
  status: string;
  available_quantity: number;
  price: number;
  category_id: string;
  thumbnail: string;
}

export async function getSellerItems(userId: string): Promise<string[]> {
  const allItems: string[] = [];
  let offset = 0;
  const limit = 50;
  let total = Infinity;

  while (offset < total) {
    const response = await mlFetch<MLItemSearchResponse>(
      `/users/${userId}/items/search`,
      { params: { offset: offset.toString(), limit: limit.toString() } }
    );
    total = response.paging.total;
    allItems.push(...response.results);
    offset += limit;
  }

  return allItems;
}

export async function getItemDetails(itemIds: string[]): Promise<MLItemDetail[]> {
  const results: MLItemDetail[] = [];
  const batchSize = 20;

  for (let i = 0; i < itemIds.length; i += batchSize) {
    const batch = itemIds.slice(i, i + batchSize);
    const response = await mlFetch<Array<{ code: number; body: MLItemDetail }>>(
      "/items",
      { params: { ids: batch.join(",") } }
    );
    for (const item of response) {
      if (item.code === 200) results.push(item.body);
    }
  }

  return results;
}
