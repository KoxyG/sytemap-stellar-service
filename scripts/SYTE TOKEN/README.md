# SYTE Token Scripts Documentation

This directory contains utility scripts for managing `SYTE` token operations on Stellar.

## Current Behavior

- Asset code: typically `SYTE`
- Issuer address in `send-payment.ts` is hardcoded:
  `GDF55TDEZ4ERQEEPIIZBHSU34I5MQRZVNALBTU7OVDQZPYZUHKZDOQTC`
- `send-payment.ts` amount is hardcoded to:
  `100000000000` (100 billion tokens)

## Workflow

1. Fund destination account with XLM
2. Add or update destination trustline for `SYTE`
3. Send payment

## Testnet Commands

```bash
# 1) Fund account
ts-node scripts/fund-testnet-accounts.ts <destinationPublicKey>

# 2) Add or update trustline
ts-node scripts/SYTE\ TOKEN/change-trust.ts SYTE <destinationSecretKey> testnet

# Optional custom trust limit
ts-node scripts/SYTE\ TOKEN/change-trust.ts SYTE <destinationSecretKey> testnet --limit 1000000

# 3) Send payment (100 billion hardcoded in script)
ts-node scripts/SYTE\ TOKEN/send-payment.ts SYTE <destinationPublicKey> <issuerSecretKey> testnet
```

## Mainnet Commands

```bash
# 1) Fund account manually (no Friendbot on mainnet)

# 2) Add or update trustline
ts-node scripts/SYTE\ TOKEN/change-trust.ts SYTE <destinationSecretKey> mainnet

# 3) Send payment
ts-node scripts/SYTE\ TOKEN/send-payment.ts SYTE <destinationPublicKey> <issuerSecretKey> mainnet
```

## Script Parameters

### `change-trust.ts`

```bash
ts-node scripts/SYTE\ TOKEN/change-trust.ts <assetCode> <secretKey> <network> [--limit <limit>]
```

- `assetCode`: asset code, e.g. `SYTE`
- `secretKey`: account secret key that owns the trustline
- `network`: `testnet` or `mainnet`
- `--limit`: optional trustline limit (default is Stellar max)

### `send-payment.ts`

```bash
ts-node scripts/SYTE\ TOKEN/send-payment.ts <assetCode> <destinationAccount> <issuerSecretKey> <network>
```

- `assetCode`: token asset code, e.g. `SYTE`
- `destinationAccount`: destination public key
- `issuerSecretKey`: secret key for issuer account
- `network`: `testnet` or `mainnet`

## Common Errors

- `op_no_trust`: destination trustline missing
- `op_line_full`: destination trustline limit reached
- `op_underfunded`: source account cannot pay fees
- `op_no_account`: destination account not found on selected network

## Notes

- Steps must be done in order: fund -> trustline -> payment.
- Use the same network consistently across all commands.
- Ensure issuer secret key matches the issuer account expected by the script.
