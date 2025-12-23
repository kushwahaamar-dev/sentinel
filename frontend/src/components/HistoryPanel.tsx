import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { History, X, RefreshCw, ExternalLink, CheckCircle, XCircle, Activity, Flame, Wind } from "lucide-react";

type HistoryEvent = {
  id: number;
  external_id: string;
  timestamp: string;
  disaster_type: string;
  description: string;
  lat: number;
  lon: number;
  severity: string | null;
  processed: boolean;
  payout_tx: string | null;
  payout_amount: string | null;
  ai_confidence: number | null;
  ai_reasoning: string | null;
  bucket: string;
};

type Props = {
  apiUrl: string;
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const typeIcons: Record<string, JSX.Element> = {
  quake: <Activity size={14} className="text-rose-400" />,
  fire: <Flame size={14} className="text-amber-400" />,
  storm: <Wind size={14} className="text-purple-400" />,
};

export function HistoryPanel({ apiUrl }: Props) {
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState<HistoryEvent[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/history?limit=20`);
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events || []);
      }
    } catch (e) {
      console.error("Failed to fetch history:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) fetchHistory();
  }, [open]);

  const openExplorer = (tx: string) => {
    const url = tx.startsWith("0x")
      ? `https://etherscan.io/tx/${tx}`
      : `https://solscan.io/tx/${tx}`;
    window.open(url, "_blank");
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="glass flex items-center gap-2 rounded-full px-4 py-2 text-xs uppercase tracking-wider text-white/90 hover:text-white hover:border-neon/60 transition"
        aria-label="Open event history"
      >
        <History size={14} />
        History
      </button>

      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)}>
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="glass w-full max-w-2xl max-h-[80vh] rounded-2xl border border-white/10 bg-[#0b0b0f]/95 shadow-2xl overflow-hidden relative flex flex-col"
            >
              <div className="p-6 pb-4 border-b border-white/5">
                <button
                  onClick={() => setOpen(false)}
                  className="absolute right-4 top-4 rounded-full p-1 text-slate-400 hover:bg-white/10 hover:text-white transition"
                  aria-label="Close history"
                >
                  <X size={20} />
                </button>

                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl glass bg-sky-500/10">
                    <History className="text-sky-400" size={20} />
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Activity Log</div>
                    <h2 className="text-lg font-bold text-white">Event History</h2>
                  </div>
                  <button
                    onClick={fetchHistory}
                    disabled={loading}
                    className="ml-auto glass rounded-lg p-2 hover:bg-white/10 transition"
                    aria-label="Refresh history"
                  >
                    <RefreshCw size={14} className={loading ? "animate-spin text-neon" : "text-slate-400"} />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                {loading ? (
                  <div className="flex items-center justify-center h-40">
                    <RefreshCw size={24} className="animate-spin text-neon" />
                  </div>
                ) : events.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-40 text-slate-500">
                    <History size={32} className="mb-2 opacity-50" />
                    <span className="text-sm">No events processed yet</span>
                    <span className="text-xs mt-1">Trigger a simulation or wait for live events</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {events.map((event) => (
                      <div
                        key={event.id}
                        className="glass rounded-xl p-4 border border-white/5 hover:border-white/10 transition"
                      >
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-lg glass">
                            {typeIcons[event.bucket] || <Activity size={14} className="text-slate-400" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-medium text-white truncate">{event.description.slice(0, 50)}...</span>
                              {event.payout_tx ? (
                                <CheckCircle size={14} className="text-emerald-400 shrink-0" />
                              ) : (
                                <XCircle size={14} className="text-slate-500 shrink-0" />
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-[11px] text-slate-400">
                              <span>{formatTime(event.timestamp)}</span>
                              <span className="capitalize">{event.bucket}</span>
                              <span>{event.lat.toFixed(2)}°, {event.lon.toFixed(2)}°</span>
                            </div>
                            {event.ai_reasoning && (
                              <p className="mt-2 text-xs text-slate-300 leading-relaxed">{event.ai_reasoning}</p>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            {event.payout_amount && (
                              <div className="text-sm font-mono text-emerald-300">${Number(event.payout_amount).toLocaleString()}</div>
                            )}
                            {event.ai_confidence !== null && (
                              <div className="text-[10px] text-slate-400">{event.ai_confidence}% conf</div>
                            )}
                            {event.payout_tx && (
                              <button
                                onClick={() => openExplorer(event.payout_tx!)}
                                className="mt-1 text-[10px] text-neon hover:text-white flex items-center gap-1 transition"
                              >
                                TX <ExternalLink size={10} />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
