# IRIS — Indian Railway Intelligent System
### AI-Assisted Railway Traffic Decision-Support & Section Throughput Optimization Platform
**Vocational Training (VT) Final Project** — Modeled on **DRM Raipur Division, South East Central Railway (SECR)** & SIH25022

[![Python 3.11](https://img.shields.io/badge/Python-3.11-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![OR-Tools CP-SAT](https://img.shields.io/badge/Google%20OR--Tools-CP--SAT%209.11-4285F4?logo=google&logoColor=white)](https://developers.google.com/optimization)
[![scikit-learn](https://img.shields.io/badge/scikit--learn-1.5.2-F7931E?logo=scikit-learn&logoColor=white)](https://scikit-learn.org/)
[![Node.js](https://img.shields.io/badge/Node.js-v20%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![React 18](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![SQLite](https://img.shields.io/badge/SQLite-3-003B57?logo=sqlite&logoColor=white)](https://www.sqlite.org/)

---

## 📌 Executive Summary & Project Background

**IRIS (Indian Railway Intelligent System)** is an enterprise-grade AI decision-support platform designed to maximize section throughput, resolve junction conflicts, predict delays, and enforce safety invariants across high-density Indian Railways corridors.

This project represents the culmination of practical operational learnings from **Vocational Training at the Divisional Railway Manager (DRM) Office, Raipur Division, South East Central Railway (SECR)**. 

### Why Raipur Division (SECR)?
South East Central Railway (SECR) is the **highest freight-loading railway zone in Indian Railways**, generating massive revenue through heavy-haul coal rakes (Korba / Coalfields) and finished steel rakes from the **Bhilai Steel Plant (SAIL)**. Managing mixed traffic on the **Durg — Bhilai — Raipur — Bilaspur** trunk route—where 130 km/h Vande Bharat expresses, superfast passenger trains, MEMU locals, and 58-wagon freight trains share the same tracks—is one of the most complex train dispatching challenges in Indian Railways. 

IRIS digitizes and assists the Section Controller's dispatch desk with real-time optimization, constraint solving, and deterministic safety vetoes.

---

## 🗺️ Supported Railway Corridors

IRIS features a multi-corridor engine with an instant corridor switcher in the UI:

### 1. South East Central Railway (SECR) — Raipur Division (Primary Corridor)
- **Coverage**: **Durg Junction (`DURG`) to Bilaspur Junction (`BSP`)** via **Raipur Junction (`R`)**
- **Distance & Scale**: **150.3 km**, **20 stations**, quadruple/triple-track electrified trunk line
- **Key Nerve Center**: **Raipur Junction (`R`)** — Division Headquarters, 7 platforms, central interlocking cabin, and passenger-freight convergence
- **Major Intermediate Hubs**:
  - `DURG`: Durg Junction (Major terminal & Dalli Rajhara iron ore junction)
  - `BPHB`: Bhilai Power House (Industrial nerve center for Bhilai Steel Plant)
  - `BIA`: Bhilai Nagar
  - `SRWN`: Saraswati Nagar (Educational hub / NIT Raipur)
  - `R`: **Raipur Junction (DRM Office / Operations HQ)**
  - `WRC`: WRS Colony (Wagon Repair Shop Raipur)
  - `URK`: Urkura Junction (Bypass & goods diversion cabin)
  - `TLD`: Tilda Neora (Commercial industrial junction)
  - `BYT`: Bhatapara (Major express halt & agricultural grain hub)
  - `BSP`: Bilaspur Junction (SECR Zonal Headquarters)
- **Active Trains Simulated**:
  - `SECR_VB_20825`: Bilaspur – Nagpur Vande Bharat Express (Fast, Priority 1)
  - `SECR_MEMU_08701`: Raipur – Durg MEMU Special (Slow, Daily commuter)
  - `SECR_MEMU_08702`: Durg – Raipur MEMU Special (Slow, Daily commuter)
  - `SECR_INT_12855`: Bilaspur – Itwari Intercity Superfast Express (Fast)
  - `SECR_EXP_18237`: Chhattisgarh Express (Fast, Mail/Express)
  - `SECR_COAL_BOXN_1`: SECR Korba–Bhilai Heavy Coal Freight Rake (58 BOXN wagons)
  - `SECR_STEEL_BFNS_2`: SECR Bhilai Steel Plant Outbound Steel Rake (45 BFNS wagons)

### 2. Central Railway (CR) — Mumbai Suburban Corridor
- **Coverage**: Chhatrapati Shivaji Maharaj Terminus (`CSMT`) to Kalyan Junction (`KALYAN`)
- **Distance & Scale**: **53.3 km**, **26 stations**, Quadruple suburban track (Up Slow, Down Slow, Up Fast, Down Fast)
- **Stations**: CSMT, Dadar, Kurla, Ghatkopar, Thane, Diva, Dombivli, Kalyan, etc.

---

## 🖥️ DRM Office Visual Display Unit (VDU) Interlocking System

Modeled directly after the **Electronic Interlocking (EI / Route Relay Interlocking Class-II NX Type)** consoles used in Indian Railways Divisional Control Offices (such as **DRM Raipur Central Cabin**):

### 1. Interactive Station Interlocking Schematic
- **Full Track Topology**: Scalable CAD-style SVG schematic with zoom controls (70% - 140%).
- **Luminous Track Circuits (TC)**: Dynamic glow effects — turns **Luminous Red** on train occupancy, **Amber** on route-locking, and **Cyan** when clear.
- **Directional Feed Tracks**: Clear demarcation of Up Line (towards Bhilai/Durg) and Down Line (towards Bilaspur).
- **Central Station Cabin**: Gold-highlighted **★ DRM RAIPUR HQ** dispatch marker.

### 2. Platform Status Board (Raipur Jn 7 Platforms)
- **Platform 1 (Main Up)** & **Platform 2 (Main Down)**: 648m full rake berthing capacity.
- **Platforms 3, 4, 5 (Loop Lines A, B, C)**: 450m - 540m loop lines for precedence overtaking.
- **Platform 6 (Goods Road)**: 420m freight rake reception and dispatch.
- **Platform 7 (Coaching / Reserve)**: 350m stabling & inspection pit line.
- **Real-Time Indicators**: Live train describer tags (`▶ SECR_VB_20825`), occupation badges (`OCC`), reserved status (`RSVD`), and ETA calculations.

### 3. Point Machines (Turnout Switches) Panel
- **Point IDs**: Monitored turnouts `Pt 1A`, `1B`, `3A`, `5A`, `5B`, `7A`, `10A`, `10B`, `12A`, `15A`.
- **Operational States**: Live detection of **Normal (N)** and **Reverse (R)** switch blade alignment.
- **Detection Proving**: Real-time **KR Proved** (Detection healthy) vs **Out of Correspondence (Fault)** indication.
- **Filter Controls**: Filter by Normal, Reverse, or Faulted point machines.

### 4. Axle Counters (MSDAC / Track Circuits) Grid
- **Block Sections**: Covers Durg–BPHB, BPHB–Raipur, Raipur Platform track circuits, Raipur–Tilda, and Tilda–Bhatapara.
- **Wheel Counts**: Real-time incoming count (`IN`) vs outgoing count (`OUT`) to verify axle count parity.
- **Circuit States**: `CLEAR`, `OCCUPIED` (with animated pulse), or `RESET REQUIRED` (SSDAC reset safety protocol).

### 5. Multi-Aspect Colour Light Signalling (MACLS) Panel
- **Signal Types**: Home (UH/DH), Starter (US1/US2/DS1/DS2), Advanced Starter (UAS/DAS), and Distant (UD/DD).
- **Realistic 3-Aspect & 4-Aspect Signal Heads**:
  - 🟢 **Green (Proceed)**: Normal line speed (110–130 km/h).
  - 🟡 **Yellow (Caution)**: Prepare to stop at next signal (45 km/h).
  - 🔴 **Red (Danger)**: Absolute stop enforced by electronic interlocking.
  - 🟡🟡 **Double Yellow (Attention)**: Prepare to pass next signal at restricted speed.

---

## 🏛️ System Architecture

IRIS implements a **6-Layer Decision-Support Pipeline** ensuring that AI recommendations are fast, optimal, mathematically provable, and never override hard safety invariants.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        1. REAL-TIME TELEMETRY LAYER                    │
│   Simulator emits GPS coordinates, speed, sector IDs every 2000 ms     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        2. ML DELAY PREDICTION ENGINE                   │
│   GradientBoostingRegressor (scikit-learn) trained on synthetic features│
│   MAE: 2.07 min | RMSE: 3.54 min | R²: 0.961                           │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     3. DETERMINISTIC CONFLICT DETECTOR                 │
│   Detects block overlap, platform contentions, and headway violations  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                  4. OR-TOOLS CP-SAT OPTIMIZATION SOLVER                │
│   Minimizes priority-weighted delay subject to disjunctive constraints │
│   Favors Vande Bharat / Superfast over freight while avoiding gridlock │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│              5. DETERMINISTIC SAFETY VALIDATOR (FINAL VETO)            │
│   Hard rules: Headway ≥ 120s | No sector overlap | Speed limit cap     │
│   Can NEVER be bypassed; rejects unsafe manual override attempts       │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                  6. HUMAN-IN-THE-LOOP CONTROLLER CONSOLE               │
│   Section Controller evaluates recommendations, what-if KPI impact,    │
│   and explicitly APPROVES or REJECTS before any dispatch is logged.    │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 💻 Tech Stack

| Domain | Technologies |
| :--- | :--- |
| **Frontend Web App** | React 18, Vite, TypeScript, TailwindCSS, Framer Motion, Lucide Icons, Sonner |
| **Backend API** | Node.js, Express, TypeScript, SQLite (`better-sqlite3`), Socket.io, JWT, bcrypt |
| **AI Decision Service** | Python 3.11, FastAPI, Pydantic v2, Uvicorn |
| **Optimization & ML** | Google OR-Tools (CP-SAT v9.11), scikit-learn (GradientBoostingRegressor), NumPy, Pandas |
| **Simulation Engine** | Standalone Node.js TypeScript daemon with graph topology and Haversine distance engine |

---

## 🚀 Quick Start & Setup

The system consists of 4 lightweight services. You can start them in separate terminals or run them in the background.

### Prerequisites
- **Node.js**: v18+ (tested on Node.js v20 / v24)
- **Python**: v3.10 or v3.11 (tested on Python 3.11 via `uv` / standard python)
- **Git**

---

### Step 1: AI Decision-Support Service (Python / FastAPI)

```bash
cd ai-service

# Create and activate virtual environment (or use uv)
python -m venv .venv
# On Windows:
.venv\Scripts\activate
# On Linux/macOS:
# source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start AI service on port 8001
uvicorn api.main:app --host 0.0.0.0 --port 8001
```
> *Health check:* Visit `http://localhost:8001/ai/status` (all 33 unit tests can be run with `pytest tests/ -v`).

---

### Step 2: Backend API Server (Node.js / Express / SQLite)

```bash
cd api
npm install
npm start
```
> *Server runs on `http://localhost:3000`*. Automatically initializes SQLite schema, default roles, and connects to the AI service.

---

### Step 3: Train Movement Simulator

```bash
cd simulator
npm install
npm start
```
> Simulates train movements across both Central Railway and SECR Raipur corridors, transmitting live telemetry ticks every 2 seconds to `http://localhost:3000/api/receiver`.

---

### Step 4: Frontend Web Client (React + Vite)

```bash
cd client
npm install
npm run dev
```
> Open your browser at **`http://localhost:5174`** (or `http://localhost:5173`).

---

## 🔑 Login Credentials

The database comes pre-seeded with role-based access control (RBAC):

| Role | Email Address | Password | Permissions |
| :--- | :--- | :--- | :--- |
| **Section Controller** | `controller-1@iris.com` | `Controller123!` | Simulation view, AI recommendations, what-if analyses, sector blockages |
| **System Administrator** | `admin@iris.com` | `Admin123!` | Full admin access, audit logs, user management, system diagnostics |

---

## 🎯 Hackathon & Demo Scenarios Guide

Once logged in, open the **Simulation** view, click on the **AI** tab on the right sidebar, and test the pre-built scenarios:

1. **SECR: VB vs Freight (Raipur Jn)**
   - *Scenario*: Bilaspur–Nagpur Vande Bharat Express (`SECR_VB_20825`, Priority 1) and Heavy Coal Rake (`SECR_COAL_501`, Priority 4) contend for entry into Raipur Junction.
   - *Outcome*: ML delay prediction estimates downstream delays; CP-SAT solver prioritizes Vande Bharat, holding the coal rake in loop line with minimum total weighted delay penalty.
2. **SECR: Bhilai Steel Congestion (4 trains)**
   - *Scenario*: Combinatorial congestion at Bhilai Power House junction involving Vande Bharat, Intercity Express, MEMU Special, and an outbound Steel Rake.
   - *Outcome*: Optimizer resolves multi-train precedence within < 50 ms.
3. **Attempt Unsafe Manual Override at Raipur Jn (Platform 1)**
   - *Scenario*: Controller attempts to force a train into an occupied platform track at Raipur Junction.
   - *Outcome*: **Deterministic Safety Validator immediately blocks the override** with a specific violation code (`SECTOR_OCCUPIED_VIOLATION`), proving the zero-trust safety guarantee.
4. **Interactive Sector Blockage**:
   - Navigate to the **Sector Blockage** panel, select a sector between *Bhilai Power House* and *Raipur Jn*, and report a blockage. Observe live trains automatically detecting the stop signal, speed dropping to 0, and what-if rerouting calculations.

---

## 📂 Project Structure

```
IRIS-SIH25022-upgraded/
├── ai-service/                   # Python FastAPI Decision Support Engine
│   ├── api/                      # REST endpoints (/ai/recommend, /ai/what-if, /ai/status)
│   ├── conflicts/                # Geometric conflict detection algorithms
│   ├── models/                   # GradientBoostingRegressor model & metrics
│   ├── optimization/             # Google OR-Tools CP-SAT formulation
│   ├── safety/                   # Deterministic safety constraint validator
│   └── tests/                    # 33 unit and integration tests (100% pass)
│
├── api/                          # Node.js Express API & Database
│   ├── src/controller/           # AI, Auth, Receiver, TrackStatus controllers
│   ├── src/data/                 # SQLite database (iris.db)
│   ├── src/db/                   # Database init, migrations, repositories
│   └── src/services/simulation/  # Track layouts (SECR & CR), sector blocks
│
├── client/                       # React 18 + Vite Frontend
│   ├── src/components/simulation/# SVG Corridor Map, AI Panels, Demo Mode
│   ├── src/pages/Simulation.tsx  # Main simulation operations room & corridor switcher
│   ├── src/services/             # AI, Auth, and Blockage API client services
│   └── src/utils/                # GPS-to-map projection & track parsers
│
└── simulator/                    # Corridor Movement Simulator
    ├── secrStations.json         # 20 stations of SECR Raipur Division
    ├── secrTimetable.json        # SECR passenger & freight schedules
    ├── stations.json             # Central Railway 26 station coordinates
    ├── full_timetable.json       # Central Railway suburban schedules
    └── index.ts                  # Multi-line simulation clock & telemetry emitter
```

---

## 🏆 Key Achievements & Technical Highlights

- **Proven OR-Tools Dispatching**: Replaced naive heuristics with Google OR-Tools CP-SAT integer programming, achieving optimal headway scheduling in < 50 milliseconds.
- **Explainable AI (XAI)**: Every recommendation provides mathematical justification (delay saved, priority weighting, alternative options ranked).
- **Zero Hallucination Safety**: LLMs are never used for safety-critical routing decisions; safety checks are 100% deterministic code.
- **Genuine SECR Raipur Operational Modeling**: Accurate station sequencing, distances, yard loop splits, and traffic profiles reflecting DRM Raipur's high-density operations.

---

## 📜 Acknowledgements & Academic Notice

This project was developed as a **Vocational Training (VT) Project** inspired by training at the **Office of the Divisional Railway Manager (DRM), South East Central Railway (SECR), Raipur, Chhattisgarh**. 

*Notice: This system uses mathematical modeling, synthetic training datasets, and simulated GPS telemetry for academic and demonstration purposes. It is not connected to live Indian Railways signaling systems (CRIS/COA).*
