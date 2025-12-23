import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Wallet, ExternalLink, Send, X } from "lucide-react";
import { Connection, PublicKey, SystemProgram, Transaction, clusterApiUrl, LAMPORTS_PER_SOL } from "@solana/web3.js";

declare global {
  interface Window {
    solana?: any;
  }
}

type Props = {
  mode: "LIVE" | "MOCK" | string;
  log: (text: string, status?: "ok" | "warn" | "fail") => void;
};

const TREASURY = new PublicKey("7YjQpS2jV4t8q2iFfQ7q8p4vNnZbUoY7c6uQhXcVf7mG"); // demo treasury

export function WalletConnect({ mode, log }: Props) {
  const [open, setOpen] = useState(false);
  const [prompted, setPrompted] = useState(false);
  const [connected, setConnected] = useState(false);
  const [pubkey, setPubkey] = useState<string | null>(null);
  const [amount, setAmount] = useState(0.05);
  const [sending, setSending] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);

  const phantomAvailable = useMemo(() => Boolean(window.solana?.isPhantom), []);

  // In LIVE mode, prompt once automatically (seamless demo UX)
  useEffect(() => {
    if (mode === "LIVE" && !prompted) {
      setOpen(true);
      setPrompted(true);
      log("LIVE MODE: CONNECT PHANTOM TO FUND THE POOL", "warn");
    }
  }, [mode, prompted, log]);

  const connect = async () => {
    if (!phantomAvailable) {
      log("PHANTOM: NOT DETECTED (install Phantom)", "fail");
        window.open("https://phantom.app/", "_blank");
      return;
    }
    try {
      log("PHANTOM: CONNECTING...", "warn");
      const res = await window.solana.connect();
      const pk = res?.publicKey?.toString?.() ?? window.solana.publicKey?.toString?.();
      setPubkey(pk);
      setConnected(true);
      log(`PHANTOM: CONNECTED [${pk?.slice(0, 4)}…${pk?.slice(-4)}]`, "ok");
    } catch (e: any) {
      log(`PHANTOM: CONNECTION FAILED (${e?.message || "unknown"})`, "fail");
    }
  };

  const donate = async () => {
    if (!connected || !pubkey) {
      log("PHANTOM: CONNECT FIRST", "warn");
      return;
    }

    setSending(true);
    setSignature(null);

    try {
      const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
      const from = new PublicKey(pubkey);
      const lamports = Math.max(0, Math.floor(amount * LAMPORTS_PER_SOL));

      log(`DONATION: PREPARING TRANSFER (${amount} SOL)`, "warn");

      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: from,
          toPubkey: TREASURY,
          lamports,
        })
      );

      tx.feePayer = from;
      const { blockhash } = await connection.getLatestBlockhash("finalized");
      tx.recentBlockhash = blockhash;

      const signed = await window.solana.signAndSendTransaction(tx);
      const sig = signed?.signature;
      if (!sig) throw new Error("Missing signature");

      log(`DONATION: SUBMITTED ${sig.slice(0, 6)}…`, "ok");
      await connection.confirmTransaction(sig, "confirmed");
      log("DONATION: CONFIRMED", "ok");

      setSignature(sig);
    } catch (e: any) {
      log(`DONATION: FAILED (${e?.message || "unknown"})`, "fail");
    } finally {
      setSending(false);
              }
  };

  // Only surface this UX in LIVE mode as requested
  if (mode !== "LIVE") return null;

  return (
    <div className="fixed top-6 right-6 z-50">
      <button
        onClick={() => setOpen(true)}
        aria-label="Open Phantom donation panel"
        className="glass flex items-center gap-2 rounded-full px-4 py-2 text-xs uppercase tracking-wider text-white/90 hover:text-white hover:border-neon/60 transition"
      >
        <Wallet size={14} />
        Phantom Donation
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            className="glass mt-2 w-[360px] rounded-2xl border border-white/10 p-4 shadow-2xl"
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-emerald-300">LIVE FUNDING</div>
                <div className="text-sm font-semibold text-white">Connect Phantom & donate to the pool</div>
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close Phantom donation panel"
                className="rounded-full p-1 text-slate-400 hover:bg-white/10 hover:text-white transition"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mt-3 text-xs text-slate-300">
              Treasury: <span className="font-mono text-emerald-200">{TREASURY.toBase58().slice(0, 4)}…{TREASURY.toBase58().slice(-4)}</span>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={connect}
                aria-label="Connect Phantom wallet"
                className="flex-1 glass rounded-xl border border-white/10 px-3 py-2 text-sm text-white hover:border-neon/50 transition"
              >
                {connected ? "Connected" : "Connect Phantom"}
              </button>
              <button
                onClick={() => window.open("https://phantom.app/", "_blank")}
                aria-label="Open Phantom download page"
                className="glass rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-200 hover:text-white hover:border-white/20 transition"
                title="Get Phantom"
              >
                <ExternalLink size={16} />
              </button>
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-slate-400">
                <span>Donation Amount (SOL)</span>
                <span className="font-mono text-emerald-300">{amount.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={0.01}
                max={0.5}
                step={0.01}
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                aria-label="Donation amount in SOL"
                className="mt-2 w-full"
              />
            </div>

        <button
              disabled={!connected || sending}
              onClick={donate}
              className={`mt-4 w-full flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm transition border ${
                connected && !sending
                  ? "bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border-emerald-500/30"
                  : "bg-white/5 text-slate-500 border-white/10 cursor-not-allowed"
              }`}
            >
              <Send size={14} />
              {sending ? "Sending…" : "Donate"}
        </button>

            {signature && (
              <a
                className="mt-3 flex items-center justify-center gap-2 text-xs text-neon hover:text-white transition"
                href={`https://solscan.io/tx/${signature}?cluster=devnet`}
                target="_blank"
                rel="noreferrer"
              >
                View receipt on Solscan
                <ExternalLink size={12} />
              </a>
            )}

            {pubkey && (
              <div className="mt-3 text-[11px] text-slate-400">
                Wallet: <span className="font-mono text-slate-200">{pubkey.slice(0, 4)}…{pubkey.slice(-4)}</span>
        </div>
      )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
