import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, MapPin, Users, CheckCircle, X, ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";

type NGO = {
  id: string;
  name: string;
  address: string;
  disaster_types: string[];
  regions: string[];
  description: string;
  region_match: boolean;
  is_ingo: boolean;
};

type DisasterAlert = {
  id: string;
  disaster_type: string;
  description: string;
  location: [number, number];
  severity?: string;
  timestamp: string;
  eligible_ngos: NGO[];
  selected_ngo: {
    id: string;
    name: string;
    address: string;
    reason: string;
  } | null;
  payout_amount?: string;
  tx_hash?: string;
};

type Props = {
  alert: DisasterAlert | null;
  onClose: () => void;
  apiUrl: string;
};

function getRegionName(lat: number, lon: number): string {
  if (10 <= lat && lat <= 50 && 100 <= lon && lon <= 150) return "Asia-Pacific";
  if (25 <= lat && lat <= 50 && -130 <= lon && lon <= -65) return "North America";
  if (25 <= lat && lat <= 50 && -100 <= lon && lon <= -70) return "United States";
  return "Global";
}

export function DisasterAlert({ alert, onClose, apiUrl }: Props) {
  const [showFullList, setShowFullList] = useState(false);

  if (!alert) return null;

  const regionName = getRegionName(alert.location[0], alert.location[1]);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm pointer-events-none">
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          transition={{ duration: 0.3 }}
          className="glass w-full max-w-2xl rounded-2xl border border-rose-500/30 bg-[#0b0b0f]/95 shadow-2xl p-6 pointer-events-auto relative"
        >
          <button
            onClick={onClose}
            className="absolute right-4 top-4 rounded-full p-1 text-slate-400 hover:bg-white/10 hover:text-white transition"
            aria-label="Close alert"
          >
            <X size={20} />
          </button>

          {/* Header */}
          <div className="flex items-start gap-4 mb-6">
            <div className="p-3 rounded-xl glass bg-rose-500/10">
              <AlertTriangle className="text-rose-400" size={24} />
            </div>
            <div className="flex-1">
              <div className="text-[10px] uppercase tracking-[0.2em] text-rose-400 mb-1">
                {alert.payout_amount ? "PAYMENT RECEIPT" : "DISASTER DETECTED"}
              </div>
              <h2 className="text-xl font-bold text-white mb-2">{alert.description}</h2>
              {alert.payout_amount && (
                <div className="text-sm text-emerald-300 font-mono mb-2">
                  ${Number(alert.payout_amount).toLocaleString()} USDC Disbursed
                </div>
              )}
              <div className="flex items-center gap-4 text-xs text-slate-400">
                <div className="flex items-center gap-1">
                  <MapPin size={12} />
                  <span>{regionName} ({alert.location[0].toFixed(2)}°, {alert.location[1].toFixed(2)}°)</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="capitalize">{alert.disaster_type}</span>
                  {alert.severity && (
                    <>
                      <span>•</span>
                      <span className="text-rose-300">{alert.severity}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Selected NGO */}
          {alert.selected_ngo && (
            <div className="mb-4 p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="text-emerald-400" size={16} />
                <span className="text-xs uppercase tracking-[0.2em] text-emerald-300">
                  SELECTED RECIPIENT
                </span>
              </div>
              <div className="text-sm font-semibold text-white mb-1">{alert.selected_ngo.name}</div>
              <div className="text-xs text-slate-300 font-mono mb-2">{alert.selected_ngo.address}</div>
              <div className="text-xs text-slate-400">{alert.selected_ngo.reason}</div>
            </div>
          )}

          {/* Eligible NGOs List */}
          <div className="mb-4">
            <button
              onClick={() => setShowFullList(!showFullList)}
              className="flex items-center gap-2 text-xs uppercase tracking-wider text-slate-400 hover:text-white transition mb-3"
            >
              <Users size={14} />
              <span>
                {alert.eligible_ngos.length} Verified {alert.eligible_ngos.length === 1 ? "NGO" : "NGOs"} Eligible
              </span>
              <span className="ml-auto">{showFullList ? "▼" : "▶"}</span>
            </button>

            <AnimatePresence>
              {showFullList && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="space-y-2 max-h-64 overflow-y-auto"
                >
                  {alert.eligible_ngos.map((ngo) => (
                    <div
                      key={ngo.id}
                      className={`p-3 rounded-lg border ${
                        alert.selected_ngo?.id === ngo.id
                          ? "border-emerald-500/50 bg-emerald-500/5"
                          : "border-white/5 bg-white/5"
                      }`}
                    >
                      <div className="flex items-start justify-between mb-1">
                        <div className="flex-1">
                          <div className="text-sm font-medium text-white">{ngo.name}</div>
                          {ngo.is_ingo && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 mr-2">
                              INGO
                            </span>
                          )}
                          {!ngo.is_ingo && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300">
                              NGO
                            </span>
                          )}
                        </div>
                        {alert.selected_ngo?.id === ngo.id && (
                          <CheckCircle className="text-emerald-400" size={16} />
                        )}
                      </div>
                      <div className="text-xs text-slate-400 font-mono mb-2">{ngo.address}</div>
                      <div className="text-xs text-slate-500">{ngo.description}</div>
                      <div className="flex items-center gap-2 mt-2 text-[10px] text-slate-500">
                        <span>Regions: {ngo.regions.join(", ")}</span>
                        {ngo.region_match && (
                          <span className="text-emerald-400">• Region Match</span>
                        )}
                      </div>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Transaction Hash */}
          {alert.tx_hash && (
            <div className="mb-4 p-3 rounded-lg border border-sky-500/30 bg-sky-500/10">
              <div className="text-[10px] uppercase tracking-[0.2em] text-sky-300 mb-1">Transaction Hash</div>
              <div className="text-xs font-mono text-sky-200 break-all">{alert.tx_hash}</div>
            </div>
          )}

          {/* Footer */}
          <div className="text-[10px] text-slate-500 text-center pt-4 border-t border-white/5">
            {alert.payout_amount 
              ? "Payment processed autonomously • Funds transferred to verified NGO"
              : "Automation proceeding autonomously • No human approval required"}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
