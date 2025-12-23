import { useState } from "react";
import { motion } from "framer-motion";
import { Radio, Loader2 } from "lucide-react";

type Props = {
  mode: "LIVE" | "MOCK" | string;
  onModeChange: (newMode: "LIVE" | "MOCK") => void;
  apiUrl: string;
};

export function ModeToggle({ mode, onModeChange, apiUrl }: Props) {
  const [switching, setSwitching] = useState(false);

  const toggleMode = async () => {
    const newMode = mode === "LIVE" ? "MOCK" : "LIVE";
    setSwitching(true);
    
    try {
      const res = await fetch(`${apiUrl}/mode/toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: newMode }),
      });
      
      if (res.ok) {
        onModeChange(newMode);
      }
    } catch (e) {
      console.error("Failed to toggle mode:", e);
    } finally {
      setSwitching(false);
    }
  };

  const isLive = mode === "LIVE";

  return (
    <button
      onClick={toggleMode}
      disabled={switching}
      className="glass flex items-center gap-3 rounded-full px-4 py-2 hover:border-white/20 transition group"
      aria-label={`Switch to ${isLive ? "MOCK" : "LIVE"} mode`}
    >
      <div className="relative">
        {switching ? (
          <Loader2 size={14} className="animate-spin text-slate-400" />
        ) : (
          <Radio size={14} className={isLive ? "text-emerald-400" : "text-amber-400"} />
        )}
      </div>
      
      {/* Toggle Switch */}
      <div 
        className={`relative w-12 h-6 rounded-full transition-colors ${
          isLive ? "bg-emerald-500/30" : "bg-amber-500/30"
        }`}
      >
        <motion.div
          layout
          className={`absolute top-1 w-4 h-4 rounded-full ${
            isLive ? "bg-emerald-400" : "bg-amber-400"
          }`}
          animate={{ left: isLive ? "calc(100% - 20px)" : "4px" }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
        />
      </div>
      
      <div className="text-xs uppercase tracking-wider">
        <span className={isLive ? "text-emerald-300" : "text-amber-300"}>
          {switching ? "Switching..." : mode}
        </span>
      </div>
    </button>
  );
}
