"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  Server, 
  Terminal as TerminalIcon, 
  Send, 
  Activity, 
  Play, 
  RefreshCw, 
  Layers, 
  ShieldAlert,
  Clock,
  Search,
  BookOpen,
  GitBranch,
  Network
} from "lucide-react";
import { postMortemsDatabase } from "@/data/incidentData";
import { queryPostMortems, RAGMatch } from "@/data/ragEngine";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function SreRAGDashboard() {
  const [dbSearch, setDbSearch] = useState("");
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>("PM-AWS-S3-2017");
  const [activeQuery, setActiveQuery] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  
  // Real-time RAG tracking state
  const [ragMatches, setRagMatches] = useState<RAGMatch[]>([]);
  
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: `### 🛰️ SRE RAG WAR ROOM INITIATED
Welcome. I am your Retrieval-Augmented Diagnostic Copilot. 

**Memory Cache**: Connected to Dan Luu's historical post-mortem engineering database.
Submit an active system failure log or click one of the **Incident Simulation Triggers** below. 

I will mathematically index the symptoms, retrieve the most relevant historical reports, and stream a comprehensive root-cause analysis with terminal rollback commands.`
    }
  ]);
  
  const [terminalAlerts, setTerminalAlerts] = useState<string[]>([
    "[SYSTEM] SRE RAG Memory index generated successfully (5 post-mortem records cached)",
    "[INFO] Cosine similarity vector dimensions mapped on namespace: production-logs",
    "INFO: Global Edge proxy reporting healthy CPU averages (2.4%)",
    "INFO: S3 US-EAST-1 storage engine heartbeat validated"
  ]);
  
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  // Live alerts ticker simulator
  useEffect(() => {
    const alertTemplates = [
      "INFO: Automated backup validation routine check: PASS",
      "WARN: GitLab replication lag metrics spiked to 12.8s",
      "CRITICAL: Cloudflare WAF compiler reports 18 regex complexity warnings",
      "INFO: Database failover orchestrator state set to: PRIMARY_ACTIVE",
      "WARN: GSLB DNS route propagation average latency is 80ms",
      "INFO: WAL archiver successfully synced 28 segments to AWS S3 storage",
    ];

    const interval = setInterval(() => {
      const randomAlert = alertTemplates[Math.floor(Math.random() * alertTemplates.length)];
      const timestamp = new Date().toISOString().substring(11, 19);
      setTerminalAlerts(prev => [...prev.slice(-30), `[${timestamp}] ${randomAlert}`]);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // Update RAG scoring in real-time as the operator types/queries
  const handleQueryChange = (text: string) => {
    setActiveQuery(text);
    if (text.trim().length > 3) {
      const matches = queryPostMortems(text, postMortemsDatabase);
      setRagMatches(matches);
    } else {
      setRagMatches([]);
    }
  };

  // Trigger a full diagnostic analysis
  const triggerInvestigation = async (queryText: string) => {
    if (!queryText.trim()) return;

    setActiveQuery(queryText);
    
    // 1. Run local RAG Engine to extract top matching post-mortems
    const matches = queryPostMortems(queryText, postMortemsDatabase);
    setRagMatches(matches);

    // Retrieve only top matching context (>0.05 score) to avoid feeding noisy contexts
    const retrievedContexts = matches
      .filter(m => m.score > 0.04)
      .slice(0, 3)
      .map(m => m.postMortem);

    // Add alert to terminal
    const timestamp = new Date().toISOString().substring(11, 19);
    const topMatch = matches[0]?.score > 0.04 ? matches[0] : null;
    
    setTerminalAlerts(prev => [
      ...prev,
      `[${timestamp}] 🔎 RAG ENGINE QUERY DISPATCHED: "${queryText.substring(0, 40)}..."`,
      topMatch 
        ? `[${timestamp}] ✅ RAG RETRIEVAL MATCHED: ${topMatch.postMortem.incident_id} (${Math.round(topMatch.score * 100)}% relevance)`
        : `[${timestamp}] ⚠ RAG RETRIEVAL: No high-relevance matches found in historical database.`
    ]);

    // 2. Prepare chat message history
    const newMessages: Message[] = [
      ...messages,
      { role: "user", content: queryText }
    ];
    setMessages(newMessages);
    setIsStreaming(true);

    try {
      // 3. Dispatch payload with dynamic retrieved post-mortem contexts
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          messages: newMessages,
          retrievedContexts: retrievedContexts
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to parse streaming diagnostics.");
      }

      // Read reader stream chunks
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let assistantResponse = "";

      // Add slot for copilot response
      setMessages(prev => [...prev, { role: "assistant", content: "" }]);

      while (!done && reader) {
        const { value, done: streamDone } = await reader.read();
        done = streamDone;
        if (value) {
          const chunk = decoder.decode(value, { stream: !done });
          assistantResponse += chunk;
          
          setMessages(prev => [
            ...prev.slice(0, -1),
            { role: "assistant", content: assistantResponse }
          ]);
        }
      }

    } catch (err) {
      console.error(err);
      const errMsg = err instanceof Error ? err.message : "Unexpected connection loss to Gemini engine.";
      setMessages(prev => [
        ...prev,
        { 
          role: "assistant", 
          content: `❌ **Diagnostic Timeout**: ${errMsg}. Ensure GEMINI_API_KEY is configured in your project environment.`
        }
      ]);
    } finally {
      setIsStreaming(false);
    }
  };

  const handleResetWorkspace = () => {
    setActiveQuery("");
    setRagMatches([]);
    setMessages([
      {
        role: "assistant",
        content: `### ♻️ COGNITIVE WORKSPACE FLUSHED
Retrieval similarity scores reset. The War Room console is ready for a new active alert.`
      }
    ]);
  };

  // Filter post-mortems list based on search query
  const filteredDatabase = postMortemsDatabase.filter(pm => 
    pm.company.toLowerCase().includes(dbSearch.toLowerCase()) ||
    pm.title.toLowerCase().includes(dbSearch.toLowerCase()) ||
    pm.incident_id.toLowerCase().includes(dbSearch.toLowerCase()) ||
    pm.root_cause.toLowerCase().includes(dbSearch.toLowerCase())
  );

  const selectedIncident = postMortemsDatabase.find(pm => pm.incident_id === selectedIncidentId);

  // Position coordinates for the RAG network node visualization
  const graphNodes = [
    { id: "query", name: "ACTIVE ALERT QUERY", x: 50, y: 50, role: "center" },
    { id: "PM-AWS-S3-2017", name: "AWS S3 Outage", x: 20, y: 20 },
    { id: "PM-CLOUDFLARE-WAF-2019", name: "Cloudflare WAF", x: 80, y: 20 },
    { id: "PM-GITLAB-DB-2017", name: "GitLab rm -rf", x: 15, y: 75 },
    { id: "PM-GITHUB-DB-2018", name: "GitHub Split-Brain", x: 85, y: 75 },
    { id: "PM-GOOGLE-LB-2014", name: "Google GSLB Config", x: 50, y: 12 },
  ];

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 cyber-grid crt-overlay relative p-4 flex flex-col justify-between">
      
      {/* HEADER BAR & SCROLLING ticker */}
      <header className="border border-slate-800 bg-slate-900/70 backdrop-blur-md rounded-lg p-3 mb-4 shadow-2xl relative overflow-hidden scanline-effect">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 mb-2">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-emerald-500 animate-ping" />
            <h1 className="text-xl md:text-2xl font-black tracking-widest text-emerald-400 font-mono uppercase flex items-center gap-2">
              <Activity className="w-6 h-6 text-emerald-500" />
              SRE RAG Investigation Dashboard
            </h1>
            <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-1 rounded border border-slate-700 font-mono hidden sm:inline">
              RAG ENGINE V1.0
            </span>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono text-slate-400">
            <span className="flex items-center gap-1.5 text-emerald-400">
              <Clock className="w-3.5 h-3.5" />
              SYSTEM TIME UTC: {new Date().toISOString().substring(11, 19)}
            </span>
            <button 
              onClick={handleResetWorkspace}
              className="flex items-center gap-1.5 px-3 py-1 bg-slate-800 border border-slate-700 rounded hover:bg-emerald-500/20 hover:border-emerald-500 hover:text-emerald-400 transition-all font-bold cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              RESET CONSOLE
            </button>
          </div>
        </div>

        {/* Real-time scrolling Alert ticker */}
        <div className="bg-slate-950/90 border border-emerald-900/40 rounded p-2 text-xs font-mono flex items-center gap-3 relative h-10 overflow-hidden">
          <div className="flex items-center gap-1.5 text-emerald-400 font-extrabold uppercase animate-pulse border-r border-slate-800 pr-3 h-full shrink-0">
            <TerminalIcon className="w-4 h-4 text-emerald-500" />
            RAG PIPELINE STREAM
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

      {/* CORE WORK ROOM LAYOUT SPLIT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-grow h-auto lg:h-[calc(100vh-170px)]">
        
        {/* LEFT COLUMN: DAN LUU HISTORICAL POST-MORTEMS DATABASE (lg:col-span-6) */}
        <section className="lg:col-span-6 flex flex-col justify-between gap-4 h-full border border-slate-800 bg-slate-900/40 backdrop-blur-sm rounded-lg p-4 shadow-xl overflow-hidden relative">
          
          <div className="flex justify-between items-center border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-emerald-500" />
              <h2 className="text-sm font-bold tracking-wider uppercase font-mono text-slate-300">
                Dan Luu Post-Mortem Memory Bank
              </h2>
            </div>
            <span className="text-[10px] text-slate-400 font-mono bg-slate-900 border border-slate-800 px-2 py-0.5 rounded">
              Seed Source
            </span>
          </div>

          {/* DATABASE SEARCH BAR */}
          <div className="flex items-center gap-2 border border-slate-800 bg-slate-950/80 rounded-lg p-2 my-1.5 focus-within:ring-2 focus-within:ring-emerald-500/50">
            <Search className="w-4 h-4 text-slate-500 shrink-0" />
            <input 
              type="text"
              value={dbSearch}
              onChange={(e) => setDbSearch(e.target.value)}
              placeholder="Search historical logs, root causes, or companies..."
              className="w-full bg-transparent border-0 outline-none text-xs text-slate-300 placeholder-slate-600 font-mono"
            />
          </div>

          {/* Split Pane inside Left: Top is post-mortem list, Bottom is similarity vector network */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 flex-grow overflow-hidden h-96 lg:h-0">
            
            {/* List block */}
            <div className="md:col-span-6 overflow-y-auto space-y-2 border border-slate-900 bg-slate-950/60 p-2 rounded-lg">
              {filteredDatabase.map((pm) => {
                const isSelected = selectedIncidentId === pm.incident_id;
                // Calculate match score if activeQuery is present
                const queryMatch = ragMatches.find(m => m.postMortem.incident_id === pm.incident_id);
                const scorePct = queryMatch ? Math.round(queryMatch.score * 100) : 0;

                return (
                  <button
                    key={pm.incident_id}
                    onClick={() => setSelectedIncidentId(pm.incident_id)}
                    className={`w-full text-left p-2.5 rounded border transition-all cursor-pointer font-mono text-xs flex flex-col justify-between ${
                      isSelected 
                        ? "border-emerald-500 bg-emerald-950/15 text-slate-100" 
                        : "border-slate-800 bg-slate-900/20 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                    }`}
                  >
                    <div className="flex justify-between items-start w-full border-b border-slate-800/50 pb-1 mb-1">
                      <span className="font-extrabold text-[10px] text-slate-300">{pm.company}</span>
                      <span className="text-[9px] text-slate-500">{pm.date}</span>
                    </div>
                    <div className="font-bold truncate text-[11px] mb-1.5">
                      {pm.title}
                    </div>

                    {/* Match Score Indicator (Visual RAG Telemetry) */}
                    {scorePct > 4 && (
                      <div className="flex items-center gap-1.5 text-[9px] text-emerald-400 font-black tracking-wider uppercase animate-pulse">
                        <Layers className="w-3 h-3" />
                        RAG Sim: {scorePct}%
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* INTERACTIVE SEMANTIC NETWORK GRAPH */}
            <div className="md:col-span-6 bg-slate-950/80 border border-slate-900 rounded-lg p-2 relative overflow-hidden flex items-center justify-center min-h-[180px]">
              
              <div className="absolute top-2 left-2 flex items-center gap-1.5 text-[9px] font-bold text-slate-500 font-mono">
                <Network className="w-3.5 h-3.5" />
                SIMILARITY RELATION NETWORK
              </div>

              {/* SVG vector edges representing match bounds */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
                {graphNodes.filter(n => n.id !== "query").map((node, idx) => {
                  const queryNode = graphNodes.find(n => n.id === "query")!;
                  
                  // Compute link thickness and lighting based on active similarity score
                  const queryMatch = ragMatches.find(m => m.postMortem.incident_id === node.id);
                  const isHighSim = queryMatch && queryMatch.score > 0.04;
                  
                  let strokeColor = "#1e293b";
                  let strokeWidth = 1;
                  let strokeDash = "2 4";
                  
                  if (isHighSim) {
                    strokeColor = queryMatch.score > 0.4 ? "#10b981" : "#d97706";
                    strokeWidth = 2 + queryMatch.score * 3;
                    strokeDash = "none";
                  }

                  return (
                    <line
                      key={idx}
                      x1={`${queryNode.x}%`}
                      y1={`${queryNode.y}%`}
                      x2={`${node.x}%`}
                      y2={`${node.y}%`}
                      stroke={strokeColor}
                      strokeWidth={strokeWidth}
                      strokeDasharray={strokeDash}
                      className={isHighSim ? "animate-pulse" : ""}
                    />
                  );
                })}
              </svg>

              {/* RAG Nodes */}
              {graphNodes.map((node) => {
                const isCenter = node.id === "query";
                const isSelected = selectedIncidentId === node.id;
                
                let nodeStatusStyle = "border-slate-800 bg-slate-900 text-slate-500 scale-90";
                
                if (isCenter) {
                  nodeStatusStyle = activeQuery.trim().length > 3 
                    ? "border-emerald-400 bg-emerald-950/20 text-emerald-400 glow-healthy" 
                    : "border-slate-700 bg-slate-900 text-slate-400";
                } else {
                  const queryMatch = ragMatches.find(m => m.postMortem.incident_id === node.id);
                  if (queryMatch && queryMatch.score > 0.04) {
                    nodeStatusStyle = queryMatch.score > 0.4 
                      ? "border-emerald-500 bg-emerald-950/30 text-emerald-400 glow-healthy scale-100" 
                      : "border-amber-500 bg-amber-950/30 text-amber-400 glow-warning scale-95";
                  } else if (isSelected) {
                    nodeStatusStyle = "border-slate-600 bg-slate-900 text-slate-200 scale-95 ring-1 ring-slate-600";
                  }
                }

                return (
                  <button
                    key={node.id}
                    onClick={() => {
                      if (!isCenter) setSelectedIncidentId(node.id);
                    }}
                    style={{ left: `${node.x}%`, top: `${node.y}%` }}
                    className={`absolute transform -translate-x-1/2 -translate-y-1/2 p-1.5 rounded-lg border-2 text-[8px] font-mono transition-all z-10 w-20 text-center select-none truncate ${nodeStatusStyle}`}
                  >
                    {isCenter ? (
                      <TerminalIcon className="w-3.5 h-3.5 mx-auto mb-0.5 text-emerald-400" />
                    ) : (
                      <Server className="w-3.5 h-3.5 mx-auto mb-0.5" />
                    )}
                    <span className="font-extrabold block truncate">{node.name.split(" ")[0]}</span>
                  </button>
                );
              })}
            </div>

          </div>

          {/* Selected incident inspection box */}
          <div className="border border-slate-800 bg-slate-950/80 rounded-lg p-3 shadow-inner text-xs font-mono">
            {selectedIncident ? (
              <div className="flex flex-col gap-2.5 max-h-[160px] overflow-y-auto">
                <div className="flex justify-between items-center border-b border-slate-900 pb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-500 font-extrabold uppercase text-[10px]">🔎 Memory Core:</span>
                    <span className="text-slate-200 font-black truncate">{selectedIncident.company}</span>
                  </div>
                  <span className="px-2 py-0.5 text-[9px] font-bold rounded bg-rose-900/30 text-rose-400 border border-rose-900/50">
                    {selectedIncident.severity}
                  </span>
                </div>
                
                <div className="text-[11px] text-slate-300 leading-relaxed font-sans">
                  <strong>Outage Summary:</strong> {selectedIncident.title} ({selectedIncident.date})
                </div>

                <div className="text-[11px] text-slate-400 leading-relaxed font-sans">
                  <strong>Symptom Logs:</strong> {selectedIncident.symptoms}
                </div>

                <div className="text-[11px] text-slate-400 leading-relaxed font-sans border-t border-slate-900/50 pt-1">
                  <strong>Root Cause:</strong> {selectedIncident.root_cause}
                </div>

                <div className="text-[11px] text-emerald-400/90 leading-relaxed font-sans border-t border-slate-900/50 pt-1">
                  <strong>Historical Resolution:</strong> {selectedIncident.resolution}
                </div>

                <div className="bg-slate-950 p-2 rounded border border-slate-900 font-mono text-[9px] text-slate-400 space-y-1 mt-1 select-text">
                  <strong className="text-emerald-500 block mb-1">📟 REMEDIATION CLI:</strong>
                  {selectedIncident.remediation_commands.map((cmd, cIdx) => (
                    <div key={cIdx} className={cmd.startsWith("#") ? "text-slate-600 italic" : "text-emerald-500/90"}>
                      {cmd}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center text-slate-500">
                Select an outage record from the memory bank to inspect deep infrastructure symptoms.
              </div>
            )}
          </div>
        </section>

        {/* RIGHT COLUMN: RAG INVESTIGATION CONSOLE & STREAMING CHAT (lg:col-span-6) */}
        <section className="lg:col-span-6 flex flex-col justify-between h-full border border-slate-800 bg-slate-900/60 backdrop-blur-md rounded-lg p-4 shadow-xl relative overflow-hidden">
          
          <div className="flex justify-between items-center border-b border-slate-800 pb-2 mb-3">
            <div className="flex items-center gap-2">
              <TerminalIcon className="w-5 h-5 text-emerald-500" />
              <h2 className="text-sm font-bold tracking-wider uppercase font-mono text-slate-300 flex items-center gap-2">
                Incident Copilot Investigation
                {isStreaming && <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />}
              </h2>
            </div>
            <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
              <GitBranch className="w-3.5 h-3.5 text-emerald-500" />
              RAG ACTIVE
            </span>
          </div>

          {/* RAG similarity retrieval traces */}
          {ragMatches.some(m => m.score > 0.04) && (
            <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-2.5 mb-3 font-mono text-[10px] space-y-1.5 animate-fadeIn">
              <div className="flex items-center gap-1.5 text-emerald-400 font-bold border-b border-slate-900 pb-1 mb-1 uppercase tracking-wider">
                <Layers className="w-3.5 h-3.5" />
                RAG Context Matches (Relevance scoring)
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {ragMatches.filter(m => m.score > 0.04).slice(0, 3).map((match, idx) => (
                  <div key={idx} className="bg-slate-900/70 border border-slate-800/80 rounded p-1.5 flex flex-col gap-0.5">
                    <span className="font-extrabold text-slate-300 truncate">{match.postMortem.company}</span>
                    <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden mt-1 border border-slate-800">
                      <div 
                        className={`h-full ${match.score > 0.4 ? "bg-emerald-500" : "bg-amber-500"}`} 
                        style={{ width: `${match.score * 100}%` }} 
                      />
                    </div>
                    <span className="text-[8px] text-slate-500 font-mono mt-0.5 text-right">{Math.round(match.score * 100)}% match</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CHAT LOG DISPLAY */}
          <div className="flex-grow overflow-y-auto bg-slate-950/80 border border-slate-900 rounded-lg p-3.5 mb-3 font-mono text-xs leading-relaxed space-y-4 max-h-[300px] lg:max-h-none h-80 lg:h-0">
            {messages.map((msg, idx) => (
              <div 
                key={idx} 
                className={`p-3 rounded border ${msg.role === "user" ? "border-emerald-500/20 bg-emerald-950/10 text-slate-200" : "border-slate-800/80 bg-slate-900/40 text-emerald-400/90"}`}
              >
                <div className="flex justify-between items-center mb-1 text-[9px] text-slate-500 font-bold border-b border-slate-800/50 pb-1">
                  <span>{msg.role === "user" ? "👤 INCIDENT LOG QUERY" : "🤖 SRE COPILOT SYNTHESIS"}</span>
                  <span>{new Date().toISOString().substring(11, 19)}</span>
                </div>
                
                {/* Basic markdown parsing */}
                <div className="space-y-2 whitespace-pre-wrap select-text selection:bg-emerald-500/30">
                  {msg.content.split("\n").map((line, lIdx) => {
                    if (line.startsWith("### ")) {
                      return <h3 key={lIdx} className="text-sm font-black text-slate-100 uppercase tracking-widest mt-2">{line.replace("### ", "")}</h3>;
                    }
                    if (line.startsWith("- ")) {
                      return <div key={lIdx} className="pl-4 text-slate-300 flex items-start gap-1.5"><span className="text-emerald-500">•</span> {line.substring(2)}</div>;
                    }
                    const formattedLine = line.split("**").map((chunk, cIdx) => 
                      cIdx % 2 === 1 ? <strong key={cIdx} className="text-slate-100 font-black">{chunk}</strong> : chunk
                    );
                    return <p key={lIdx} className={line.trim().startsWith("INCIDENT CLASSIFICATION") || line.trim().startsWith("RETRIEVAL") || line.trim().startsWith("ROOT CAUSE") || line.trim().startsWith("ACTIONABLE") ? "text-emerald-300 font-bold mt-2" : "text-slate-300"}>{formattedLine}</p>;
                  })}
                </div>
              </div>
            ))}
            {isStreaming && (
              <div className="flex items-center gap-2 text-[10px] text-emerald-500/80 italic">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                Copilot matches context and synthesizes diagnostic analysis...
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* SIMULATION triggers FOR DAN LUU CASES */}
          <div className="mb-3">
            <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase font-mono block mb-1.5 flex items-center gap-1">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
              Historical Incident Simulation Triggers
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-2 xl:grid-cols-3 gap-2">
              <button 
                onClick={() => triggerInvestigation("US-EAST-1 s3 buckets returning 500 internal errors, EC2 and Lambda instances failed scaling configurations due to placement subsystems.")}
                className="px-2 py-1.5 text-[10px] font-bold text-rose-400 hover:text-rose-200 border border-rose-900/60 bg-rose-950/20 hover:bg-rose-900/50 rounded flex items-center gap-1 cursor-pointer transition-all uppercase truncate"
              >
                <Play className="w-3 h-3 shrink-0 text-rose-500" />
                AWS S3 Outage
              </button>
              <button 
                onClick={() => triggerInvestigation("Nginx proxy nodes spiked CPU load to 100% globally. Bad gateway 502 errors returned globally. Investigate WAF rule regex looping.")}
                className="px-2 py-1.5 text-[10px] font-bold text-rose-400 hover:text-rose-200 border border-rose-900/60 bg-rose-950/20 hover:bg-rose-900/50 rounded flex items-center gap-1 cursor-pointer transition-all uppercase truncate"
              >
                <Play className="w-3 h-3 shrink-0 text-rose-500" />
                CF WAF Regex Spikes
              </button>
              <button 
                onClick={() => triggerInvestigation("Tired sysadmin deleted production database directory /postgresql/data instead of staging replica. All backups reporting restoration failures.")}
                className="px-2 py-1.5 text-[10px] font-bold text-rose-400 hover:text-rose-200 border border-rose-900/60 bg-rose-950/20 hover:bg-rose-900/50 rounded flex items-center gap-1 cursor-pointer transition-all uppercase truncate"
              >
                <Play className="w-3 h-3 shrink-0 text-rose-500" />
                GitLab DB Deletion
              </button>
              <button 
                onClick={() => triggerInvestigation("Fiber network switch failure caused database replication network splits, orchestrator initiated master failover to out-of-sync standby, database locks writes.")}
                className="px-2 py-1.5 text-[10px] font-bold text-amber-400 hover:text-amber-200 border border-amber-900/60 bg-amber-950/20 hover:bg-amber-900/50 rounded flex items-center gap-1 cursor-pointer transition-all uppercase truncate"
              >
                <Play className="w-3 h-3 shrink-0 text-amber-500" />
                GitHub Split-Brain
              </button>
              <button 
                onClick={() => triggerInvestigation("Google search and gmail services unreachable, DNS packets dropped on edge proxy routers, checking routing configuration assign null routes.")}
                className="px-2 py-1.5 text-[10px] font-bold text-rose-400 hover:text-rose-200 border border-rose-900/60 bg-rose-950/20 hover:bg-rose-900/50 rounded flex items-center gap-1 cursor-pointer transition-all uppercase truncate"
              >
                <Play className="w-3 h-3 shrink-0 text-rose-500" />
                Google GSLB Routing
              </button>
              <button 
                onClick={handleResetWorkspace}
                className="px-2 py-1.5 text-[10px] font-bold text-emerald-400 hover:text-emerald-200 border border-emerald-900/60 bg-emerald-950/20 hover:bg-emerald-900/50 rounded flex items-center gap-1 cursor-pointer transition-all uppercase truncate"
              >
                <RefreshCw className="w-3 h-3 shrink-0 animate-spin" />
                System Flush
              </button>
            </div>
          </div>

          {/* CHAT INPUT PANEL */}
          <form 
            onSubmit={(e) => { e.preventDefault(); triggerInvestigation(activeQuery); }}
            className="flex items-center gap-2 border border-slate-800 bg-slate-950 rounded-lg p-1.5 focus-within:ring-2 focus-within:ring-emerald-500/50 focus-within:border-emerald-500"
          >
            <span className="text-[10px] font-extrabold text-emerald-500 pl-2 select-none shrink-0">
              SRE-root@RAG-copilot:~$
            </span>
            <input 
              type="text"
              value={activeQuery}
              onChange={(e) => handleQueryChange(e.target.value)}
              placeholder="Input system logs / symptoms (WAF, S3, Split-Brain, rm -rf)..."
              disabled={isStreaming}
              className="flex-grow bg-transparent border-0 outline-none text-xs text-slate-100 placeholder-slate-600 font-mono py-1 px-1"
            />
            {activeQuery && <span className="terminal-cursor" />}
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
