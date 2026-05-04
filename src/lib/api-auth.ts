import { prisma } from "./prisma";
import { verifySession } from "./auth";

interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

/**
 * Verify an API key from the Authorization header.
 * Returns the associated user if valid, null otherwise.
 * Updates lastUsedAt on successful verification.
 */
export async function verifyApiKey(request: Request): Promise<AuthUser | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return null;

  const match = authHeader.match(/^Bearer\s+(ech_.+)$/);
  if (!match) return null;

  const key = match[1];

  const apiKey = await prisma.apiKey.findUnique({
    where: { key },
    include: {
      user: {
        select: { id: true, email: true, name: true, role: true },
      },
    },
  });

  if (!apiKey || !apiKey.isActive) return null;

  await prisma.apiKey.update({
    where: { id: apiKey.id },
    data: { lastUsedAt: new Date() },
  });

  return apiKey.user;
}

/**
 * Verify authentication via session (cookie) OR API key.
 * Tries session auth first, falls back to API key.
 * Returns the authenticated user or null.
 */
export async function verifyAnyAuth(request: Request): Promise<AuthUser | null> {
  const session = await verifySession();
  if (session) {
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, email: true, name: true, role: true },
    });
    if (user) return user;
  }

  return verifyApiKey(request);
}
