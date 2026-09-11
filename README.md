## IRIS — SIH25022: Maximizing Section Throughput Using AI-Powered Precise Train Traffic Control

IRIS simulates the Mumbai suburban Central Line (CSMT–Kalyan, 26
stations) and adds a genuine AI/optimization decision-support layer on
top: ML delay prediction, deterministic conflict detection, a Google
OR-Tools CP-SAT optimizer, and a deterministic safety validator with
final veto power. See ARCHITECTURE.md, AI_MODEL.md, OPTIMIZATION.md,
SAFETY.md, API.md, DEMO.md, and DATA.md for full detail on each piece,
and DATA.md in particular for an explicit IMPLEMENTED / SIMULATED /
MOCK / FUTURE breakdown — nothing here is claimed to be connected to
real Indian Railways systems or real operational data.

## Setup and Running the Project

### Turn on: AI service, then API, then Simulator, then Frontend

### AI Decision-Support Service (Python/FastAPI, NEW)
```bash
cd ai-service
pip install -r requirements.txt
python training/train_model.py --rows 8000   # trains the delay model (one-time, or if models/ is missing)
uvicorn api.main:app --port 8001
```
Run tests: `cd ai-service && python -m pytest tests/ -v`

### Server (API) 
- Open a terminal and run:

```bash
cd api
npm install
npm start
```
Run tests: `npm test` (Jest; uses an isolated `src/data/test_iris.db`, never the real DB)

Optional env var: `AI_SERVICE_URL` (defaults to `http://localhost:8001`)

### Simulator
- Open a terminal and run:

```bash
cd simulator
npm install
npm start
```

### Client (Frontend)
- In a **new terminal**, run:

```bash
cd client
npm install
npm run dev
```

Open the app, log in as a `section_controller` (or `system_admin`),
go to the **Simulation** page, and click the **AI** tab — see DEMO.md
for a full walkthrough with one-click demo scenarios, including an
unsafe-override rejection demo.





