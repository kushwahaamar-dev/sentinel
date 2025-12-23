# Universal Sentinel — Autonomous Parametric Desk

Disaster data in → AI verifies → Crypto payout out. This repo contains:
- **Backend**: ingestion switchboard (GDACS, NASA EONET, OWM), Gemini risk officer, mock scenarios.
- **On-chain (EVM stub)**: minimal payout vault in `contracts/UniversalSentinel.sol` plus Python Web3 signer.
- **UI**: War Room dashboard (React/Vite/Tailwind/FraMer Motion/react-globe.gl) with globe pulses, terminal log, AI decision card, and hidden dev tools for simulations.

> Note: Current on-chain path is EVM. If presenting with Phantom/Solana, swap to a Solana program + client (see “Solana option” below).

## Project structure
- `backend/`
  - `services/ingestion.py`: GDACS/EONET/OWM polling + mock loader via SENTINEL_MODE.
  - `agent.py`: Gemini CRO prompt and JSON decision parsing (MOCK-mode deterministic fallback).
  - `services/onchain.py`: Web3 payout signer/sender for UniversalSentinel contract (EVM stub).
  - `services/onchain_solana.py`: Solana payout helper (SPL USDC from vault ATA to recipient).
  - `data/scenarios.json`: Three canned scenarios (Tokyo quake, Miami cane, Yellowstone anomaly).
  - `config.py`: pydantic settings loader from `.env`.
- `contracts/UniversalSentinel.sol`: EVM vault contract (risk officer gated payouts, max cap).
- `frontend/`: React/Vite/Tailwind War Room UI (globe, streaming log, AI card, dev tools).
- `requirements.txt`: Backend deps (FastAPI, Solana, Anchorpy, Gemini, httpx, etc.).
- `env.example`: Copy to `.env` and fill secrets.

## Environment variables (copy `env.example` → `.env`)
- `SENTINEL_MODE` — `MOCK` (use scenarios.json) or `LIVE` (hit GDACS/EONET/OWM).
- `GEMINI_API_KEY` — Google Generative AI key.
- `OWM_API_KEY` — OpenWeatherMap One Call 3.0 key (free tier works).
- `SENTINEL_PRIVATE_KEY` — EVM private key for payout signer (server side). **Do not commit.**
- `ETHERSCAN_BASE_URL` — Etherscan base (unused if you switch to Solana).
- `SOLANA_RPC_URL` — Your Solana RPC (mainnet-beta or devnet).
- `SOLANA_PROGRAM_ID` — Your program ID (if you deploy a custom Anchor program).
- `SOLANA_USDC_MINT` — SPL USDC mint (e.g., devnet: So111... for wrapped SOL or dev USDC).
- `SOLANA_VAULT_ATA` — Vault ATA holding USDC for payouts.
- `SOLANA_PRIVATE_KEY` — Base58 or JSON array secret key for server-side signer. Keep off Git.

### How to get the keys
- Gemini: https://aistudio.google.com/app/apikey
- OpenWeatherMap: https://home.openweathermap.org/api_keys (One Call 3.0)
- EVM key: create via your wallet/CLI; fund with testnet ETH/USDC for demos. Keep off Git.
- Solana (if swapping chains): generate a keypair via `solana-keygen new`, store the secret off-repo; use Phantom for UI signing if desired.

## Backend setup
```bash
cd universal-sentinel
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp env.example .env  # then fill values
```

Run the API server:
```bash
uvicorn backend.main:app --reload
```

## Frontend setup
```bash
cd universal-sentinel/frontend
npm install
npm run dev
```
Open `http://localhost:5173`. Dev Tools (bottom-right) trigger mock quake/fire; shows globe pulses, AI card, vault drain, and an Etherscan link placeholder.

## Modes
- `MOCK`: loads `backend/data/scenarios.json`; UI dev tools simulate events without internet.
- `LIVE`: polls GDACS RSS, NASA EONET, and OWM for high-risk cities. Handle network loss gracefully (“Signal Lost” logged).

## Solana path (Phantom-friendly)
- Program: deploy an Anchor program exposing `payout(recipient, amount, reason)` with authority checks and a USDC vault ATA.
- Backend: use `backend/services/onchain_solana.py` (solana-py/anchorpy) to sign and send payout transfers; return the signature for a Solscan link.
- UI: already points receipts to `https://solscan.io/tx/<sig>`. Optionally add Phantom connect for client-side signing; safest demo is server-signed.

## Demo checklist
- Fill `.env` (never commit real keys). For stage, use fresh/regenerated keys.
- Choose mode: `SENTINEL_MODE=MOCK` for offline demos; `LIVE` for real feeds.
- Ensure internet for globe textures and live APIs.
- Watch the AI card show “Processing...” during Gemini calls.
- Etherscan/Solscan link should open in a new tab after payout hash/signature is returned.

## Security & hygiene
- Secrets stay in `.env` only. Regenerate any key that was ever in versioned files.
- Keep signer keys server-side; don’t ship them to the browser.
- Fund the payout vault with test assets for demos; set `maxPayout` conservatively.
