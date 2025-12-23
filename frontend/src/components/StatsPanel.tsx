import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BarChart3, TrendingUp, Clock, Activity, X, RefreshCw } from "lucide-react";

type Stats = {
  total_events_processed: number;
  total_payouts: number;
  total_payout_amount: number;
  vault_balance: number;
  initial_vault_balance: number;
  events_by_type: Record<string, number>;
  uptime_seconds: number;
  mode: string;
  last_updated: string;
  last_payout: {
    timestamp: string;
    amount: string;
    ngo_name: string;
    ngo_address: string;
    disaster_type: string;
  } | null;
};

type Props = {
  apiUrl: string;
};

function formatUptime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins}m`;
}

export function StatsPanel({ apiUrl }: Props) {
  const [open, setOpen] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/statistics`);
      if (res.ok) {
        setStats(await res.json());
      }
    } catch (e) {
      console.error("Failed to fetch stats:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) fetchStats();
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="glass flex items-center gap-2 rounded-full px-4 py-2 text-xs uppercase tracking-wider text-white/90 hover:text-white hover:border-neon/60 transition"
        aria-label="Open statistics panel"
      >
        <BarChart3 size={14} />
        Stats
      </button>

      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)}>
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="glass w-full max-w-lg rounded-2xl border border-white/10 bg-[#0b0b0f]/95 shadow-2xl p-6 relative"
            >
              <button
                onClick={() => setOpen(false)}
                className="absolute right-4 top-4 rounded-full p-1 text-slate-400 hover:bg-white/10 hover:text-white transition"
                aria-label="Close statistics"
              >
                <X size={20} />
              </button>

              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-xl glass bg-emerald-500/10">
                  <TrendingUp className="text-emerald-400" size={20} />
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Dashboard</div>
                  <h2 className="text-lg font-bold text-white">System Statistics</h2>
                </div>
                <button
                  onClick={fetchStats}
                  disabled={loading}
                  className="ml-auto glass rounded-lg p-2 hover:bg-white/10 transition"
                  aria-label="Refresh statistics"
                >
                  <RefreshCw size={14} className={loading ? "animate-spin text-neon" : "text-slate-400"} />
                </button>
              </div>

              {stats ? (
                <div className="space-y-4">
                  {/* Main Stats Grid */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="glass rounded-xl p-4 border-l-2 border-l-emerald-500">
                      <div className="text-[10px] uppercase tracking-[0.1em] text-slate-400">Vault Balance</div>
                      <div className="text-2xl font-mono text-emerald-300">${stats.vault_balance.toLocaleString()}</div>
                    </div>
                    <div className="glass rounded-xl p-4 border-l-2 border-l-purple-500">
                      <div className="text-[10px] uppercase tracking-[0.1em] text-slate-400">Total Payouts</div>
                      <div className="text-2xl font-mono text-purple-300">${stats.total_payout_amount.toLocaleString()}</div>
                    </div>
                    <div className="glass rounded-xl p-4">
                      <div className="text-[10px] uppercase tracking-[0.1em] text-slate-400">Events Processed</div>
                      <div className="text-xl font-mono text-white">{stats.total_events_processed}</div>
                    </div>
                    <div className="glass rounded-xl p-4">
                      <div className="text-[10px] uppercase tracking-[0.1em] text-slate-400">Payouts Issued</div>
                      <div className="text-xl font-mono text-white">{stats.total_payouts}</div>
                    </div>
                  </div>

                  {/* Events by Type */}
                  <div className="glass rounded-xl p-4">
                    <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400 mb-3">Events by Type</div>
                    <div className="flex gap-4">
                      {Object.entries(stats.events_by_type).map(([type, count]) => (
                        <div key={type} className="flex items-center gap-2">
                          <div
                            className={`w-3 h-3 rounded-full ${
                              type === "quake" ? "bg-rose-500" :
                              type === "fire" ? "bg-amber-500" :
                              type === "storm" ? "bg-purple-500" : "bg-slate-500"
                            }`}
                          />
                          <span className="text-sm text-slate-300 capitalize">{type}</span>
                          <span className="text-sm font-mono text-white">{count}</span>
                        </div>
                      ))}
                      {Object.keys(stats.events_by_type).length === 0 && (
                        <span className="text-sm text-slate-500">No events yet</span>
                      )}
                    </div>
                  </div>

                  {/* Last Payout Info */}
                  {stats.last_payout && (
                    <div className="glass rounded-xl p-4 border-l-2 border-l-sky-500">
                      <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400 mb-2">Last Payout</div>
                      <div className="text-sm font-semibold text-white mb-1">{stats.last_payout.ngo_name}</div>
                      <div className="text-xs text-slate-300 font-mono mb-1">{stats.last_payout.ngo_address}</div>
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span>${Number(stats.last_payout.amount).toLocaleString()} USDC</span>
                        <span>{new Date(stats.last_payout.timestamp).toLocaleString()}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-1 capitalize">
                        {stats.last_payout.disaster_type}
                      </div>
                    </div>
                  )}

                  {/* System Status */}
                  <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-white/5">
                    <div className="flex items-center gap-2">
                      <Clock size={12} />
                      <span>Uptime: {formatUptime(stats.uptime_seconds)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Activity size={12} className={stats.mode === "LIVE" ? "text-emerald-400" : "text-amber-400"} />
                      <span className={stats.mode === "LIVE" ? "text-emerald-400" : "text-amber-400"}>
                        {stats.mode} MODE
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-40">
                  <RefreshCw size={24} className="animate-spin text-neon" />
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
