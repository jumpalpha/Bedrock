"use client";
// ── wave-twinA ──
export function PrintButton({ label = "Print", className = "btn-block btn-grass !text-sm" }: { label?: string; className?: string }) {
  return <button type="button" onClick={() => window.print()} className={className}>🖨 {label}</button>;
}
