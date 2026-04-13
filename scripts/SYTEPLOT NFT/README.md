# SYTEPLOT NFT Scripts Documentation

This directory contains utility scripts for issuing and distributing `SYTEPLOT` on Stellar.

## Current Behavior (Important)

- Asset code: `SYTEPLOT`
- Issuer is read from env: `SYTEPLOT_ISSUER_ADDRESS`
- Destination is read from env: `SYTE_DISTRIBUTOR_ADDRESS`
- `send-payment.ts` default amount is the Stellar max issued-asset amount:
  `922337203685.4775807`
- You can override amount with `--amount=<value>` or env (`SYTEPLOT_PAYMENT_AMOUNT` / `PAYMENT_AMOUNT`)
- In API flow, business logic treats `1` token as `1` NFT unit

## Full Workflow

1. Set issuer home domain (one-time per network)
2. Set issuer authorization flags (one-time per network)
3. Fund destination account with XLM (for reserves/fees)
4. Add or update destination trustline for `SYTEPLOT`
5. Send `SYTEPLOT` payment

## Testnet Commands

```bash
# 1) Set home domain
ts-node scripts/SYTEPLOT\ NFT/set-home-domain.ts <issuerSecretKey> testnet

# 2) Set authorization flags
ts-node scripts/SYTEPLOT\ NFT/set-authorization-flags.ts <issuerSecretKey> testnet

# 3) Fund destination account (testnet only helper)
ts-node scripts/fund-testnet-accounts.ts <destinationPublicKey>

# 4) Add or update trustline
ts-node scripts/SYTEPLOT\ NFT/change-trust.ts SYTEPLOT <destinationSecretKey> testnet

# Optional custom trust limit
ts-node scripts/SYTEPLOT\ NFT/change-trust.ts SYTEPLOT <destinationSecretKey> testnet --limit 1000000

# 5) Send payment (uses .env values)
ts-node scripts/SYTEPLOT\ NFT/send-payment.ts

# Optional custom amount
ts-node scripts/SYTEPLOT\ NFT/send-payment.ts --amount=5
```

## Mainnet Commands

```bash
# 1) Set home domain
ts-node scripts/SYTEPLOT\ NFT/set-home-domain.ts <issuerSecretKey> mainnet

# 2) Set authorization flags
ts-node scripts/SYTEPLOT\ NFT/set-authorization-flags.ts <issuerSecretKey> mainnet

# 3) Fund destination account manually (no Friendbot on mainnet)

# 4) Add or update trustline
ts-node scripts/SYTEPLOT\ NFT/change-trust.ts SYTEPLOT <destinationSecretKey> mainnet

# 5) Send payment (uses .env values)
ts-node scripts/SYTEPLOT\ NFT/send-payment.ts
```

## Required Environment Variables

For `send-payment.ts`:

- `SYTEPLOT_ISSUER_ADDRESS`
- `SYTE_DISTRIBUTOR_ADDRESS`
- `SYTEPLOT_ASSET_CODE` (usually `SYTEPLOT`)
- `SYTEPLOT_ISSUER_PRIVATE_KEY` (or `SPONSOR_PRIVATE_KEY` fallback)
- `STELLAR_NETWORK` (`testnet` or `mainnet`)

Optional:

- `SYTEPLOT_PAYMENT_AMOUNT`
- `PAYMENT_AMOUNT`

## Common Errors

- `op_no_trust`: destination has no trustline
- `op_line_full`: trustline limit reached
- `op_underfunded`: source account cannot pay fees
- `op_no_account`: destination account does not exist

## Notes

- Steps must be done in order: fund -> trustline -> payment.
- `change-trust.ts` and `send-payment.ts` validate network and key formats.
- If requested payment exceeds remaining trustline capacity, the script auto-adjusts to max receivable.

