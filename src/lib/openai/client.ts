import { prisma } from "@/lib/prisma";

const OPENAI_BASE = "https://api.openai.com/v1";

export async function getOpenAIKey(): Promise<string | null> {
  const config = await prisma.systemConfig.findUnique({
    where: { key: "openai_api_key" },
  });
  return config?.value ?? null;
}

export async function setOpenAIKey(apiKey: string): Promise<void> {
  await prisma.systemConfig.upsert({
    where: { key: "openai_api_key" },
    create: { key: "openai_api_key", value: apiKey },
    update: { value: apiKey },
  });
}

export async function deleteOpenAIKey(): Promise<void> {
  await prisma.systemConfig.deleteMany({
    where: { key: "openai_api_key" },
  });
}

export async function openaiRequest<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const apiKey = await getOpenAIKey();
  if (!apiKey) {
    throw new Error("No hay API key de OpenAI configurada. Ve a Configuracion > OpenAI para agregarla.");
  }

  const url = `${OPENAI_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...options.headers,
    },
  });

  if (!res.ok) {
    const errorBody = await res.text().catch(() => "");
    throw new Error(`OpenAI API error ${res.status}: ${errorBody || res.statusText}`);
  }

  return res.json() as Promise<T>;
}

export async function openaiFormRequest<T = unknown>(
  path: string,
  formData: FormData
): Promise<T> {
  const apiKey = await getOpenAIKey();
  if (!apiKey) {
    throw new Error("No hay API key de OpenAI configurada.");
  }

  const url = `${OPENAI_BASE}${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!res.ok) {
    const errorBody = await res.text().catch(() => "");
    throw new Error(`OpenAI API error ${res.status}: ${errorBody || res.statusText}`);
  }

  return res.json() as Promise<T>;
}
