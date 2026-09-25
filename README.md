# TOMBOY

TOM-only Solana treasury and market-operations Telegram bot.

## Fixed asset
- TOM mint: `8GPzPsLp4ZFveMKjVrPA7giEBEcAY5Yo2X3QysvJQgTE`
- Treasury: `DmqV7Utif7TEruBkd4AuLrzp2Zw2VpoaPP1tgjjoxcqf`
- Network: Solana mainnet-beta

## What is built
- Telegram control panel
- TOM market lookup through Dexscreener
- Treasury SOL balance
- On-chain transaction verification
- PostgreSQL event/execution logging
- Jupiter-routed treasury swaps with a configurable SOL cap
- Execution disabled by default
- Treasury-key/address consistency check
- Railway/Docker-ready health endpoint

## Commands
- `/start` — open TOMBOY controls
- `/buy 0.05` — submit a capped treasury buy when execution is explicitly enabled
- `/verify <signature>` — verify a transaction on Solana

## Safety boundary
TOMBOY is intentionally not a wash-trading, fake-holder, fake-volume, or disguised-organic-activity system. It is for transparent treasury/liquidity operations and monitoring.

## Environment
Copy `.env.example` to `.env`.
Never commit `TREASURY_PRIVATE_KEY`.
Keep `EXECUTION_ENABLED=false` until the deployment, treasury key and limits have been reviewed.

## Local
```bash
npm install
npm run build
npm start
```

## Railway
Use the repository root as the service root. Set the variables from `.env.example`. Railway will use the Dockerfile automatically.
