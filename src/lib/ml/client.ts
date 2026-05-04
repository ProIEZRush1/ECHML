/**
 * MercadoLibre API client module.
 *
 * Provides authenticated access to the MercadoLibre REST API,
 * credential management, and helper functions for common operations.
 */

import { prisma } from "@/lib/prisma";

const ML_API_BASE = "https://api.mercadolibre.com";

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

interface MLItemSearchResponse {
  seller_id: string;
  results: string[];
  paging: {
    total: number;
    offset: number;
    limit: number;
  };
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

/**
 * Fetch ML credentials from the database.
 *
 * Returns:
 *   The first MLCredential record, or null if none exists.
 */
export async function getMLCredentials(): Promise<MLCredentialData | null> {
  const credential = await prisma.mLCredential.findFirst();
  return credential;
}

/**
 * Check if the current credentials have a valid (non-expired) access token.
 *
 * Returns:
 *   True if credentials exist and token is not expired.
 */
export async function hasValidToken(): Promise<boolean> {
  const cred = await getMLCredentials();
  if (!cred) return false;
  if (!cred.accessToken || cred.accessToken === "") return false;
  return cred.tokenExpiresAt > new Date();
}

/**
 * Perform an authenticated fetch against the MercadoLibre API.
 *
 * Args:
 *   endpoint: The API path (e.g., "/users/me")
 *   options: Standard fetch options plus optional query params
 *
 * Returns:
 *   The parsed JSON response.
 *
 * Raises:
 *   Error: If no valid credentials exist or if the API returns an error.
 */
export async function mlFetch<T = unknown>(
  endpoint: string,
  options: MLFetchOptions = {}
): Promise<T> {
  const cred = await getMLCredentials();
  if (!cred || !cred.accessToken) {
    throw new Error("No hay credenciales de MercadoLibre configuradas");
  }

  const { params, ...fetchOptions } = options;
  let url = `${ML_API_BASE}${endpoint}`;

  if (params) {
    const searchParams = new URLSearchParams(params);
    url += `?${searchParams.toString()}`;
  }

  const response = await fetch(url, {
    ...fetchOptions,
    headers: {
      Authorization: `Bearer ${cred.accessToken}`,
      "Content-Type": "application/json",
      ...fetchOptions.headers,
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `ML API error ${response.status}: ${errorBody}`
    );
  }

  return response.json() as Promise<T>;
}

/**
 * Fetch all seller item IDs with pagination.
 *
 * Args:
 *   userId: The ML user ID (seller)
 *
 * Returns:
 *   Array of all item IDs belonging to the seller.
 */
export async function getSellerItems(userId: string): Promise<string[]> {
  const allItems: string[] = [];
  let offset = 0;
  const limit = 50;
  let total = Infinity;

  while (offset < total) {
    const response = await mlFetch<MLItemSearchResponse>(
      `/users/${userId}/items/search`,
      {
        params: {
          offset: offset.toString(),
          limit: limit.toString(),
        },
      }
    );

    total = response.paging.total;
    allItems.push(...response.results);
    offset += limit;
  }

  return allItems;
}

/**
 * Batch fetch item details (max 20 per request as per ML API limits).
 *
 * Args:
 *   itemIds: Array of ML item IDs to fetch details for
 *
 * Returns:
 *   Array of item detail objects.
 */
export async function getItemDetails(
  itemIds: string[]
): Promise<MLItemDetail[]> {
  const results: MLItemDetail[] = [];
  const batchSize = 20;

  for (let i = 0; i < itemIds.length; i += batchSize) {
    const batch = itemIds.slice(i, i + batchSize);
    const ids = batch.join(",");

    const response = await mlFetch<Array<{ code: number; body: MLItemDetail }>>(
      "/items",
      { params: { ids } }
    );

    for (const item of response) {
      if (item.code === 200) {
        results.push(item.body);
      }
    }
  }

  return results;
}
