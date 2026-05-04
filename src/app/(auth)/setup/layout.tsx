import { Package } from "lucide-react";

export default function SetupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/40 px-4 py-12">
      <div className="mb-8 flex flex-col items-center gap-2">
        <div className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Package className="size-6" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">ECH</h1>
        <p className="text-sm text-muted-foreground">
          Configuracion inicial
        </p>
      </div>
      <div className="w-full max-w-2xl">{children}</div>
    </div>
  );
}
