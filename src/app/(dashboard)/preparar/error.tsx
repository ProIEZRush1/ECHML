"use client";

export default function PrepararError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="p-8 space-y-4">
      <h2 className="text-lg font-bold text-red-500">Error en Preparar</h2>
      <pre className="text-xs bg-muted p-4 rounded-md overflow-auto max-h-[300px]">
        {error.message}
        {error.stack}
      </pre>
      <button onClick={reset} className="filt-input">Reintentar</button>
    </div>
  );
}
