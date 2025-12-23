## Universal Sentinel — API Keys & Secrets (Step-by-step)

This guide walks you through getting **all required keys** for `SENTINEL_MODE=LIVE`.

> Safety: **Never commit `.env`**. Keep private keys off GitHub.

---

## 0) What needs keys (and what doesn’t)

- **No API key needed**:
  - **GDACS** RSS: `https://www.gdacs.org/xml/rss.xml`
  - **NASA EONET**: `https://eonet.gsfc.nasa.gov/api/v3/events`
  - **NOAA/NWS Alerts (US storms)**: `https://api.weather.gov/alerts/active` (US-only)

- **API key required**:
  - **Gemini** (Google Generative AI) → `GEMINI_API_KEY`

- **Secret key required (optional depending on chain path)**:
  - **EVM signer** for payouts (server-side) → `SENTINEL_PRIVATE_KEY`

- **Phantom / Solana donation (LIVE UX)**:
  - **No API key required** (wallet signs locally), but you must install Phantom and have devnet SOL.

---

## 1) Get a Gemini API key (GEMINI_API_KEY)

1. Open Google AI Studio: `https://aistudio.google.com/app/apikey`
2. Click **Create API key**.
3. Copy the key.
4. Put it in `.env` as:

```env
GEMINI_API_KEY=your_key_here
```

---

## 2) Hyper-local storms (free)

Universal Sentinel uses **NOAA/NWS Active Alerts** for the “Hyper-Local” storm layer.\n\n- Endpoint: `https://api.weather.gov/alerts/active?point=lat,lon`\n- Coverage: **United States only**\n- Key required: **No**\n+
If you need global storm alerts later, add a paid provider or a second global alert feed.\n+
---

## 3) (Optional) EVM payout signer (SENTINEL_PRIVATE_KEY)

Only needed if you are actually sending EVM transactions from the backend.

1. Create a new wallet (MetaMask / CLI).
2. Export the private key (keep it secret).
3. Fund it with **testnet ETH** (e.g., Sepolia).
4. Put it in `.env` as:

```env
SENTINEL_PRIVATE_KEY=0xyour_private_key_here
```

> Stage safety: for demos you can keep payouts mocked; do not risk real funds.

---

## 4) Phantom wallet donation flow (LIVE mode)

This powers the LIVE-mode “donate to the pool” experience.

1. Install Phantom: `https://phantom.app/`
2. In Phantom, switch network to **Devnet**.
3. Get devnet SOL via a faucet/airdrop.
4. Run the app with `SENTINEL_MODE=LIVE`.
5. In the UI, click **Connect Phantom**, choose donation amount, click **Donate**.
6. You’ll get a **Solscan** receipt link.

> Note: this does not require an API key.

---

## 5) Final `.env` checklist

Minimum for LIVE ingest + Gemini:
- `SENTINEL_MODE=LIVE`
- `GEMINI_API_KEY=...`

Optional:
- `SENTINEL_PRIVATE_KEY=...` (only if doing EVM payouts)
