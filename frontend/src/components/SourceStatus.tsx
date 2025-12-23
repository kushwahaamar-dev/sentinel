import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Satellite, Radio, Cloud, CheckCircle, XCircle, Loader2 } from "lucide-react";

type SourceInfo = {
  status: "ok" | "error" | "unknown";
  last_check: string | null;
  message?: string;
  events?: number;
};

type Props = {
  apiUrl: string;
  mode: string;
};

const sourceIcons: Record<string, JSX.Element> = {
  gdacs: <Satellite size={12} />,
  eonet: <Radio size={12} />,
  nws: <Cloud size={12} />,
};

const sourceLabels: Record<string, string> = {
  gdacs: "GDACS",
  eonet: "NASA EONET",
  nws: "NOAA NWS",
};

function StatusDot({ status }: { status: string }) {
  if (status === "ok") {
    return (
      <motion.div
        className="relative"
        initial={{ scale: 0.8 }}
        animate={{ scale: 1 }}
      >
        <div className="w-2 h-2 rounded-full bg-emerald-500" />
        <div className="absolute inset-0 w-2 h-2 rounded-full bg-emerald-500 animate-ping opacity-50" />
      </motion.div>
    );
  }
  if (status === "error") {
    return <div className="w-2 h-2 rounded-full bg-rose-500" />;
  }
  return <div className="w-2 h-2 rounded-full bg-slate-500 animate-pulse" />;
}

export function SourceStatus({ apiUrl, mode }: Props) {
  const [sources, setSources] = useState<Record<string, SourceInfo>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (mode !== "LIVE") {
      setLoading(false);
      return;
    }

    const fetchStatus = async () => {
      try {
        const res = await fetch(`${apiUrl}/sources/status`);
        if (res.ok) {
          const data = await res.json();
          setSources(data.sources || {});
        }
      } catch (e) {
        console.error("Failed to fetch source status:", e);
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, [apiUrl, mode]);

  if (mode !== "LIVE") return null;

  return (
    <div className="glass rounded-xl p-3 border border-white/5">
      <div className="text-[10px] uppercase tracking-[0.15em] text-slate-500 mb-2">Data Sources</div>
      {loading ? (
        <div className="flex items-center justify-center py-2">
          <Loader2 size={16} className="animate-spin text-neon" />
        </div>
      ) : (
        <div className="space-y-1.5">
          {Object.entries(sources).map(([key, info]) => (
            <div
              key={key}
              className="flex items-center gap-2 text-xs"
              title={info.message || undefined}
            >
              <StatusDot status={info.status} />
              <span className="text-slate-400">{sourceIcons[key]}</span>
              <span className="text-slate-300">{sourceLabels[key] || key}</span>
              {info.events !== undefined && info.events > 0 && (
                <span className="ml-auto px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-mono">
                  {info.events}
                </span>
              )}
              {info.status === "error" && (
                <XCircle size={12} className="ml-auto text-rose-400" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
