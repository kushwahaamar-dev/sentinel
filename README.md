# Universal Sentinel — Autonomous Parametric Desk

Disaster data in → AI verifies → Crypto payout out. This repo contains:
- **Backend**: FastAPI server with an ingestion switchboard (GDACS, NASA EONET, OWM) and a Gemini-powered "Risk Officer" agent.
- **Database**: SQLite (`sentinel.db`) for persisting event logs, decisions, and history.
- **On-chain**: 
    - **EVM**: `contracts/UniversalSentinel.sol` (minimal payout vault) and `services/onchain.py` (Web3 signer).
    - **Solana**: `services/onchain_solana.py` (Solana/Anchor integration helper).
- **UI**: "War Room" dashboard (React/Vite/Tailwind) featuring a real-time globe visualization, streaming command logs, and AI analysis cards.

> **Note**: By default, the `main.py` application **mocks** the final on-chain transaction for safety and demonstration purposes. To enable real on-chain payouts, uncomment the `PayoutTransactor` logic in `backend/main.py` and ensure your `.env` keys are set.

## Project structure
- `backend/`
  - `main.py`: FastAPI entry point. Orchestrates the ingestion -> analyze -> payout pipeline.
  - `agent.py`: Gemini AI wrapper. Handles prompt engineering and JSON decision parsing.
  - `database.py`: SQLModel setup for SQLite database (`sentinel.db`).
  - `services/ingestion.py`: Polling logic for GDACS, EONET, and NWS. Standardizes events into `SourceEvent`.
  - `services/onchain.py`: Web3.py logic to sign/send `disbursePayout` transactions to the EVM contract.
  - `services/onchain_solana.py`: Helper for Solana SPL token transfers (alternative chain option).
  - `data/scenarios.json`: Canned events for `MOCK` mode (Tokyo quake, Miami hurricane, etc.).
  - `config.py`: Configuration loader using Pydantic and `.env`.
- `contracts/UniversalSentinel.sol`: Solidity smart contract for the insurance vault. Features `riskOfficer` role and `maxPayout` limits.
- `frontend/`: React + Vite application.
  - `src/components/GlobeView.tsx`: Interactive 3D globe visualization.
  - `src/App.tsx`: Main dashboard logic handling `LIVE`/`MOCK` modes and polling.
- `requirements.txt`: Python dependencies (FastAPI, Web3, Google Generative AI, etc.).
- `sentinel.db`: SQLite database file (created on first run).

## Environment variables (copy `env.example` → `.env`)
- `SENTINEL_MODE` — `MOCK` (uses `scenarios.json`) or `LIVE` (polls real APIs).
- `GEMINI_API_KEY` — Google Generative AI key.
- `OWM_API_KEY` — OpenWeatherMap One Call 3.0 key (free tier works).
- `SENTINEL_PRIVATE_KEY` — EVM private key for the "Risk Officer" wallet (server side). **Do not commit.**
- `ETHERSCAN_BASE_URL` — Base URL for transaction links (e.g., Sepolia Etherscan).
- `SOLANA_RPC_URL` — Your Solana RPC (if using Solana).
- `SOLANA_USDC_MINT` — SPL USDC mint address.
- `SOLANA_PRIVATE_KEY` — Solana private key (if using Solana).

## Setup & Running

### 1. Backend
```bash
cd universal-sentinel
python -m venv .venv
source .venv/bin/activate  # or .venv\Scripts\activate on Windows
pip install -r requirements.txt
cp env.example .env        # Edit .env with your keys
```

Run the server:
```bash
uvicorn backend.main:app --reload
```
The API will be available at `http://localhost:8000`.

### 2. Frontend
```bash
cd universal-sentinel/frontend
npm install
npm run dev
```
Open `http://localhost:5173`.

## Dashboard Features

- **Mode Toggle**: Switch between `LIVE` and `MOCK` modes directly from the UI or via API.
- **Real-time Globe**: Visualizes disaster locations. In `LIVE` mode, this updates from real data feeds.
- **Command Log**: Streams system events, AI "reasoning" steps, and transaction statuses.
- **Policy Viewer**: Shows the current parametric triggers (e.g., "Earthquake > Mag 6.5").
- **Simulation Tools**: In `MOCK` mode, use the "DevTools" panel to instantly trigger specific disaster scenarios.

## AI & Logic

The core logic resides in `backend/agent.py`. It constructs a prompt for the Gemini 1.5 Flash model including:
1. The raw disaster data (magnitude, location, severity).
2. The active policy parameters.
3. Instructions to act as a conservative "Risk Officer".

The AI returns a structured JSON decision: `PAYOUT` or `DENY`, along with a confidence score and reasoning.

## On-Chain Integration

### EVM (Default Path)
The `UniversalSentinel.sol` contract is designed to be deployed on an EVM chain (Ethereum, Base, Polygon, etc.).
- **Roles**: `treasury` (can fund/sweep) and `riskOfficer` (can payout).
- **Flow**: The backend (holding the `riskOfficer` key) calls `disbursePayout(recipient, amount, reason)`.

### Solana (Alternative)
The project includes `onchain_solana.py` to demonstrate how this could work on Solana using SPL transfers. To use this, you would modify `backend/main.py` to use the Solana service instead of the EVM transactor.

## Security & Best Practices
- **Private Keys**: Stored only in `.env`. Never committed.
- **Server-Side Signing**: Keys are held by the backend, not the frontend client. The UI only receives the transaction hash.
- **Max Payout**: The smart contract enforces a hard cap on payouts per transaction to limit loss in case of a compromised agent.