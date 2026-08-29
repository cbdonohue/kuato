const COLORS: Record<string, string> = {
  QB: "bg-amber-400/15 text-amber-300",
  RB: "bg-emerald-400/15 text-emerald-300",
  WR: "bg-sky-400/15 text-sky-300",
  TE: "bg-orange-400/15 text-orange-300",
  K: "bg-zinc-400/15 text-zinc-300",
  DEF: "bg-rose-400/15 text-rose-300",
  FLEX: "bg-violet-400/15 text-violet-300",
  SUPER_FLEX: "bg-fuchsia-400/15 text-fuchsia-300",
};

export function PositionBadge({ position }: { position: string }) {
  const color = COLORS[position] ?? "bg-white/10 text-zinc-300";
  return (
    <span
      className={`inline-flex min-w-10 items-center justify-center rounded px-1.5 py-0.5 font-mono text-[11px] font-semibold tracking-wide ${color}`}
    >
      {position === "SUPER_FLEX" ? "SF" : position}
    </span>
  );
}
