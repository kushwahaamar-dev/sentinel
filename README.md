# Universal Sentinel — AI-Triggered Smart Treasury

**Programmable Philanthropy: Zero-Delay Humanitarian Aid**

When disasters strike, traditional aid takes weeks to reach victims due to bureaucracy. Universal Sentinel eliminates this delay by automatically detecting disasters, analyzing them with AI, and instantly releasing funds to pre-verified NGOs on the blockchain.

## 🎯 The Solution

**Disaster Detection → AI Authorization (YES/NO) → NGO Selection → Instant Blockchain Payout**

1. **Observer (Python)**: Monitors real-time disaster APIs (GDACS, NASA EONET, NOAA NWS) every 60 seconds
2. **Judge (AI/LLM)**: Analyzes disaster data and returns strict **YES** or **NO** authorization
3. **Vault (Smart Contract)**: Holds funds and releases them only when AI agent authorizes
4. **NGO System**: Pre-verified humanitarian organizations receive funds automatically

## 🏗️ Architecture

### The Vault (Smart Contract)
- **File**: `contracts/UniversalSentinel.sol`
- **Function**: `disbursePayout(address to, uint256 amount, string reason)`
- **Security**: Only the AI agent's wallet (`riskOfficer`) can trigger payouts
- **Deployable**: Works on Sepolia testnet or any EVM chain

### The Observer (Python Agent)
- **File**: `backend/services/ingestion.py`
- **LIVE Mode**: Polls real APIs every 60 seconds:
  - GDACS (earthquakes, floods, tsunamis)
  - NASA EONET (wildfires, volcanoes)
  - NOAA NWS (hurricane warnings, severe weather)
- **MOCK Mode**: Loads scenarios from `backend/data/scenarios.json`
- **Output**: Standardized `SourceEvent` objects

### The Judge (AI Decision Layer)
- **File**: `backend/agent.py`
- **Input**: Disaster type, raw telemetry, location coordinates
- **Output**: **Strict YES/NO authorization** (plus structured reasoning for logging)
- **Model**: Google Gemini 1.5 Flash (with intelligent fallback if unavailable)
- **Safety**: Any malformed response defaults to **NO**

### NGO Verification System
- **File**: `backend/services/ngo_manager.py`
- **Data**: `backend/data/ngos.json` (pre-verified NGO wallets)
- **Features**:
  - Address validation (Ethereum format + verification check)
  - Region-based selection (matches disaster location to NGO coverage)
  - Disaster type matching (earthquake → Red Cross, storm → Salvation Army, etc.)
- **Security**: Only verified NGO addresses can receive funds

## 📋 End-to-End Flow

```
1. DISASTER DETECTED
   └─> Observer polls APIs → Event detected at coordinates

2. AI AUTHORIZATION
   └─> Judge analyzes: "Is this catastrophic? Near populated area?"
   └─> Returns: YES or NO (strict binary)

3. NGO SELECTION (if YES)
   └─> System selects appropriate NGO based on:
       - Disaster type (earthquake → Red Cross)
       - Region (Asia → UNICEF Asia Pacific)
       - Verification status

4. ADDRESS VALIDATION
   └─> Verifies NGO wallet is:
       - Valid Ethereum address format
       - Pre-verified in system
       - Matches disaster requirements

5. BLOCKCHAIN TRANSACTION
   └─> MOCK Mode: Generates mock transaction hash (safe for demos)
   └─> LIVE Mode: Executes real transaction on Sepolia/testnet
   └─> Returns transaction hash → Etherscan link

6. VAULT BALANCE UPDATE
   └─> Balance decreases by payout amount
   └─> Transaction logged to database
```

## 🚀 Setup & Running

### Backend Setup

```bash
cd universal-sentinel
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp env.example .env  # Edit with your keys
```

**Run the server:**
```bash
uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
```

### Frontend Setup

```bash
cd universal-sentinel/frontend
npm install
npm run dev
```

Open `http://localhost:5173`

## ⚙️ Environment Variables

### Required for Basic Operation
- `SENTINEL_MODE` — `MOCK` (offline demos) or `LIVE` (real APIs)
- `GEMINI_API_KEY` — Google AI Studio API key (optional, uses fallback if missing)

### Required for LIVE Blockchain Transactions
- `SENTINEL_PRIVATE_KEY` — EVM private key for AI agent wallet (0x...)
- `RPC_URL` — Ethereum RPC endpoint (e.g., `https://sepolia.infura.io/v3/YOUR_KEY`)
- `CONTRACT_ADDRESS` — Deployed `UniversalSentinel.sol` contract address
- `CHAIN_ID` — Chain ID (e.g., `11155111` for Sepolia)

### Optional
- `ETHERSCAN_BASE_URL` — For transaction links (default: `https://etherscan.io/tx/`)
- `OWM_API_KEY` — OpenWeatherMap (not required, uses NWS instead)

## 🎮 Modes: LIVE vs MOCK

### MOCK Mode (Demo/Offline)
- **Purpose**: Reliable demos without internet or API keys
- **Data Source**: `backend/data/scenarios.json` (3 pre-loaded disasters)
- **Blockchain**: Uses mock transaction hashes (safe, no real funds)
- **Use Case**: Hackathon presentations, offline testing

**How to Run:**
1. Set `SENTINEL_MODE=MOCK` in `.env`
2. Use Dev Tools (bottom-right) → Trigger Quake/Fire/Storm
3. Watch: Globe animation → AI analysis → Mock transaction → Vault drain

**MOCK Mode Transparency:**
- **NGO Information**: After payout, command log shows:
  - Full NGO name
  - Complete wallet address (0x...)
  - Payout timestamp
- **Stats Updates**: 
  - Vault balance updates immediately after payout
  - Total payouts count increments
  - Last payout info visible in Stats panel
  - All stats persist across page refreshes (stored in database)
- **Viewing NGO Info**:
  - Command log: Shows "NGO RECIPIENT: [Name] | Address: [Full Address]"
  - Stats panel: Click "Stats" → See last payout with NGO details
  - History panel: Click "History" → See all payouts with NGO info

### LIVE Mode (Production-Ready)
- **Purpose**: Real disaster monitoring and automated payouts
- **Data Source**: Real-time APIs (GDACS, NASA, NOAA)
- **Blockchain**: Executes real transactions if fully configured
- **Use Case**: Actual humanitarian aid deployment

**How to Run:**
1. Set `SENTINEL_MODE=LIVE` in `.env`
2. Configure blockchain variables (RPC_URL, CONTRACT_ADDRESS, CHAIN_ID)
3. System automatically polls APIs every 60 seconds
4. Click events on globe → "Run AI Analysis" → Real payout (if authorized)

**LIVE Mode Disaster Detection Pop-Up:**
- **Automatic Display**: When a qualifying disaster is detected, a pop-up appears showing:
  - Disaster type, location (coordinates + region name), severity
  - All eligible NGOs/INGOs with:
    - Name and wallet address
    - Region of operation
    - Disaster types supported
    - INGO vs NGO distinction
  - Selected recipient highlighted with selection reason
- **Non-Blocking**: Pop-up is informational only
  - No human approval required
  - Automation continues autonomously
  - Can be closed manually (does not affect execution)
- **Transparency**: All displayed NGOs come from verified system
  - Matches actual payout logic
  - Same data shown in logs and final transaction

**Safety**: If blockchain not fully configured, LIVE mode uses mock transactions with clear logging

## 📊 Demo Instructions for Judges

### Step-by-Step Demo Flow

1. **Show the Vault Balance**
   - Top-right card shows current USDC balance (e.g., $10,000)
   - Explain: "This is the smart contract vault holding humanitarian funds"

2. **Trigger a Disaster (MOCK Mode)**
   - Click Dev Tools (bottom-right) → "Trigger: Quake"
   - **What Judges See**:
     - Globe spins to Tokyo
     - Event appears with pulsing red ring
     - Command log shows: "STEP 1: DISASTER DETECTED"

3. **AI Authorization Step**
   - Command log shows: "STEP 2: AI AUTHORIZATION = YES"
   - AI reasoning displayed: "Magnitude 8.2 earthquake... Population 14M... Parametric trigger: ACTIVATED"
   - **Key Point**: Emphasize strict YES/NO decision (not ambiguous)

4. **NGO Selection & Transparency**
   - Command log shows: "STEP 3: NGO SELECTED - [NGO Name] ([Full Address])"
   - Command log shows: "NGO RECIPIENT: [Name] | Address: [Full 0x... address]"
   - Command log shows: "PAYOUT TIMESTAMP: [Date/Time]"
   - **Stats Panel** (click "Stats" button): Shows last payout with NGO name, address, and timestamp
   - Explain: "System automatically selected verified NGO based on disaster type and region"

5. **Blockchain Transaction**
   - Command log shows: "STEP 4: INITIATING BLOCKCHAIN TRANSACTION..."
   - Command log shows: "STEP 5: PAYOUT COMPLETE - $8,200 USDC to [NGO Name]"
   - Transaction hash appears (clickable Etherscan link)
   - **In MOCK**: Hash is mock (safe for demo)
   - **In LIVE**: Hash is real (if blockchain configured)

6. **Vault Balance & Stats Update**
   - Balance decreases from $10,000 → $1,800 (updates immediately)
   - **Stats Panel** shows:
     - Updated vault balance
     - Total payouts count
     - Total amount disbursed
     - Last payout details (NGO name, address, timestamp)
   - Explain: "Funds instantly transferred to NGO wallet on blockchain"

### LIVE Mode: Disaster Detection Pop-Up

When a qualifying disaster is detected in LIVE mode:

1. **Automatic Pop-Up Appears**
   - Shows disaster type, location, severity
   - Lists all eligible NGOs/INGOs
   - Highlights selected recipient
   - **Non-blocking**: Automation continues without human approval

2. **NGO/INGO Visibility**
   - All verified NGOs shown with:
     - Name and wallet address
     - Region of operation
     - Disaster types supported
     - INGO vs NGO distinction
   - Selected NGO highlighted with reason

3. **Transparency**
   - Shows why each NGO is eligible
   - Shows why specific NGO was selected
   - All data matches actual payout logic

### What to Highlight
- ✅ **Zero human intervention** — fully automated
- ✅ **Strict YES/NO authorization** — no ambiguous decisions
- ✅ **Pre-verified NGOs only** — security built-in
- ✅ **Real-time disaster detection** — monitors global feeds
- ✅ **Transparent logging** — every step visible
- ✅ **NGO transparency** — full address and timestamp visible
- ✅ **Stats auto-update** — balance and counts refresh after payouts

## 🔒 Security Guarantees

1. **Authorization Enforcement**
   - Only explicit "YES" from AI triggers payout
   - Any malformed/ambiguous response defaults to "NO"
   - No payout can occur without AI authorization

2. **NGO Verification**
   - Only addresses in `backend/data/ngos.json` can receive funds
   - Address format validation (Ethereum checksum)
   - Region and disaster type matching required

3. **Smart Contract Security**
   - Only `riskOfficer` wallet can call `disbursePayout()`
   - Maximum payout cap enforced on-chain
   - All transactions are immutable and auditable

4. **Private Key Safety**
   - Keys stored only in `.env` (never committed)
   - Server-side signing only (never exposed to frontend)
   - Demo mode uses mock transactions (no real keys needed)

## 📁 Project Structure

```
universal-sentinel/
├── backend/
│   ├── main.py                 # FastAPI app, orchestrates pipeline
│   ├── agent.py                # AI Judge (Gemini + fallback)
│   ├── database.py             # SQLite persistence
│   ├── config.py               # Settings from .env
│   ├── services/
│   │   ├── ingestion.py        # Observer (API polling)
│   │   ├── onchain.py          # Blockchain transaction executor
│   │   ├── ngo_manager.py      # NGO verification & selection
│   │   └── onchain_solana.py   # Solana alternative (optional)
│   └── data/
│       ├── scenarios.json      # MOCK mode scenarios
│       └── ngos.json           # Pre-verified NGO wallets
├── contracts/
│   └── UniversalSentinel.sol   # Smart contract vault
├── frontend/
│   └── src/                    # React War Room UI
└── requirements.txt            # Python dependencies
```

## 🔧 NGO Management

### Adding New NGOs

Edit `backend/data/ngos.json`:

```json
{
  "id": "ngo-example",
  "name": "Example NGO",
  "address": "0x...",
  "verified": true,
  "disaster_types": ["earthquake", "flood"],
  "regions": ["asia", "global"],
  "description": "NGO description"
}
```

**Selection Logic:**
1. Must be `verified: true`
2. Must support the disaster type
3. Prefers region-specific NGOs (e.g., Asia disaster → UNICEF Asia)
4. Falls back to global NGOs if no region match

## 🧪 Testing

### Test MOCK Mode
```bash
# Set in .env
SENTINEL_MODE=MOCK

# Trigger via UI or API
curl -X POST http://127.0.0.1:8000/simulate \
  -H "Content-Type: application/json" \
  -d '{"scenario_type": "quake"}'
```

### Test LIVE Mode
```bash
# Set in .env
SENTINEL_MODE=LIVE
GEMINI_API_KEY=your_key

# System auto-polls every 60 seconds
# Or trigger manual analysis:
curl -X POST http://127.0.0.1:8000/analyze \
  -H "Content-Type: application/json" \
  -d '{"id": "...", "source": "gdacs", ...}'
```

## 📝 Logging & Transparency

All steps are logged to:
- **Database**: `sentinel.db` (SQLite)
- **Command Log**: Frontend streaming terminal
- **Backend Logs**: Console output

**Log Format:**
```
STEP 1: DISASTER DETECTED - [description]
STEP 2: AI AUTHORIZATION = YES | Decision: PAYOUT (98% Confidence)
AI REASONING: [detailed reasoning]
STEP 3: NGO SELECTED - [NGO name] ([address])
STEP 4: INITIATING BLOCKCHAIN TRANSACTION...
STEP 5: PAYOUT COMPLETE - [amount] USDC to [NGO]
TRANSACTION HASH: [hash]
```

## 🚨 Important Notes

1. **Demo Safety**: MOCK mode always uses mock transactions (no real blockchain calls)
2. **LIVE Mode**: Requires full blockchain configuration for real transactions
3. **NGO Addresses**: Example addresses in `ngos.json` are placeholders — replace with real verified wallets
4. **Contract Deployment**: Deploy `UniversalSentinel.sol` to testnet before using LIVE mode
5. **API Keys**: Gemini key is optional (system uses intelligent fallback if missing)

## 🎯 Final Checklist

- ✅ Vault (Smart Contract) — Deployed and functional
- ✅ Observer (Python) — Polls real APIs + MOCK scenarios
- ✅ Judge (AI) — Returns strict YES/NO authorization
- ✅ NGO System — Pre-verified wallets with selection logic
- ✅ Address Validation — Ethereum format + verification checks
- ✅ Blockchain Integration — Real transactions in LIVE mode (if configured)
- ✅ Logging — Complete transparency for demos
- ✅ Demo Mode — Reliable offline operation
- ✅ Live Mode — Real disaster monitoring

## 📚 Additional Resources

- **API Keys Setup**: See `API_KEYS_SETUP.md`
- **Smart Contract**: Deploy to Sepolia using Remix or Hardhat
- **Frontend**: Built with React, Vite, Tailwind, Three.js

---

**Built for Hackathons | Production-Ready Architecture | Zero-Delay Humanitarian Aid**
