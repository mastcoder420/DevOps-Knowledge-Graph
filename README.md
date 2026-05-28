# DevOps Knowledge Graph & SRE Incident Root Cause Analysis Dashboard

Enterprise IT/DevOps Knowledge Graph & Incident Root Cause Analysis to deep dive when a production system goes down. When a production system goes down, DevOps and Site Reliability Engineers (SREs) waste critical minutes digging through scattered Slack histories, old Jira tickets, post-mortem docs, and chaotic internal wikis.

This full-stack SRE Dashboard leverages **Next.js (App Router)**, **Tailwind CSS**, and **Gemini 2.5 Flash** to represent the "collective engineering memory" of your infrastructure, offering instant root-cause analysis (RCA) and cascading dependency metrics.

---

## 🌟 Interactive Features

1. **Dark-Themed SRE Console**: Designed in premium `slate-950` with emerald accents, animated terminal scanlines, live ticking clocks, and ticking background telemetry alerts.
2. **Microservice Dependency Topology (Left Pane)**: Interactive SVG network maps (`api-gateway`, `auth-service`, `payment-service`, `redis-cache`, `user-db`, `payment-db`) highlighting service dependency connections. Selecting any node displays full telemetry properties.
3. **Cascading State Highlighting**: Outage triggers cause visual paths and downstream nodes to pulse warning (amber) or critical (rose) states.
4. **Diagnostic Copilot (Right Pane)**: AI copilot chat powered by Gemini 2.5 Flash. Historical outage logs are fed directly into the system instructions, allowing immediate, streaming cross-reference diagnostic replies and shell code blocks.
5. **Outage Simulation Buttons**: Quick-fire buttons that pre-populate and trigger standard production failures (DB connection pool limits, cache OOMs, 504 timeouts, transaction deadlocks, Stripe rate limits).

---

## ⚙️ Getting Started

### 1. Configure the Gemini API Key
Export your API key before starting:
```bash
export GEMINI_API_KEY="your_actual_gemini_api_key"
```

### 2. Run the Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to launch the War Room.

---

## 🏗️ Production Build & Verification
Compile and run optimization tests:
```bash
npm run build
npm run start
```
The codebase has been checked with ESLint and fully builds with zero compilation errors or TypeScript warnings!
