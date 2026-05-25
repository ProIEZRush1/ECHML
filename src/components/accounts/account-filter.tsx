"use client";

import { useRouter, useSearchParams } from "next/navigation";

interface Account {
  id: string;
  name: string;
  color: string;
}

interface Props {
  accounts: Account[];
  basePath: string;
}

export function AccountFilter({ accounts, basePath }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeAccountId = searchParams.get("accountId") || "";

  function setFilter(accountId: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (accountId) {
      params.set("accountId", accountId);
    } else {
      params.delete("accountId");
    }
    const query = params.toString();
    router.push(`${basePath}${query ? `?${query}` : ""}`);
  }

  if (accounts.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mr-1">Cuenta</span>
      <button
        onClick={() => setFilter("")}
        className={`text-[11px] px-2 py-1 rounded-full border transition-colors ${!activeAccountId ? "bg-foreground text-background border-foreground" : "border-border hover:border-muted-foreground"}`}
      >
        Todas
      </button>
      {accounts.map((a) => (
        <button
          key={a.id}
          onClick={() => setFilter(a.id)}
          className={`text-[11px] px-2 py-1 rounded-full border transition-colors inline-flex items-center gap-1 ${activeAccountId === a.id ? "border-foreground font-semibold" : "border-border hover:border-muted-foreground"}`}
          style={activeAccountId === a.id ? { background: a.color + "20", color: a.color, borderColor: a.color } : {}}
        >
          <span className="h-2 w-2 rounded-full" style={{ background: a.color }} />
          {a.name}
        </button>
      ))}
    </div>
  );
}
