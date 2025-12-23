import { useState } from "react";
import { motion } from "framer-motion";
import { X, AlertTriangle, Activity, Thermometer, Wind, MapPin, Zap, Loader2, CheckCircle, ExternalLink } from "lucide-react";
import { soundEngine } from "../utils/sounds";

type SentinelEvent = {
  id: string;
  lat: number;
  lon: number;
  type: "earthquake" | "fire" | "storm";
  label: string;
  txHash?: string;
  rawData?: any;
  source?: string;
  disaster_type?: string;
  description?: string;
};

type AnalysisResult = {
  decision: "PAYOUT" | "DENY";
  confidence_score: number;
  reasoning: string;
  payout_amount_usdc: string;
  tx_hash?: string;
};

type Props = {
  event: SentinelEvent;
  onClose: () => void;
  mode: "LIVE" | "MOCK" | string;
  apiUrl: string;
  onAnalysisComplete?: (result: AnalysisResult) => void;
};

export function EventDetailCard({ event, onClose, mode, apiUrl, onAnalysisComplete }: Props) {
  const [showRaw, setShowRaw] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);

  const getIcon = () => {
    switch (event.type) {
      case "earthquake": return <Activity className="text-rose-400" size={24} />;
      case "fire": return <Thermometer className="text-amber-400" size={24} />;
      case "storm": return <Wind className="text-purple-400" size={24} />;
      default: return <AlertTriangle className="text-slate-400" size={24} />;
    }
  };

  const getColor = () => {
    switch (event.type) {
      case "earthquake": return "border-rose-500/50 shadow-rose-900/20";
      case "fire": return "border-amber-500/50 shadow-amber-900/20";
      case "storm": return "border-purple-500/50 shadow-purple-900/20";
      default: return "border-slate-500/50";
    }
  };

  const openExplorer = (tx?: string) => {
    const hash = tx || event.txHash;
    if (!hash) {
      alert("No payout transaction associated with this event yet.");
      return;
    }
    const url = hash.startsWith("0x")
      ? `https://etherscan.io/tx/${hash}`
      : `https://solscan.io/tx/${hash}`;
    window.open(url, "_blank");
  };

  const runAnalysis = async () => {
    setAnalyzing(true);
    soundEngine.play("scan");
    
    try {
      const payload = {
        id: event.id,
        source: event.source || "live",
        disaster_type: event.disaster_type || event.type,
        description: event.description || event.label,
        location: [event.lat, event.lon],
        raw: event.rawData || {},
        severity: event.rawData?.severity || event.rawData?.alert_level || null,
      };

      const res = await fetch(`${apiUrl}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      
      const data = await res.json();
      const aiDecision = data.result?.ai_decision;
      
      if (aiDecision) {
        setAnalysisResult(aiDecision);
        if (aiDecision.decision === "PAYOUT") {
          soundEngine.play("payout");
        } else {
          soundEngine.play("error");
        }
        onAnalysisComplete?.(aiDecision);
      }
    } catch (e) {
      console.error("Analysis failed:", e);
      soundEngine.play("error");
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className={`glass w-full max-w-md overflow-hidden rounded-2xl border ${getColor()} bg-[#0b0b0f]/90 shadow-2xl p-6 relative max-h-[90vh] overflow-y-auto`}
      >
        <button 
          onClick={onClose}
          aria-label="Close event details"
          className="absolute right-4 top-4 rounded-full p-1 text-slate-400 hover:bg-white/10 hover:text-white transition z-10"
        >
          <X size={20} />
        </button>

        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl glass bg-white/5">
            {getIcon()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400 mb-1">Event Detected</div>
            <h2 className="text-xl font-bold text-white leading-tight pr-8">{event.label}</h2>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <div className="glass rounded-lg p-3">
            <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
              <MapPin size={12} />
              LATITUDE
            </div>
            <div className="font-mono text-emerald-300">{event.lat.toFixed(4)}°</div>
          </div>
          <div className="glass rounded-lg p-3">
            <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
              <MapPin size={12} />
              LONGITUDE
            </div>
            <div className="font-mono text-emerald-300">{event.lon.toFixed(4)}°</div>
          </div>
        </div>

        {/* Analysis Result Section */}
        {analysisResult ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mt-4 p-4 rounded-xl border ${
              analysisResult.decision === "PAYOUT" 
                ? "border-emerald-500/30 bg-emerald-500/10" 
                : "border-rose-500/30 bg-rose-500/10"
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              {analysisResult.decision === "PAYOUT" ? (
                <CheckCircle className="text-emerald-400" size={18} />
              ) : (
                <X className="text-rose-400" size={18} />
              )}
              <span className={`text-sm font-bold ${
                analysisResult.decision === "PAYOUT" ? "text-emerald-300" : "text-rose-300"
              }`}>
                {analysisResult.decision === "PAYOUT" ? "PAYOUT APPROVED" : "PAYOUT DENIED"}
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed mb-3">{analysisResult.reasoning}</p>
            <div className="flex items-center justify-between">
              <div className="text-xs text-slate-400">
                Confidence: <span className="text-white font-mono">{analysisResult.confidence_score}%</span>
              </div>
              {analysisResult.decision === "PAYOUT" && (
                <div className="text-sm font-mono text-emerald-300">
                  ${Number(analysisResult.payout_amount_usdc).toLocaleString()} USDC
                </div>
              )}
            </div>
            {analysisResult.tx_hash && (
              <button
                onClick={() => openExplorer(analysisResult.tx_hash)}
                className="mt-3 flex items-center gap-2 text-xs text-neon hover:text-white transition"
              >
                View Transaction <ExternalLink size={12} />
              </button>
            )}
          </motion.div>
        ) : (
          <div className="mt-4 p-4 rounded-xl border border-white/5 bg-black/20">
            <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500 mb-2">Live Analysis</div>
            <p className="text-sm text-slate-300 leading-relaxed">
              {analyzing 
                ? "AI is analyzing telemetry data and cross-referencing with population density maps..."
                : "Click 'Analyze' to run this event through the AI risk assessment pipeline."
              }
            </p>
          </div>
        )}

        <div className="mt-6 flex flex-col gap-2">
          {/* Analyze Button - Only in LIVE mode and not yet analyzed */}
          {mode === "LIVE" && !analysisResult && (
            <button
              onClick={runAnalysis}
              disabled={analyzing}
              className={`w-full flex items-center justify-center gap-2 text-sm uppercase tracking-wider py-3 rounded-lg border transition ${
                analyzing
                  ? "bg-neon/10 text-neon border-neon/30 cursor-wait"
                  : "bg-neon/20 hover:bg-neon/30 text-neon border-neon/30 hover:border-neon/50"
              }`}
            >
              {analyzing ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Zap size={16} />
                  Run AI Analysis
                </>
              )}
            </button>
          )}

          <div className="flex gap-2">
            <button 
              onClick={() => setShowRaw(!showRaw)}
              className="flex-1 bg-white/5 hover:bg-white/10 text-white text-xs uppercase tracking-wider py-3 rounded-lg border border-white/10 transition"
            >
              {showRaw ? "Hide Raw Data" : "Raw Data"}
            </button>
            <button 
              onClick={() => openExplorer()}
              className={`flex-1 text-xs uppercase tracking-wider py-3 rounded-lg border transition ${
                event.txHash || analysisResult?.tx_hash
                  ? "bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border-emerald-500/30 cursor-pointer" 
                  : "bg-white/5 text-slate-500 border-white/5 cursor-not-allowed"
              }`}
            >
              View On-Chain
            </button>
          </div>
        </div>

        {showRaw && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            className="mt-4 p-3 rounded-lg bg-black/40 border border-white/10 font-mono text-[10px] text-slate-300 overflow-auto max-h-40"
          >
            <pre>{JSON.stringify(event.rawData || { error: "No raw data available" }, null, 2)}</pre>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
