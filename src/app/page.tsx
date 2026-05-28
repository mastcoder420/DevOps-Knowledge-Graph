"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  Server, 
  Terminal as TerminalIcon, 
  Send, 
  Activity, 
  Database, 
  Cpu, 
  Play, 
  RefreshCw, 
  Layers, 
  ShieldAlert,
  Clock
} from "lucide-react";
import { microservices as initialMicroservices, serviceDependencies } from "@/data/incidentData";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function SreDashboard() {
  const [services, setServices] = useState(initialMicroservices);
  const [selectedNode, setSelectedNode] = useState<string | null>("api-gateway");
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: `### 🛰️ SRE WAR ROOM INITIATED
Welcome SRE. I am your generative Diagnostic Copilot. I hold the complete incident history and microservice dependency database in memory.

**Operational Status**: ACTIVE.
Select a **Quick Outage Simulation** below or type an alert message to perform cross-service cascade root-cause analysis (RCA) and generate a mitigation script.`
    }
  ]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [terminalAlerts, setTerminalAlerts] = useState<string[]>([
    "[SYSTEM] War Room console successfully attached to kubernetes cluster namespace: production",
    "[INFO] Streaming metrics telemetry established on web socket channel: #sys-logs",
    "INFO: user-db pg_stat_activity shows 48/50 active client sessions",
    "CRITICAL: user-db aborted transaction due to parallel row locks (Deadlock)"
  ]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  // Live Scrolling alerts simulation
  useEffect(() => {
    const alertTemplates = [
      "CRITICAL: api-gateway latency spiked to 4.2s (Threshold 500ms)",
      "WARN: redis-cache memory utilization is at 98.4%",
      "INFO: user-db pg_stat_activity shows 48/50 active client sessions",
      "WARN: payment-service returned 504 on endpoint /v2/charge",
      "CRITICAL: user-db aborted transaction due to parallel row locks (Deadlock)",
      "INFO: auth-service cluster auto-scaled from 3 to 6 pods successfully",
      "CRITICAL: payment-service rate limit tripped by Stripe API client (HTTP 429)",
      "INFO: Garbage collection executed on redis-cache, freed 142MB allocations",
    ];

    const interval = setInterval(() => {
      const randomAlert = alertTemplates[Math.floor(Math.random() * alertTemplates.length)];
      const timestamp = new Date().toISOString().substring(11, 19);
      setTerminalAlerts(prev => [...prev.slice(-30), `[${timestamp}] ${randomAlert}`]);
    }, 4500);

    return () => clearInterval(interval);
  }, []);

  // Update topology states based on simulated outage
  const triggerSimulation = async (incidentId: string, alertQuery: string) => {
    
    // Determine the cascading failure path to highlight visually
    const updatedServices = initialMicroservices.map(s => {
      if (incidentId === "INC-8021") {
        // DB Pool Exhaustion on user-db
        if (s.id === "user-db") return { ...s, status: "critical" };
        if (s.id === "auth-service") return { ...s, status: "critical" };
        if (s.id === "api-gateway") return { ...s, status: "warning" };
      } else if (incidentId === "INC-3392") {
        // Redis Eviction Storm
        if (s.id === "redis-cache") return { ...s, status: "critical" };
        if (s.id === "auth-service") return { ...s, status: "warning" };
      } else if (incidentId === "INC-4029") {
        // API Gateway 504 Timeout from downstream payment provider
        if (s.id === "api-gateway") return { ...s, status: "critical" };
        if (s.id === "payment-service") return { ...s, status: "warning" };
      } else if (incidentId === "INC-5512") {
        // Auth DB Row Deadlock
        if (s.id === "user-db") return { ...s, status: "critical" };
        if (s.id === "auth-service") return { ...s, status: "critical" };
      } else if (incidentId === "INC-1104") {
        // Stripe Rate Limiting
        if (s.id === "payment-service") return { ...s, status: "critical" };
        if (s.id === "api-gateway") return { ...s, status: "warning" };
      }
      return { ...s, status: "healthy" };
    });

    setServices(updatedServices);
    
    // Add dynamic log to terminal alerts
    const timestamp = new Date().toISOString().substring(11, 19);
    setTerminalAlerts(prev => [
      ...prev,
      `[${timestamp}] 🛑 OUTAGE SIMULATION ACTIVATED: ${incidentId}`,
      `[${timestamp}] CRITICAL: Topology metrics update dispatched to all edge nodes.`
    ]);

    // Send query to Gemini API
    await handleSubmitChat(alertQuery);
  };

  const handleResetTopology = () => {
    setServices(initialMicroservices.map(s => ({ ...s, status: "healthy" })));
    setMessages(prev => [
      ...prev,
      { role: "assistant", content: "♻️ **System topology and metric configurations reset to clean production state.** All node telemetry is reported as HEALTHY." }
    ]);
  };

  const handleSubmitChat = async (customPrompt?: string) => {
    const textToSend = customPrompt || input;
    if (!textToSend.trim()) return;

    if (!customPrompt) setInput("");

    const newMessages: Message[] = [
      ...messages,
      { role: "user", content: textToSend }
    ];
    setMessages(newMessages);
    setIsStreaming(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to process message");
      }

      // Read readable stream chunks
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let assistantResponse = "";

      // Initialize assistant stream message slot
      setMessages(prev => [...prev, { role: "assistant", content: "" }]);

      while (!done && reader) {
        const { value, done: streamDone } = await reader.read();
        done = streamDone;
        if (value) {
          const chunk = decoder.decode(value, { stream: !done });
          assistantResponse += chunk;
          // Update the last message in place
          setMessages(prev => [
            ...prev.slice(0, -1),
            { role: "assistant", content: assistantResponse }
          ]);
        }
      }

    } catch (err) {
      console.error(err);
      const errorMessage = err instanceof Error ? err.message : "An unexpected streaming error occurred";
      setMessages(prev => [
        ...prev,
        { 
          role: "assistant", 
          content: `❌ **Diagnostic Failure**: ${errorMessage}. Ensure GEMINI_API_KEY is configured in your project.` 
        }
      ]);
    } finally {
      setIsStreaming(false);
    }
  };

  // Node position coordinates for SVG drawing
  const nodePositions: Record<string, { x: number; y: number }> = {
    "api-gateway": { x: 50, y: 15 },
    "auth-service": { x: 25, y: 45 },
    "payment-service": { x: 75, y: 45 },
    "redis-cache": { x: 50, y: 65 },
    "user-db": { x: 25, y: 85 },
    "payment-db": { x: 75, y: 85 },
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "critical": return "text-rose-500 border-rose-500 bg-rose-950/40 glow-critical";
      case "warning": return "text-amber-500 border-amber-500 bg-amber-950/40 glow-warning";
      default: return "text-emerald-400 border-emerald-500/50 bg-emerald-950/20 glow-healthy";
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "critical": return <span className="px-2 py-0.5 text-xs font-bold rounded bg-rose-900/50 text-rose-300 animate-pulse border border-rose-600">CRITICAL</span>;
      case "warning": return <span className="px-2 py-0.5 text-xs font-bold rounded bg-amber-900/50 text-amber-300 animate-pulse border border-amber-600">WARNING</span>;
      default: return <span className="px-2 py-0.5 text-xs font-bold rounded bg-emerald-900/40 text-emerald-300 border border-emerald-600">HEALTHY</span>;
    }
  };

  const currentInspectorNode = services.find(s => s.id === selectedNode);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 cyber-grid crt-overlay relative p-4 flex flex-col justify-between">
      
      {/* HEADER SECTION & ALERT terminal TICKER */}
      <header className="border border-slate-800 bg-slate-900/70 backdrop-blur-md rounded-lg p-3 mb-4 shadow-2xl relative overflow-hidden scanline-effect">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 mb-2">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-emerald-500 animate-ping" />
            <h1 className="text-xl md:text-2xl font-black tracking-widest text-emerald-400 font-mono uppercase flex items-center gap-2">
              <Activity className="w-6 h-6 text-emerald-500" />
              SRE War Room Dashboard
            </h1>
            <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-1 rounded border border-slate-700 font-mono hidden sm:inline">
              V2.5-FLASH
            </span>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono text-slate-400">
            <span className="flex items-center gap-1.5 text-emerald-400">
              <Clock className="w-3.5 h-3.5" />
              SYSTEM TIME UTC: {new Date().toISOString().substring(11, 19)}
            </span>
            <button 
              onClick={handleResetTopology}
              className="flex items-center gap-1.5 px-3 py-1 bg-slate-800 border border-slate-700 rounded hover:bg-emerald-500/20 hover:border-emerald-500 hover:text-emerald-400 transition-all font-bold cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              FLUSH TOPOLOGY
            </button>
          </div>
        </div>

        {/* Real-time scrolling Alert ticker */}
        <div className="bg-slate-950/90 border border-emerald-900/40 rounded p-2 text-xs font-mono flex items-center gap-3 relative h-10 overflow-hidden">
          <div className="flex items-center gap-1.5 text-rose-500 font-extrabold uppercase animate-pulse border-r border-slate-800 pr-3 h-full shrink-0">
            <TerminalIcon className="w-4 h-4" />
            LIVE TELEMETRY
          </div>
          <div className="w-full relative overflow-hidden h-full flex items-center">
            <div className="flex gap-8 whitespace-nowrap animate-[marquee_25s_linear_infinite] hover:[animation-play-state:paused] text-emerald-500/90 cursor-default">
              {terminalAlerts.slice(-6).map((alert, idx) => (
                <span key={idx} className={alert.includes("CRITICAL") ? "text-rose-400 font-bold" : alert.includes("WARN") ? "text-amber-400" : ""}>
                  {alert}
                </span>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* CORE WAR ROOM INTERFACE (SPLIT LAYOUT) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-grow h-auto lg:h-[calc(100vh-170px)]">
        
        {/* LEFT COLUMN: INTERACTIVE ARCHITECTURE GRAPH (lg:col-span-7) */}
        <section className="lg:col-span-7 flex flex-col justify-between gap-4 h-full border border-slate-800 bg-slate-900/40 backdrop-blur-sm rounded-lg p-4 shadow-xl overflow-hidden relative">
          
          <div className="flex justify-between items-center border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-emerald-500" />
              <h2 className="text-sm font-bold tracking-wider uppercase font-mono text-slate-300">
                Microservice Topology View
              </h2>
            </div>
            <div className="text-[10px] text-slate-400 font-mono">
              Click node to inspect dependencies
            </div>
          </div>

          {/* TOPOLOGY MAP WORKSPACE */}
          <div className="relative flex-grow flex items-center justify-center min-h-[300px] lg:min-h-0 bg-slate-950/70 border border-slate-900 rounded-lg p-2 my-2 overflow-hidden">
            {/* SVG Connecting Lines representing dependency tree */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
              <defs>
                <marker id="arrow" viewBox="0 0 10 10" refX="24" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#334155" />
                </marker>
                <marker id="arrow-warn" viewBox="0 0 10 10" refX="24" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#d97706" />
                </marker>
                <marker id="arrow-critical" viewBox="0 0 10 10" refX="24" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#e11d48" />
                </marker>
              </defs>
              {serviceDependencies.map((dep, idx) => {
                const start = nodePositions[dep.from];
                const end = nodePositions[dep.to];
                if (!start || !end) return null;

                // Determine if this connection line should be colored based on downstream status
                const downstreamStatus = services.find(s => s.id === dep.to)?.status;
                let strokeColor = "#334155";
                let markerId = "arrow";
                let strokeDash = "none";
                let pulseAnim = false;

                if (downstreamStatus === "critical") {
                  strokeColor = "#e11d48";
                  markerId = "arrow-critical";
                  strokeDash = "4 4";
                  pulseAnim = true;
                } else if (downstreamStatus === "warning") {
                  strokeColor = "#d97706";
                  markerId = "arrow-warn";
                  strokeDash = "4 4";
                }

                return (
                  <g key={idx}>
                    <line
                      x1={`${start.x}%`}
                      y1={`${start.y}%`}
                      x2={`${end.x}%`}
                      y2={`${end.y}%`}
                      stroke={strokeColor}
                      strokeWidth={2}
                      strokeDasharray={strokeDash}
                      markerEnd={`url(#${markerId})`}
                      className={pulseAnim ? "animate-pulse" : ""}
                    />
                  </g>
                );
              })}
            </svg>

            {/* Nodes layer */}
            {services.map((node) => {
              const pos = nodePositions[node.id];
              const isSelected = selectedNode === node.id;
              const isDatabase = node.id.includes("db");
              const isCache = node.id.includes("cache");

              return (
                <button
                  key={node.id}
                  onClick={() => setSelectedNode(node.id)}
                  style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                  className={`absolute transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center p-3 rounded-lg border-2 text-xs font-mono transition-all z-10 select-none cursor-pointer w-32 ${getStatusColor(node.status)} ${isSelected ? "scale-110 border-emerald-400 bg-slate-900 ring-2 ring-emerald-400/50" : ""}`}
                >
                  <div className="mb-1 text-slate-300">
                    {isDatabase ? (
                      <Database className="w-5 h-5" />
                    ) : isCache ? (
                      <Cpu className="w-5 h-5 text-indigo-400" />
                    ) : (
                      <Server className="w-5 h-5" />
                    )}
                  </div>
                  <div className="font-extrabold text-[10px] uppercase truncate w-full text-center text-slate-200">
                    {node.name}
                  </div>
                  <div className="text-[9px] text-slate-400 mt-0.5 font-light">
                    {node.host}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Selected Node details panel */}
          <div className="border border-slate-800 bg-slate-950/80 rounded-lg p-3 mt-auto shadow-inner text-xs font-mono">
            {currentInspectorNode ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-emerald-500 font-bold uppercase">📊 Node Inspector:</span>
                    <span className="text-slate-300 font-extrabold">{currentInspectorNode.name}</span>
                  </div>
                  <p className="text-slate-400 text-[11px] mb-2 leading-relaxed">
                    <strong>Service Role:</strong> {currentInspectorNode.role}
                  </p>
                  <div className="flex items-center gap-1.5">
                    <strong>Operational Status:</strong>
                    {getStatusBadge(currentInspectorNode.status)}
                  </div>
                </div>

                <div className="border-t sm:border-t-0 sm:border-l border-slate-800 pt-2 sm:pt-0 sm:pl-4">
                  <span className="text-emerald-500 font-bold block mb-1">🔗 DEPENDENCIES:</span>
                  <div className="flex flex-col gap-1 text-[11px]">
                    <div>
                      <strong className="text-slate-400">Depends On:</strong>{" "}
                      {serviceDependencies.filter(d => d.from === currentInspectorNode.id).map(d => d.to).join(", ") || "None"}
                    </div>
                    <div>
                      <strong className="text-slate-400">Required By:</strong>{" "}
                      {serviceDependencies.filter(d => d.to === currentInspectorNode.id).map(d => d.from).join(", ") || "None"}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center text-slate-500">
                Click any network node to display service metrics and dependency traces.
              </div>
            )}
          </div>
        </section>

        {/* RIGHT COLUMN: STREAMING DIAGNOSTIC CHAT PANEL (lg:col-span-5) */}
        <section className="lg:col-span-5 flex flex-col justify-between h-full border border-slate-800 bg-slate-900/60 backdrop-blur-md rounded-lg p-4 shadow-xl relative overflow-hidden">
          
          <div className="flex justify-between items-center border-b border-slate-800 pb-2 mb-3">
            <div className="flex items-center gap-2">
              <TerminalIcon className="w-5 h-5 text-emerald-500" />
              <h2 className="text-sm font-bold tracking-wider uppercase font-mono text-slate-300 flex items-center gap-2">
                Diagnostic Copilot Feed
                {isStreaming && <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />}
              </h2>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">
              System Memory Connected
            </span>
          </div>

          {/* CHAT DISPLAY */}
          <div className="flex-grow overflow-y-auto bg-slate-950/80 border border-slate-900 rounded-lg p-3.5 mb-3 font-mono text-xs leading-relaxed space-y-4 max-h-[300px] lg:max-h-none h-96 lg:h-0">
            {messages.map((msg, idx) => (
              <div 
                key={idx} 
                className={`p-3 rounded border ${msg.role === "user" ? "border-emerald-500/20 bg-emerald-950/10 text-slate-200" : "border-slate-800/80 bg-slate-900/40 text-emerald-400/90"}`}
              >
                <div className="flex justify-between items-center mb-1 text-[9px] text-slate-500 font-bold border-b border-slate-800/50 pb-1">
                  <span>{msg.role === "user" ? "👤 OPERATOR QUERY" : "🤖 DIAGNOSTIC COPILOT"}</span>
                  <span>{new Date().toISOString().substring(11, 19)}</span>
                </div>
                
                {/* Parse basic markdown headers, bold, and linebreaks */}
                <div className="space-y-2 whitespace-pre-wrap select-text selection:bg-emerald-500/30">
                  {msg.content.split("\n").map((line, lIdx) => {
                    if (line.startsWith("### ")) {
                      return <h3 key={lIdx} className="text-sm font-black text-slate-100 uppercase tracking-widest mt-2">{line.replace("### ", "")}</h3>;
                    }
                    if (line.startsWith("- ")) {
                      return <div key={lIdx} className="pl-4 text-slate-300 flex items-start gap-1.5"><span className="text-emerald-500">•</span> {line.substring(2)}</div>;
                    }
                    // Basic bold formatting **text**
                    const formattedLine = line.split("**").map((chunk, cIdx) => 
                      cIdx % 2 === 1 ? <strong key={cIdx} className="text-slate-100 font-black">{chunk}</strong> : chunk
                    );
                    return <p key={lIdx} className={line.trim().startsWith("INCIDENT CLASSIFICATION") || line.trim().startsWith("CASCADING") || line.trim().startsWith("ROOT CAUSE") || line.trim().startsWith("REMEDIATION") ? "text-emerald-300 font-bold mt-2" : "text-slate-300"}>{formattedLine}</p>;
                  })}
                </div>
              </div>
            ))}
            {isStreaming && (
              <div className="flex items-center gap-2 text-[10px] text-emerald-500/80 italic">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                Copilot is streaming root-cause analysis...
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* QUICK OUTAGE SIMULATION PANEL */}
          <div className="mb-3">
            <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase font-mono block mb-1.5 flex items-center gap-1">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
              Quick Outage Simulation Buttons
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-2 xl:grid-cols-3 gap-2">
              <button 
                onClick={() => triggerSimulation("INC-8021", "The API Gateway is throwing 504 Gateway Timeouts and users report auth failures. Detect DB pool limits.")}
                className="px-2 py-1.5 text-[10px] font-bold text-rose-400 hover:text-rose-200 border border-rose-900/60 bg-rose-950/20 hover:bg-rose-900/50 rounded flex items-center gap-1 cursor-pointer transition-all uppercase truncate"
              >
                <Play className="w-3 h-3 shrink-0" />
                DB Pool Exhaustion
              </button>
              <button 
                onClick={() => triggerSimulation("INC-3392", "Session validation failed on auth-service. Redis cache memory logs and DB cascade.")}
                className="px-2 py-1.5 text-[10px] font-bold text-amber-400 hover:text-amber-200 border border-amber-900/60 bg-amber-950/20 hover:bg-amber-900/50 rounded flex items-center gap-1 cursor-pointer transition-all uppercase truncate"
              >
                <Play className="w-3 h-3 shrink-0" />
                Redis Cache Eviction
              </button>
              <button 
                onClick={() => triggerSimulation("INC-4029", "A payment service webhook callback is timing out. Cascade to API gateway and user clients.")}
                className="px-2 py-1.5 text-[10px] font-bold text-rose-400 hover:text-rose-200 border border-rose-900/60 bg-rose-950/20 hover:bg-rose-900/50 rounded flex items-center gap-1 cursor-pointer transition-all uppercase truncate"
              >
                <Play className="w-3 h-3 shrink-0" />
                Gateway 504 Timeout
              </button>
              <button 
                onClick={() => triggerSimulation("INC-5512", "Postgres user-db deadlocks. Explain locking order on auth token updates.")}
                className="px-2 py-1.5 text-[10px] font-bold text-rose-400 hover:text-rose-200 border border-rose-900/60 bg-rose-950/20 hover:bg-rose-900/50 rounded flex items-center gap-1 cursor-pointer transition-all uppercase truncate"
              >
                <Play className="w-3 h-3 shrink-0" />
                Auth DB Deadlock
              </button>
              <button 
                onClick={() => triggerSimulation("INC-1104", "Storefront is reporting checkout failures. Payment service throws 429 errors from external processor.")}
                className="px-2 py-1.5 text-[10px] font-bold text-amber-400 hover:text-amber-200 border border-amber-900/60 bg-amber-950/20 hover:bg-amber-900/50 rounded flex items-center gap-1 cursor-pointer transition-all uppercase truncate"
              >
                <Play className="w-3 h-3 shrink-0" />
                Stripe Key Block
              </button>
              <button 
                onClick={handleResetTopology}
                className="px-2 py-1.5 text-[10px] font-bold text-emerald-400 hover:text-emerald-200 border border-emerald-900/60 bg-emerald-950/20 hover:bg-emerald-900/50 rounded flex items-center gap-1 cursor-pointer transition-all uppercase truncate"
              >
                <RefreshCw className="w-3 h-3 shrink-0 animate-spin" />
                System Flush
              </button>
            </div>
          </div>

          {/* CHAT INPUT FORM */}
          <form 
            onSubmit={(e) => { e.preventDefault(); handleSubmitChat(); }}
            className="flex items-center gap-2 border border-slate-800 bg-slate-950 rounded-lg p-1.5 focus-within:ring-2 focus-within:ring-emerald-500/50 focus-within:border-emerald-500"
          >
            <span className="text-[10px] font-extrabold text-emerald-500 pl-2 select-none shrink-0">
              SRE-root@war-room:~$
            </span>
            <input 
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Query historical memory or submit alert..."
              disabled={isStreaming}
              className="flex-grow bg-transparent border-0 outline-none text-xs text-slate-100 placeholder-slate-600 font-mono py-1 px-1"
            />
            {input && <span className="terminal-cursor" />}
            <button 
              type="submit"
              disabled={isStreaming}
              className="p-2 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-slate-950 border border-emerald-500/30 rounded-lg transition-all shrink-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>

        </section>

      </div>
    </main>
  );
}
