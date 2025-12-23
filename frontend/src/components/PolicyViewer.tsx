import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, X, RefreshCw, Shield, Cpu, Database, MapPin } from "lucide-react";

type Policy = {
  max_payout_usdc: number;
  vault_balance_usdc: number;
  triggers: {
    earthquake: { min_magnitude: number; population_threshold: number };
    fire: { persistence_hours: number; thermal_anomaly: boolean };
    storm: { min_category: number; evacuation_order: boolean };
  };
  high_risk_zones: string[];
  ai_confidence_threshold: number;
  ai_model: string;
  data_sources: string[];
};

type Props = {
  apiUrl: string;
};

export function PolicyViewer({ apiUrl }: Props) {
  const [open, setOpen] = useState(false);
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchPolicy = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/policy`);
      if (res.ok) {
        setPolicy(await res.json());
      }
    } catch (e) {
      console.error("Failed to fetch policy:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) fetchPolicy();
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="glass flex items-center gap-2 rounded-full px-4 py-2 text-xs uppercase tracking-wider text-white/90 hover:text-white hover:border-neon/60 transition"
        aria-label="View policy configuration"
      >
        <FileText size={14} />
        Policy
      </button>

      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)}>
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="glass w-full max-w-lg rounded-2xl border border-white/10 bg-[#0b0b0f]/95 shadow-2xl p-6 relative max-h-[85vh] overflow-y-auto"
            >
              <button
                onClick={() => setOpen(false)}
                className="absolute right-4 top-4 rounded-full p-1 text-slate-400 hover:bg-white/10 hover:text-white transition"
                aria-label="Close policy viewer"
              >
                <X size={20} />
              </button>

              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-xl glass bg-amber-500/10">
                  <Shield className="text-amber-400" size={20} />
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Configuration</div>
                  <h2 className="text-lg font-bold text-white">Policy Parameters</h2>
                </div>
                <button
                  onClick={fetchPolicy}
                  disabled={loading}
                  className="ml-auto glass rounded-lg p-2 hover:bg-white/10 transition"
                  aria-label="Refresh policy"
                >
                  <RefreshCw size={14} className={loading ? "animate-spin text-neon" : "text-slate-400"} />
                </button>
              </div>

              {policy ? (
                <div className="space-y-5">
                  {/* Vault Info */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="glass rounded-xl p-4 border-l-2 border-l-emerald-500">
                      <div className="text-[10px] uppercase tracking-[0.1em] text-slate-400">Vault Balance</div>
                      <div className="text-xl font-mono text-emerald-300">${policy.vault_balance_usdc.toLocaleString()}</div>
                    </div>
                    <div className="glass rounded-xl p-4 border-l-2 border-l-amber-500">
                      <div className="text-[10px] uppercase tracking-[0.1em] text-slate-400">Max Payout</div>
                      <div className="text-xl font-mono text-amber-300">${policy.max_payout_usdc.toLocaleString()}</div>
                    </div>
                  </div>

                  {/* Parametric Triggers */}
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400 mb-3">Parametric Triggers</div>
                    <div className="space-y-2">
                      <div className="glass rounded-xl p-4 border-l-2 border-l-rose-500">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-2 h-2 rounded-full bg-rose-500" />
                          <span className="text-sm font-medium text-white">Earthquake</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="text-slate-400">Min Magnitude: <span className="text-white font-mono">{policy.triggers.earthquake.min_magnitude}</span></div>
                          <div className="text-slate-400">Pop. Threshold: <span className="text-white font-mono">{policy.triggers.earthquake.population_threshold.toLocaleString()}</span></div>
                        </div>
                      </div>

                      <div className="glass rounded-xl p-4 border-l-2 border-l-amber-500">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-2 h-2 rounded-full bg-amber-500" />
                          <span className="text-sm font-medium text-white">Fire / Volcano</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="text-slate-400">Persistence: <span className="text-white font-mono">{policy.triggers.fire.persistence_hours}h</span></div>
                          <div className="text-slate-400">Thermal Anomaly: <span className="text-white font-mono">{policy.triggers.fire.thermal_anomaly ? "Required" : "Optional"}</span></div>
                        </div>
                      </div>

                      <div className="glass rounded-xl p-4 border-l-2 border-l-purple-500">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-2 h-2 rounded-full bg-purple-500" />
                          <span className="text-sm font-medium text-white">Storm / Hurricane</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="text-slate-400">Min Category: <span className="text-white font-mono">{policy.triggers.storm.min_category}</span></div>
                          <div className="text-slate-400">Evacuation Order: <span className="text-white font-mono">{policy.triggers.storm.evacuation_order ? "Required" : "Optional"}</span></div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* AI Config */}
                  <div className="glass rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Cpu size={14} className="text-neon" />
                      <span className="text-[10px] uppercase tracking-[0.2em] text-slate-400">AI Configuration</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="text-slate-400">Model: <span className="text-white font-mono">{policy.ai_model}</span></div>
                      <div className="text-slate-400">Min Confidence: <span className="text-white font-mono">{policy.ai_confidence_threshold}%</span></div>
                    </div>
                  </div>

                  {/* Data Sources */}
                  <div className="glass rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Database size={14} className="text-sky-400" />
                      <span className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Data Sources</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {policy.data_sources.map((src) => (
                        <span key={src} className="px-2 py-1 rounded-lg bg-sky-500/10 text-sky-300 text-xs font-mono">{src}</span>
                      ))}
                    </div>
                  </div>

                  {/* High Risk Zones */}
                  <div className="glass rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <MapPin size={14} className="text-rose-400" />
                      <span className="text-[10px] uppercase tracking-[0.2em] text-slate-400">High Risk Zones</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {policy.high_risk_zones.map((zone) => (
                        <span key={zone} className="px-2 py-1 rounded-lg bg-rose-500/10 text-rose-300 text-xs">{zone}</span>
                      ))}
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
