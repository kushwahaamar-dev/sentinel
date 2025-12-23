import { useMemo, useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GlobeView } from "./components/GlobeView";
import { CommandLog } from "./components/CommandLog";
import { DevTools } from "./components/DevTools";
import { EventDetailCard } from "./components/EventDetailCard";
import { WalletConnect } from "./components/WalletConnect";
import { StatsPanel } from "./components/StatsPanel";
import { HistoryPanel } from "./components/HistoryPanel";
import { PolicyViewer } from "./components/PolicyViewer";
import { SourceStatus } from "./components/SourceStatus";
import { ModeToggle } from "./components/ModeToggle";
import { ToastContainer, createToast, ToastType } from "./components/Toast";
import { DisasterAlert } from "./components/DisasterAlert";
import { soundEngine } from "./utils/sounds";
import { ShieldCheck, Loader2, ExternalLink, RefreshCw } from "lucide-react";

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

type Decision = {
  decision: "PAYOUT" | "DENY";
  confidence_score: number;
  reasoning: string;
  payout_amount_usdc: string;
  tx_hash?: string;
};

type Toast = {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
};

// Use environment variable for production, fallback to localhost for development
const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
const ETHERSCAN_BASE = "https://etherscan.io/tx/";
const SOLSCAN_BASE = "https://solscan.io/tx/";

export default function App() {
  const [events, setEvents] = useState<SentinelEvent[]>([]);
  const [logs, setLogs] = useState<{ text: string; status?: "ok" | "warn" | "fail" }[]>([]);
  const [processing, setProcessing] = useState(false);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [vaultBalance, setVaultBalance] = useState(10000);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<SentinelEvent | null>(null);
  const [mode, setMode] = useState<"LIVE" | "MOCK" | "UNKNOWN">("UNKNOWN");
  const [liveBooted, setLiveBooted] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [lastPollTime, setLastPollTime] = useState<Date | null>(null);
  const [disasterAlert, setDisasterAlert] = useState<any>(null);
  const [processedEventIds, setProcessedEventIds] = useState<Set<string>>(new Set());

  const addToast = useCallback((type: ToastType, message: string) => {
    setToasts(prev => [...prev, createToast(type, message)]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const logLine = useCallback((text: string, status?: "ok" | "warn" | "fail") => {
    setLogs((prev) => {
      // Dedupe: don't add if this exact log already exists
      const exists = prev.some(l => l.text === text);
      if (exists) return prev;
      return [...prev.slice(-15), { text, status }];
    });
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (mode !== "MOCK") return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      switch (e.key) {
        case "1":
          triggerScenario("quake");
          break;
        case "2":
          triggerScenario("fire");
          break;
        case "3":
          triggerScenario("storm");
          break;
      }
    };
    
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mode]);

  // Initial connection log + User Location
  useEffect(() => {
    logLine("SYSTEM: INITIALIZING UNIVERSAL SENTINEL...", "ok");
    soundEngine.play("scan");
    
    // Check backend health
    fetch(`${API_URL}/status`)
      .then(res => res.json())
      .then(data => {
        setMode(data.mode === "LIVE" ? "LIVE" : "MOCK");
        setVaultBalance(data.vault_balance || 10000);
        logLine(`BACKEND: ONLINE [${data.mode}]`, "ok");
        soundEngine.play("success");
        addToast("success", `Connected to backend in ${data.mode} mode`);
        if (data.mode === "MOCK") {
           logLine("NOTE: USING MOCK SCENARIOS (NO API KEYS)", "warn");
        }
      })
      .catch(() => {
        logLine("CRITICAL: BACKEND DISCONNECTED", "fail");
        soundEngine.play("error");
        addToast("error", "Failed to connect to backend server");
      });

    // Get User Location
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((pos) => {
            const { latitude, longitude } = pos.coords;
            setUserLocation({ lat: latitude, lng: longitude });
            logLine(`GPS: ACQUIRED HOST LOCATION [${latitude.toFixed(2)}, ${longitude.toFixed(2)}]`, "ok");
        }, (err) => {
            logLine(`GPS: SIGNAL LOST (${err.message}) - DEFAULTING TO GLOBAL VIEW`, "warn");
        });
    }

  }, [logLine, addToast]);

  // LIVE mode: poll backend for real disasters and plot them
  useEffect(() => {
    if (mode !== "LIVE") return;

    let cancelled = false;
    let previousEventCount = events.length;

    const mapEventType = (dtRaw: string): SentinelEvent["type"] => {
      const dt = (dtRaw || "").toLowerCase();
      if (dt.includes("earth") || dt.includes("quake") || dt === "eq") return "earthquake";
      if (dt.includes("volcano") || dt.includes("wildfire") || dt.includes("fire")) return "fire";
      if (dt.includes("flood") || dt === "fl" || dt.includes("storm") || dt.includes("cyclone") || dt.includes("typhoon") || dt.includes("hurricane") || dt === "ts") return "storm";
      return "storm";
    };

    const pull = async () => {
      try {
        const res = await fetch(`${API_URL}/live/ingest`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        if (cancelled) return;

        setLastPollTime(new Date());

        if (!liveBooted) {
          logLine("LIVE FEED: LOCKED ON", "ok");
          setLiveBooted(true);
          addToast("success", "Live data feed connected");
        }

        // Add source status logs (GDACS/EONET/NWS)
        if (Array.isArray(data.logs)) {
          for (const line of data.logs) {
            const hasError = String(line).includes("Signal Lost") || String(line).includes("Unauthorized");
            logLine(String(line), hasError ? "fail" : "ok");
          }
        }

        const incoming: SentinelEvent[] = (data.events || []).map((e: any) => ({
          id: e.id,
          lat: e.location?.[0],
          lon: e.location?.[1],
          type: mapEventType(e.disaster_type),
          label: (e.description || e.raw?.title || "Event").slice(0, 32) + ((e.description || "").length > 32 ? "..." : ""),
          rawData: e.raw,
          source: e.source,
          disaster_type: e.disaster_type,
          description: e.description,
        }));

        // Merge by id (dedupe) and check for new events
        setEvents((prev) => {
          const map = new Map(prev.map((x) => [x.id, x]));
          const newEvents: SentinelEvent[] = [];
          
          for (const ev of incoming) {
            if (!map.has(ev.id)) {
              newEvents.push(ev);
            }
            map.set(ev.id, { ...map.get(ev.id), ...ev });
          }
          
          // For new disasters in LIVE mode, just notify (don't show pop-up unless there's a payout)
          if (newEvents.length > 0 && mode === "LIVE") {
            soundEngine.play("alert");
            addToast("warning", `${newEvents.length} new disaster event${newEvents.length > 1 ? "s" : ""} detected!`);
            // Note: Pop-up will only show after actual payout via handleAnalysisComplete
          }
          
          return Array.from(map.values()).slice(-30);
        });
      } catch (e: any) {
        if (cancelled) return;
        logLine(`LIVE FEED: SIGNAL LOST (${e?.message || "unknown"})`, "fail");
      }
    };

    // immediate + interval
    pull();
    const t = window.setInterval(pull, 30000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, [mode, liveBooted, logLine, addToast, processedEventIds]);

  const refreshStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/statistics`);
      if (res.ok) {
        const stats = await res.json();
        setVaultBalance(stats.vault_balance || 10000);
        return stats;
      }
    } catch (e) {
      console.error("Failed to refresh stats:", e);
    }
    return null;
  }, []);

  const triggerScenario = async (scenario: "quake" | "fire" | "storm") => {
    setProcessing(true);
    setDecision(null);
    soundEngine.play("scan");
    logLine(`COMMAND: INITIATING SCENARIO [${scenario.toUpperCase()}]...`, "warn");
    addToast("info", `Triggering ${scenario} simulation...`);

    try {
      const res = await fetch(`${API_URL}/simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario_type: scenario }),
      });
      
      if (!res.ok) throw new Error("Simulation failed");
      
      const data = await res.json();
      
      // Process results
      if (data.results && data.results.length > 0) {
        const result = data.results[0];
        const evt = result.event;
        const ai = result.ai_decision;

        const dt = String(evt.disaster_type || "").toLowerCase();
        const eventType: SentinelEvent["type"] =
          dt.includes("earth") || dt.includes("quake") ? "earthquake" :
          dt.includes("volcano") || dt.includes("wildfire") || dt.includes("fire") ? "fire" :
          "storm";

        soundEngine.play("alert");

        // 1. Plot Event
        const newEvent: SentinelEvent = {
            id: `evt-${Date.now()}`,
            lat: evt.location[0],
            lon: evt.location[1],
            type: eventType,
            label: evt.description.substring(0, 28) + "...",
            rawData: evt.raw,
            source: evt.source,
            disaster_type: evt.disaster_type,
            description: evt.description,
        };
        setEvents(prev => [...prev.filter(e => !e.id.startsWith("evt-")), newEvent]);
        logLine(`SENSOR: DETECTED ${evt.disaster_type.toUpperCase()} AT [${evt.location[0].toFixed(2)}, ${evt.location[1].toFixed(2)}]`, "warn");
        addToast("warning", `${eventType.charAt(0).toUpperCase() + eventType.slice(1)} detected!`);

        // 2. Artificial Delay for "Thinking"
        setTimeout(() => {
             logLine("AI: ANALYZING SATELLITE TELEMETRY...", "ok");
        }, 800);

        setTimeout(() => {
             logLine("AI: CROSS-REFERENCING POPULATION DATA...", "ok");
        }, 1600);

        setTimeout(async () => {
            setDecision(ai);
            if (ai.decision === "PAYOUT") {
                soundEngine.play("payout");
                logLine(`DECISION: PAYOUT APPROVED ($${ai.payout_amount_usdc} USDC)`, "ok");
                addToast("success", `Payout of $${Number(ai.payout_amount_usdc).toLocaleString()} approved!`);
                
                // Refresh stats from backend to get NGO info and accurate balance
                const stats = await refreshStats();
                if (stats) {
                  setVaultBalance(stats.vault_balance);
                  
                  // Show disaster alert pop-up with payment receipt and NGO info (MOCK mode)
                  if (stats.last_payout && mode === "MOCK") {
                    // Fetch eligible NGOs for this disaster
                    fetch(`${API_URL}/ngos/eligible`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        disaster_type: evt.disaster_type,
                        location: [evt.location[0], evt.location[1]],
                        severity: evt.raw?.severity,
                      }),
                    })
                      .then(res => res.json())
                      .then(ngoData => {
                        // Show pop-up after a short delay (2 seconds after payout)
                        setTimeout(() => {
                          setDisasterAlert({
                            id: newEvent.id,
                            disaster_type: evt.disaster_type,
                            description: evt.description,
                            location: [evt.location[0], evt.location[1]],
                            severity: evt.raw?.severity,
                            timestamp: stats.last_payout.timestamp,
                            eligible_ngos: ngoData.eligible || [],
                            selected_ngo: {
                              id: ngoData.selected?.id || "",
                              name: stats.last_payout.ngo_name,
                              address: stats.last_payout.ngo_address,
                              reason: ngoData.selected?.reason || "Selected based on region match and disaster type support"
                            },
                            payout_amount: ai.payout_amount_usdc,
                            tx_hash: ai.tx_hash,
                          });
                        }, 2000);
                      })
                      .catch(err => {
                        console.error("Failed to fetch eligible NGOs:", err);
                        // Still show pop-up with basic info
                        setTimeout(() => {
                          setDisasterAlert({
                            id: newEvent.id,
                            disaster_type: evt.disaster_type,
                            description: evt.description,
                            location: [evt.location[0], evt.location[1]],
                            severity: evt.raw?.severity,
                            timestamp: stats.last_payout.timestamp,
                            eligible_ngos: [],
                            selected_ngo: {
                              id: "",
                              name: stats.last_payout.ngo_name,
                              address: stats.last_payout.ngo_address,
                              reason: "Selected based on region match and disaster type support"
                            },
                            payout_amount: ai.payout_amount_usdc,
                            tx_hash: ai.tx_hash,
                          });
                        }, 2000);
                      });
                  }
                } else {
                  // Fallback
                  setVaultBalance(v => Math.max(0, v - parseFloat(ai.payout_amount_usdc)));
                }
                
                if (ai.tx_hash) {
                    logLine(`BLOCKCHAIN: TX CONFIRMED ${ai.tx_hash.substring(0, 10)}...`, "ok");
                    setEvents(prev => prev.map(e => e.id === newEvent.id ? { ...e, txHash: ai.tx_hash } : e));
                }
            } else {
                soundEngine.play("error");
                logLine("DECISION: PAYOUT DENIED - THRESHOLD NOT MET", "fail");
                addToast("error", "Payout denied - parametric threshold not met");
            }
            setProcessing(false);
        }, 2500);

    } else {
        logLine("SCAN: NO EVENTS FOUND FOR SCENARIO", "warn");
        addToast("warning", "No events found for this scenario");
        setProcessing(false);
      }

    } catch (e) {
      console.error(e);
      soundEngine.play("error");
      logLine("SYSTEM: ERROR CONNECTING TO BACKEND", "fail");
      addToast("error", "Failed to connect to backend");
      setProcessing(false);
    }
  };

  const statusColor = useMemo(() => {
    if (!decision) return "text-slate-200";
    return decision.decision === "PAYOUT" ? "text-emerald-300" : "text-rose-300";
  }, [decision]);

  const handleAnalysisComplete = useCallback(async (result: Decision) => {
    setDecision(result);
    if (result.decision === "PAYOUT") {
      // Refresh stats from backend to get NGO info and accurate balance
      const stats = await refreshStats();
      if (stats) {
        setVaultBalance(stats.vault_balance);
        
        // Show disaster alert pop-up with payment receipt and NGO info
        if (stats.last_payout && selectedEvent) {
          // Fetch eligible NGOs for this disaster
          fetch(`${API_URL}/ngos/eligible`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              disaster_type: selectedEvent.disaster_type || selectedEvent.type,
              location: [selectedEvent.lat, selectedEvent.lon],
              severity: selectedEvent.rawData?.severity,
            }),
          })
            .then(res => res.json())
            .then(ngoData => {
              // Show pop-up after a short delay (2 seconds after payout)
              setTimeout(() => {
                setDisasterAlert({
                  id: selectedEvent.id,
                  disaster_type: selectedEvent.disaster_type || selectedEvent.type,
                  description: selectedEvent.description || selectedEvent.label,
                  location: [selectedEvent.lat, selectedEvent.lon],
                  severity: selectedEvent.rawData?.severity,
                  timestamp: stats.last_payout.timestamp,
                  eligible_ngos: ngoData.eligible || [],
                  selected_ngo: {
                    id: ngoData.selected?.id || "",
                    name: stats.last_payout.ngo_name,
                    address: stats.last_payout.ngo_address,
                    reason: ngoData.selected?.reason || "Selected based on region match and disaster type support"
                  },
                  payout_amount: result.payout_amount_usdc,
                  tx_hash: result.tx_hash,
                });
              }, 2000);
            })
            .catch(err => {
              console.error("Failed to fetch eligible NGOs:", err);
              // Still show pop-up with basic info
              setTimeout(() => {
                setDisasterAlert({
                  id: selectedEvent.id,
                  disaster_type: selectedEvent.disaster_type || selectedEvent.type,
                  description: selectedEvent.description || selectedEvent.label,
                  location: [selectedEvent.lat, selectedEvent.lon],
                  severity: selectedEvent.rawData?.severity,
                  timestamp: stats.last_payout.timestamp,
                  eligible_ngos: [],
                  selected_ngo: {
                    id: "",
                    name: stats.last_payout.ngo_name,
                    address: stats.last_payout.ngo_address,
                    reason: "Selected based on region match and disaster type support"
                  },
                  payout_amount: result.payout_amount_usdc,
                  tx_hash: result.tx_hash,
                });
              }, 2000);
            });
        }
      } else {
        // Fallback to local calculation
        setVaultBalance(v => Math.max(0, v - parseFloat(result.payout_amount_usdc)));
      }
      
      if (result.tx_hash && selectedEvent) {
        setEvents(prev => prev.map(e => 
          e.id === selectedEvent.id ? { ...e, txHash: result.tx_hash } : e
        ));
      }
    }
  }, [selectedEvent, refreshStats]);

  const handleModeChange = useCallback((newMode: "LIVE" | "MOCK") => {
    setMode(newMode);
    setEvents([]);
    setLiveBooted(false);
    setDisasterAlert(null); // Clear any existing pop-up when switching modes
    setProcessedEventIds(new Set()); // Reset processed events
    logLine(`MODE SWITCHED TO: ${newMode}`, "ok");
    addToast("info", `Switched to ${newMode} mode`);
    soundEngine.play("success");
    
    // Refresh status
    fetch(`${API_URL}/status`)
      .then(res => res.json())
      .then(data => {
        setVaultBalance(data.vault_balance || 10000);
      })
      .catch(() => {});
  }, [logLine, addToast]);

  // Poll for logs regularly to show NGO info and other backend logs (only new ones)
  useEffect(() => {
    let lastLogCount = 0;
    
    const pollLogs = async () => {
      try {
        const res = await fetch(`${API_URL}/status`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.logs) && data.logs.length > 0) {
            // Only add new logs (logs that appeared since last poll)
            const newLogs = data.logs.slice(lastLogCount);
            lastLogCount = data.logs.length;
            
            if (newLogs.length > 0) {
              setLogs(prev => {
                const existing = new Set(prev.map(l => l.text));
                const uniqueNewLogs = newLogs
                  .filter((l: any) => !existing.has(l.text))
                  .map((l: any) => ({ text: l.text, status: l.status || "ok" }));
                return [...prev, ...uniqueNewLogs].slice(-30); // Keep last 30 logs
              });
            }
          }
        }
      } catch (e) {
        // Silently fail
      }
    };

    // Poll every 3 seconds for logs (less frequent to reduce noise)
    const interval = setInterval(pollLogs, 3000);
    // Initial poll after a delay
    setTimeout(pollLogs, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-ocean text-gray-100 font-mono">
      {/* Top Navigation Bar */}
      <div className="fixed top-0 left-0 right-0 z-40 glass border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldCheck className="text-neon h-6 w-6" />
            <div>
              <div className="text-sm font-semibold text-white">Universal Sentinel</div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400">
                Autonomous Parametric Insurance
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Mode Toggle - Prominent position */}
            <ModeToggle mode={mode} onModeChange={handleModeChange} apiUrl={API_URL} />
            
            <div className="w-px h-6 bg-white/10 mx-1" />
            
            <StatsPanel apiUrl={API_URL} />
            <HistoryPanel apiUrl={API_URL} />
            <PolicyViewer apiUrl={API_URL} />
          </div>
        </div>
      </div>

      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 pt-20 pb-6 lg:flex-row h-[calc(100vh-5rem)] relative z-10">
        {/* Left Panel: Globe */}
        <div className="w-full lg:w-8/12 h-full relative flex-1">
          <div className="absolute top-4 left-4 z-10 pointer-events-none">
             <div className="text-xs uppercase tracking-[0.2em] text-emerald-300 mb-1">Live Feed</div>
             <div className="text-2xl font-bold text-white tracking-tighter">GLOBAL MONITORING</div>
             {lastPollTime && mode === "LIVE" && (
               <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
                 <RefreshCw size={10} />
                 Last update: {lastPollTime.toLocaleTimeString()}
               </div>
             )}
          </div>
          <GlobeView 
            events={events} 
            userLocation={userLocation} 
            onEventClick={(ev) => setSelectedEvent(ev)} 
          />
        </div>

        {/* Right Panel: HUD */}
        <div className="flex w-full flex-col gap-4 lg:w-4/12 overflow-y-auto pb-4">
          
          {/* Header Card */}
          <div className="glass rounded-2xl border border-white/10 p-5">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="glass rounded-xl p-4 border-l-2 border-l-emerald-500">
                <div className="text-[10px] uppercase tracking-[0.1em] text-slate-400">Vault USDC</div>
                <div className="text-2xl font-mono text-white">${vaultBalance.toLocaleString()}</div>
              </div>
              <div className="glass rounded-xl p-4 border-l-2 border-l-purple-500">
                <div className="text-[10px] uppercase tracking-[0.1em] text-slate-400">Status</div>
                <div className="text-lg font-mono text-white truncate">
                  {processing ? (
                    <span className="flex items-center gap-2">
                      <Loader2 size={14} className="animate-spin" />
                      SCANNING
                    </span>
                  ) : "ACTIVE"}
              </div>
              </div>
            </div>

            {/* AI Decision Card */}
            <div className="mt-5">
              <div className="text-xs uppercase tracking-[0.2em] text-emerald-300 mb-2">AI Assessment</div>
              <div className="glass rounded-xl border border-white/10 p-4 relative overflow-hidden">
                {processing && <div className="absolute inset-0 bg-emerald-500/5 animate-pulse" />}
                
                <div className={`text-xl font-bold ${statusColor} mb-2`}>
                  {processing ? "PROCESSING..." : decision ? decision.decision : "AWAITING SIGNAL"}
                </div>
                
                <div className="text-sm text-slate-300 leading-relaxed min-h-[50px]">
                  {processing ? (
                    <div className="flex items-center gap-2">
                       <Loader2 className="h-4 w-4 animate-spin text-neon" />
                       <span className="text-neon">Gemini 1.5 Flash analyzing data...</span>
                    </div>
                  ) : decision?.reasoning || "System standing by for telemetry."}
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="glass rounded-lg p-2 text-slate-200">
                    <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Confidence</div>
                    <div className="text-lg font-mono">{decision ? `${decision.confidence_score}%` : "--"}</div>
                  </div>
                  <div className="glass rounded-lg p-2 text-slate-200">
                    <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Payout</div>
                    <div className="text-lg font-mono">
                      {decision && decision.decision === "PAYOUT" ? `$${Number(decision.payout_amount_usdc).toLocaleString()}` : "--"}
                    </div>
                  </div>
                </div>

                {decision?.tx_hash && (
                  <div className="mt-3 pt-3 border-t border-white/10">
                    <a
                      className="flex items-center gap-2 text-xs text-neon hover:text-white transition-colors group"
                      href={`${decision.tx_hash.startsWith("0x") ? ETHERSCAN_BASE : SOLSCAN_BASE}${decision.tx_hash}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <span>VIEW RECEIPT</span>
                      <ExternalLink size={12} className="group-hover:translate-x-0.5 transition-transform" />
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Source Status - Only in LIVE mode */}
          {mode === "LIVE" && <SourceStatus apiUrl={API_URL} mode={mode} />}

          <CommandLog items={logs} />
        </div>
      </div>

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <AnimatePresence>
        {selectedEvent && (
            <EventDetailCard 
              event={selectedEvent} 
              onClose={() => setSelectedEvent(null)} 
              mode={mode}
              apiUrl={API_URL}
              onAnalysisComplete={handleAnalysisComplete}
            />
        )}
      </AnimatePresence>

      {/* Disaster Detection Alert (LIVE mode and after MOCK payouts) */}
      {disasterAlert && (
        <DisasterAlert
          alert={disasterAlert}
          onClose={() => setDisasterAlert(null)}
          apiUrl={API_URL}
        />
      )}

      <WalletConnect mode={mode} log={logLine} />
      {mode === "MOCK" && <DevTools onTrigger={triggerScenario} />}
    </div>
  );
}
