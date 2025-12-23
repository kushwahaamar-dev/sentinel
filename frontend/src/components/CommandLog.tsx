import { useEffect, useRef } from "react";

type LogItem = {
  text: string;
  status?: "ok" | "warn" | "fail";
};

type Props = {
  items: LogItem[];
};

const statusColor: Record<NonNullable<LogItem["status"]>, string> = {
  ok: "text-emerald-400",
  warn: "text-amber-400",
  fail: "text-rose-400"
};

export function CommandLog({ items }: Props) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [items]);

  return (
    <div className="log-grid glass rounded-2xl border border-white/5 p-4 font-mono text-xs md:text-sm text-emerald-200 shadow-lg h-64 overflow-y-auto scrollbar-thin scrollbar-thumb-emerald-900 scrollbar-track-transparent">
      <div className="mb-2 text-[10px] uppercase tracking-[0.15em] text-emerald-500/50 sticky top-0 bg-[#0b0b0f]/80 backdrop-blur-sm pb-2 border-b border-emerald-500/10">Command Line / System Log</div>
      <div className="space-y-1.5 font-jetbrains">
        {items.map((item, idx) => (
          <div key={idx} className="flex gap-2 animate-in fade-in slide-in-from-left-1 duration-300">
            <span className="text-emerald-500/50 select-none">{">"}</span>
            <span className={`${item.status ? statusColor[item.status] : "text-emerald-200/80"} break-all`}>
              {item.text}
            </span>
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </div>
  );
}
