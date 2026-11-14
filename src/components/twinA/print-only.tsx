"use client";
// ── wave-twinA ── print just one part of a page (Dopps Class family_quest.html printChart()).
export function PrintOnly({ cls, label, className = "btn-block btn-grass !text-sm" }: { cls: string; label: string; className?: string }) {
  const go = () => {
    document.body.classList.add(cls);
    const done = () => { document.body.classList.remove(cls); window.removeEventListener("afterprint", done); };
    window.addEventListener("afterprint", done);
    window.print();
  };
  return <button type="button" onClick={go} className={className}>🖨 {label}</button>;
}
