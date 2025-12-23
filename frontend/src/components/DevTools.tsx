import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { BugPlay, Flame, Activity, Wind, Volume2, VolumeX, Keyboard } from "lucide-react";
import { soundEngine } from "../utils/sounds";

type Props = {
  onTrigger: (scenario: "quake" | "fire" | "storm") => void;
};

export function DevTools({ onTrigger }: Props) {
  const [open, setOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const toggleSound = () => {
    const newState = !soundEnabled;
    setSoundEnabled(newState);
    soundEngine.setEnabled(newState);
    if (newState) soundEngine.play("success");
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="glass flex items-center gap-2 rounded-full px-4 py-2 text-sm text-white transition hover:border-neon/70 hover:text-neon"
        aria-label="Toggle dev tools"
      >
        <BugPlay size={16} />
        Dev Tools
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.18 }}
            className="glass mt-2 w-64 rounded-2xl border border-white/10 p-3 shadow-xl absolute bottom-full right-0 mb-2"
          >
            <div className="mb-2 text-xs uppercase tracking-[0.15em] text-emerald-300">Simulate Disaster</div>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => { onTrigger("quake"); setOpen(false); }}
                className="glass flex items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm hover:border-rose-400/70 hover:text-rose-200 transition group"
                aria-label="Trigger earthquake simulation"
              >
                <Activity size={16} className="text-rose-400" />
                <span className="flex-1">Trigger: Quake</span>
                <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-slate-500 group-hover:text-rose-300">1</kbd>
              </button>
              <button
                onClick={() => { onTrigger("fire"); setOpen(false); }}
                className="glass flex items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm hover:border-amber-400/70 hover:text-amber-200 transition group"
                aria-label="Trigger fire/volcano simulation"
              >
                <Flame size={16} className="text-amber-400" />
                <span className="flex-1">Trigger: Fire</span>
                <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-slate-500 group-hover:text-amber-300">2</kbd>
              </button>
              <button
                onClick={() => { onTrigger("storm"); setOpen(false); }}
                className="glass flex items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm hover:border-purple-400/70 hover:text-purple-200 transition group"
                aria-label="Trigger storm/hurricane simulation"
              >
                <Wind size={16} className="text-purple-400" />
                <span className="flex-1">Trigger: Storm</span>
                <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-slate-500 group-hover:text-purple-300">3</kbd>
              </button>
            </div>

            <div className="mt-3 pt-3 border-t border-white/5">
              <div className="mb-2 text-xs uppercase tracking-[0.15em] text-slate-500">Settings</div>
              <button
                onClick={toggleSound}
                className="glass flex items-center gap-2 rounded-xl px-3 py-2 text-left text-sm w-full hover:border-white/20 transition"
                aria-label={soundEnabled ? "Disable sounds" : "Enable sounds"}
              >
                {soundEnabled ? (
                  <Volume2 size={14} className="text-emerald-400" />
                ) : (
                  <VolumeX size={14} className="text-slate-400" />
                )}
                <span className="text-slate-300">{soundEnabled ? "Sound On" : "Sound Off"}</span>
              </button>
            </div>

            <div className="mt-2 text-[10px] text-slate-500 flex items-center gap-1">
              <Keyboard size={10} />
              Press 1, 2, or 3 to quick-trigger
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
