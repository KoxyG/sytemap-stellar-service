# Scripts Documentation

This directory contains utility scripts for the Stellar Service.

## SYTE Token Workflow

This section documents the complete workflow for distributing SYTE tokens to accounts. The process consists of three steps:

1. **Fund Accounts** - Fund accounts with XLM (required for transaction fees)
2. **Change Trust** - Add trustline for SYTE asset (required to receive SYTE tokens)
3. **Send Payment** - Send 1 million SYTE tokens to the destination account

### SYTE Token Configuration

- **Asset Code**: `SYTE`
- **Issuer Address**: `GDF55TDEZ4ERQEEPIIZBHSU34I5MQRZVNALBTU7OVDQZPYZUHKZDOQTC`
- **Payment Amount**: 1,000,000 tokens (hardcoded)

### Complete Workflow for Testnet

#### Step 1: Fund Account with XLM

```bash
# Fund a single account
ts-node scripts/fund-testnet-accounts.ts <accountPublicKey>

# Example:
ts-node scripts/fund-testnet-accounts.ts GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEF
```

#### Step 2: Add Trustline for SYTE Asset

```bash
# Add trustline for SYTE asset
ts-node scripts/change-trust.ts SYTE <accountSecretKey> testnet

# Example:
ts-node scripts/change-trust.ts SYTE <distributor/destinationSecretKey> testnet
```

#### Step 3: Send Payment (1 Million SYTE Tokens)

```bash
# Send 1 million SYTE tokens to destination account
ts-node scripts/send-payment.ts SYTE <destinationAccount> <issuerSecretKey> testnet

# Example:
ts-node scripts/send-payment.ts SYTE GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEF S... testnet
```

### Complete Workflow for Mainnet

#### Step 1: Fund Account with XLM

**Note**: The `fund-testnet-accounts.ts` script only works on testnet. For mainnet, you'll need to fund accounts manually or use a different method.

#### Step 2: Add Trustline for SYTE Asset

```bash
# Add trustline for SYTE asset
ts-node scripts/change-trust.ts SYTE <accountSecretKey> mainnet

# Example:
ts-node scripts/change-trust.ts SYTE SABHTYOSSTOKCN2VS5HQJSCH7FWA3K6FNCEFKH6XPU4IPOT24DACXFQR mainnet
```

#### Step 3: Send Payment (1 Million SYTE Tokens)

```bash
# Send 1 million SYTE tokens to destination account
ts-node scripts/send-payment.ts SYTE <destinationAccount> <issuerSecretKey> mainnet

# Example:
ts-node scripts/send-payment.ts SYTE GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEF S... mainnet
```

### Quick Reference: Complete SYTE Token Distribution

**Testnet:**

```bash
# 1. Fund account
ts-node scripts/fund-testnet-accounts.ts <accountPublicKey>

# 2. Add trustline
ts-node scripts/change-trust.ts SYTE <accountSecretKey> testnet

# 3. Send payment
ts-node scripts/send-payment.ts SYTE <accountPublicKey> <issuerSecretKey> testnet
```

**Mainnet:**

```bash
# 1. Fund account (manual or other method - fund-testnet-accounts.ts only works on testnet)

# 2. Add trustline
ts-node scripts/change-trust.ts SYTE <accountSecretKey> mainnet

# 3. Send payment
ts-node scripts/send-payment.ts SYTE <accountPublicKey> <issuerSecretKey> mainnet
```

### Important Notes

- **Order Matters**: Steps must be completed in order (fund → trustline → payment)
- **Account Requirements**:
  - Account must be funded with XLM before adding trustline (for transaction fees)
  - Account must have trustline before receiving SYTE tokens
- **Issuer Secret Key**: Required for Step 3 (payment). The secret key must correspond to the hardcoded issuer address.
- **Testnet vs Mainnet**: Use `testnet` or `mainnet` parameter consistently across all commands for the same network.

## Fund Testnet Accounts

The `fund-testnet-accounts.ts` script funds Stellar accounts on the testnet using the Friendbot API (free test XLM).

### Prerequisites

- Node.js and npm installed
- TypeScript and ts-node installed (`npm install`)
- `.env` file configured with `STELLAR_HORIZON_URL` (should point to testnet)

### Usage

#### Basic Commands

```bash
# Fund a single account
ts-node scripts/fund-testnet-accounts.ts <publicKey>

# Fund multiple accounts
ts-node scripts/fund-testnet-accounts.ts <publicKey1> <publicKey2> <publicKey3>

# Fund accounts from a file (one public key per line)
ts-node scripts/fund-testnet-accounts.ts --file accounts.txt
```

### Examples

```bash
# Fund a single testnet account
ts-node scripts/fund-testnet-accounts.ts GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEF

# Fund multiple accounts at once
ts-node scripts/fund-testnet-accounts.ts \
  GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEF \
  GDEF1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEF \
  GHIJ1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEF

# Fund accounts from a text file
ts-node scripts/fund-testnet-accounts.ts --file testnet-accounts.txt
```

### File Format

When using `--file`, create a text file with one Stellar public key per line:

```text
# accounts.txt
GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEF
GDEF1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEF
GHIJ1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEF
```

Lines starting with `#` are treated as comments and ignored.

### Output

The script provides:

- **Real-time progress** for each account being funded
- **Transaction hashes** for successful funding
- **Account balances** after funding
- **Summary** with success/failure counts

Example output:

```
🌟 Stellar Testnet Account Funding Script

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Configuration:
   Network: testnet
   Horizon URL: https://horizon-testnet.stellar.org
   Method: Friendbot (testnet only)
   Accounts to fund: 2

💰 Funding account: GABC123...
   Using Friendbot...
   ✅ Success! Transaction: abc123def456...
   💵 Balance: 10000.0000000 XLM

💰 Funding account: GDEF456...
   Using Friendbot...
   ✅ Success! Transaction: def456ghi789...
   💵 Balance: 10000.0000000 XLM

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 Summary:

✅ Successful: 2
❌ Failed: 0
📝 Total: 2
```

### Notes

- **Testnet Only**: This script uses Friendbot, which only works on the Stellar testnet
- **Rate Limiting**: The script includes a 2-second delay between funding requests to avoid rate limits
- **Account Validation**: Public keys are automatically validated before funding
- **Balance Verification**: The script verifies account balance after funding (may take a few seconds)

### Troubleshooting

**Error: "Invalid Stellar public key format"**

- Ensure the public key starts with `G` and is 56 characters long
- Check for typos or extra spaces

**Error: "Friendbot request failed"**

- Friendbot may be rate-limited - wait a few minutes and try again
- Ensure you're using testnet public keys (not mainnet)

**Error: "STELLAR_HORIZON_URL is not set"**

- Add `STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org` to your `.env` file

## Change Trust

The `change-trust.ts` script adds or updates a trustline for a specific asset. The issuer address is hardcoded. The account public key is automatically derived from the provided secret key.

### Prerequisites

- Node.js and npm installed
- TypeScript and ts-node installed (`npm install`)

### Usage

```bash
# Add/update trustline for an asset
ts-node scripts/change-trust.ts <assetCode> <secretKey> <network>

# Add/update trustline with custom limit
ts-node scripts/change-trust.ts <assetCode> <secretKey> <network> --limit <limit>
```

### Examples

```bash
# Add trustline for SYTE asset on testnet (default max limit)
ts-node scripts/change-trust.ts SYTE S... testnet

# Add trustline for SYTE asset on mainnet with custom limit
ts-node scripts/change-trust.ts SYTE S... mainnet --limit 1000000
```

### Parameters

- `assetCode` - The asset code (e.g., "SYTE")
- `secretKey` - The secret key of the account adding the trustline (account public key will be derived from this)
- `network` - Either "testnet" or "mainnet"
- `--limit` (optional) - Trust limit (default: max limit `922337203685.4775807`)

### Notes

- **Issuer Address**: Hardcoded to `GDF55TDEZ4ERQEEPIIZBHSU34I5MQRZVNALBTU7OVDQZPYZUHKZDOQTC`
- **Account Derivation**: The account public key is automatically derived from the provided secret key
- **Network Selection**: The script uses the appropriate Horizon URL based on the network parameter
- **Trustline Updates**: If a trustline already exists, it will be updated with the new limit

## Send Payment

The `send-payment.ts` script sends a payment of a custom asset to a destination/distributor account. The issuer address and payment amount (1 million tokens) are hardcoded. The transaction is signed with the issuer's secret key.

### Prerequisites

- Node.js and npm installed
- TypeScript and ts-node installed (`npm install`)

### Usage

```bash
# Send payment to destination account
ts-node scripts/send-payment.ts <assetCode> <destinationAccount> <issuerSecretKey> <network>
```

### Examples

```bash
# Send 1 million SYTE tokens to a destination account on testnet
ts-node scripts/send-payment.ts SYTE GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEF S... testnet

# Send 1 million SYTE tokens to a destination account on mainnet
ts-node scripts/send-payment.ts SYTE GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEF S... mainnet
```

### Parameters

- `assetCode` - The asset code (e.g., "SYTE")
- `destinationAccount` - The destination/distributor account public key (must be a valid Stellar public key)
- `issuerSecretKey` - The issuer's secret key for signing the transaction
- `network` - Either "testnet" or "mainnet"

### Notes

- **Issuer Address**: Hardcoded to `GDF55TDEZ4ERQEEPIIZBHSU34I5MQRZVNALBTU7OVDQZPYZUHKZDOQTC`
- **Payment Amount**: Hardcoded to 1,000,000 tokens
- **Source Account**: Automatically derived from the issuer secret key (must match the hardcoded issuer address)
- **Trustline Required**: The destination account must have a trustline for the asset before receiving the payment

### Related Scripts

- `create-and-encrypt-account.ts` - Create new Stellar accounts
- `generate-encryption-key.ts` - Generate encryption keys for secret key storage
- `fund-testnet-accounts.ts` - Fund testnet accounts using Friendbot
- `change-trust.ts` - Add or update trustlines for assets
