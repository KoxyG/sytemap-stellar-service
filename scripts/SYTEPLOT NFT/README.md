# SYTEPLOT NFT Scripts Documentation

This directory contains utility scripts for managing SYTEPLOT NFT operations on the Stellar network.

## SYTEPLOT NFT Workflow

This section documents the complete workflow for distributing SYTEPLOT NFTs to accounts. The process consists of multiple steps:

### Issuer Setup (One-time, per network)
1. **Set Home Domain** - Set the home domain for the issuer account (optional but recommended)
2. **Set Authorization Flags** - Enable revocable and clawback features for the asset

### NFT Distribution Workflow
1. **Fund Accounts** - Fund accounts with XLM (required for transaction fees)
2. **Change Trust** - Add trustline for SYTEPLOT asset (required to receive SYTEPLOT NFTs)
3. **Send Payment** - Send 1 SYTEPLOT NFT (0.0000001 tokens) to the destination account

### SYTEPLOT NFT Configuration

- **Asset Code**: `SYTEPLOT`
- **Issuer Address**: `GDF55TDEZ4ERQEEPIIZBHSU34I5MQRZVNALBTU7OVDQZPYZUHKZDOQTC`
- **Payment Amount**: 0.0000001 tokens (1 NFT, hardcoded)
- **Home Domain**: `sytemap.com` (hardcoded)

### Complete Workflow for Testnet

#### Step 1: Issuer Setup (One-time)

```bash
# Set home domain for issuer account
ts-node scripts/SYTEPLOT\ NFT/set-home-domain.ts <issuerSecretKey> testnet

# Set authorization flags (revocable and clawback enabled)
ts-node scripts/SYTEPLOT\ NFT/set-authorization-flags.ts <issuerSecretKey> testnet
```

#### Step 2: Fund Account with XLM

```bash
# Fund a single account
ts-node scripts/fund-testnet-accounts.ts <accountPublicKey>

# Example:
ts-node scripts/fund-testnet-accounts.ts GABKZ6FQIU3L5WGMQNUL4QPDPWX5VMW5XBGHMESBP3N6NJ5ZAHK42JT2
```

#### Step 3: Add Trustline for SYTEPLOT Asset

```bash
# Add trustline for SYTEPLOT asset
ts-node scripts/SYTEPLOT\ NFT/change-trust.ts SYTEPLOT <accountSecretKey> testnet

# Example:
ts-node scripts/SYTEPLOT\ NFT/change-trust.ts SYTEPLOT SCV22GCANOEBBMARWVBH7GQCJR5GVWAKSUA2DTNXI2BONAMPFTS46WAU testnet
```

#### Step 4: Send Payment (1 SYTEPLOT NFT)

```bash
# Send 1 SYTEPLOT NFT to destination account
ts-node scripts/SYTEPLOT\ NFT/send-payment.ts SYTEPLOT <destinationAccount> <issuerSecretKey> testnet

# Example:
ts-node scripts/SYTEPLOT\ NFT/send-payment.ts SYTEPLOT GABKZ6FQIU3L5WGMQNUL4QPDPWX5VMW5XBGHMESBP3N6NJ5ZAHK42JT2 SCV22GCANOEBBMARWVBH7GQCJR5GVWAKSUA2DTNXI2BONAMPFTS46WAU testnet
```

### Complete Workflow for Mainnet

#### Step 1: Issuer Setup (One-time)

```bash
# Set home domain for issuer account
ts-node scripts/SYTEPLOT\ NFT/set-home-domain.ts <issuerSecretKey> mainnet

# Set authorization flags (revocable and clawback enabled)
ts-node scripts/SYTEPLOT\ NFT/set-authorization-flags.ts <issuerSecretKey> mainnet
```

#### Step 2: Fund Account with XLM

**Note**: The `fund-testnet-accounts.ts` script only works on testnet. For mainnet, you'll need to fund accounts manually or use a different method.

#### Step 3: Add Trustline for SYTEPLOT Asset
```bash
# Add trustline for SYTEPLOT asset
ts-node scripts/SYTEPLOT\ NFT/change-trust.ts SYTEPLOT <accountSecretKey> testnet

```bash
# Add trustline for SYTEPLOT asset
ts-node scripts/SYTEPLOT\ NFT/change-trust.ts SYTEPLOT <accountSecretKey> mainnet

# Example:
ts-node scripts/SYTEPLOT\ NFT/change-trust.ts SYTEPLOT SCV22GCANOEBBMARWVBH7GQCJR5GVWAKSUA2DTNXI2BONAMPFTS46WAU mainnet
```

#### Step 4: Send Payment (1 SYTEPLOT NFT)

```bash
# Send 1 SYTEPLOT NFT to destination account
ts-node scripts/SYTEPLOT\ NFT/send-payment.ts SYTEPLOT <destinationAccount> <issuerSecretKey> mainnet

# Example:
ts-node scripts/SYTEPLOT\ NFT/send-payment.ts SYTEPLOT GABKZ6FQIU3L5WGMQNUL4QPDPWX5VMW5XBGHMESBP3N6NJ5ZAHK42JT2 SCV22GCANOEBBMARWVBH7GQCJR5GVWAKSUA2DTNXI2BONAMPFTS46WAU mainnet
```

### Quick Reference: Complete SYTEPLOT NFT Distribution

**Testnet:**
```bash
# 1. Issuer setup (one-time)
ts-node scripts/SYTEPLOT\ NFT/set-home-domain.ts <issuerSecretKey> testnet
ts-node scripts/SYTEPLOT\ NFT/set-authorization-flags.ts <issuerSecretKey> testnet

# 2. Fund account
ts-node scripts/fund-testnet-accounts.ts <accountPublicKey>

# 3. Add trustline
ts-node scripts/SYTEPLOT\ NFT/change-trust.ts SYTEPLOT <accountSecretKey> testnet

# 4. Send payment
ts-node scripts/SYTEPLOT\ NFT/send-payment.ts SYTEPLOT <accountPublicKey> <issuerSecretKey> testnet
```

**Mainnet:**
```bash
# 1. Issuer setup (one-time)
ts-node scripts/SYTEPLOT\ NFT/set-home-domain.ts <issuerSecretKey> mainnet
ts-node scripts/SYTEPLOT\ NFT/set-authorization-flags.ts <issuerSecretKey> mainnet

# 2. Fund account (manual or other method - fund-testnet-accounts.ts only works on testnet)

# 3. Add trustline
ts-node scripts/SYTEPLOT\ NFT/change-trust.ts SYTEPLOT <accountSecretKey> mainnet

# 4. Send payment
ts-node scripts/SYTEPLOT\ NFT/send-payment.ts SYTEPLOT <accountPublicKey> <issuerSecretKey> mainnet
```

### Important Notes

- **Order Matters**: Steps must be completed in order (fund → trustline → payment)
- **Issuer Setup**: Home domain and authorization flags should be set once per network before distributing NFTs
- **Account Requirements**: 
  - Account must be funded with XLM before adding trustline (for transaction fees)
  - Account must have trustline before receiving SYTEPLOT NFTs
- **Issuer Secret Key**: Required for issuer setup and payment steps. The secret key must correspond to the hardcoded issuer address.
- **Testnet vs Mainnet**: Use `testnet` or `mainnet` parameter consistently across all commands for the same network.
- **NFT Amount**: Each payment sends exactly 0.0000001 tokens (1 NFT), which is hardcoded in the script.

## Set Home Domain

The `set-home-domain.ts` script sets the home domain for the issuer account. The domain is hardcoded to "sytemap.com". The transaction is signed with the issuer's secret key.

### Prerequisites

- Node.js and npm installed
- TypeScript and ts-node installed (`npm install`)

### Usage

```bash
# Set home domain on testnet
ts-node scripts/SYTEPLOT\ NFT/set-home-domain.ts <issuerSecretKey> testnet

# Set home domain on mainnet
ts-node scripts/SYTEPLOT\ NFT/set-home-domain.ts <issuerSecretKey> mainnet
```

### Examples

```bash
# Testnet
ts-node scripts/SYTEPLOT\ NFT/set-home-domain.ts S... testnet

# Mainnet
ts-node scripts/SYTEPLOT\ NFT/set-home-domain.ts S... mainnet
```

### Parameters

- `issuerSecretKey` - The issuer's secret key for signing the transaction (must match the hardcoded issuer address)
- `network` - Either "testnet" or "mainnet"

### Notes

- **Issuer Address**: Hardcoded to `GDF55TDEZ4ERQEEPIIZBHSU34I5MQRZVNALBTU7OVDQZPYZUHKZDOQTC`
- **Home Domain**: Hardcoded to `sytemap.com`
- **Account Derivation**: The issuer address is automatically derived from the provided secret key
- **Network Selection**: The script uses the appropriate Horizon URL based on the network parameter
- **Idempotent**: If the home domain is already set to "sytemap.com", the script will report success without creating a new transaction

## Set Authorization Flags

The `set-authorization-flags.ts` script sets authorization flags on the issuing account. The flags enable revocable and clawback features. The transaction is signed with the issuer's secret key.

### Prerequisites

- Node.js and npm installed
- TypeScript and ts-node installed (`npm install`)

### Usage

```bash
# Set authorization flags on testnet
ts-node scripts/SYTEPLOT\ NFT/set-authorization-flags.ts <issuerSecretKey> testnet

# Set authorization flags on mainnet
ts-node scripts/SYTEPLOT\ NFT/set-authorization-flags.ts <issuerSecretKey> mainnet
```

### Examples

```bash
# Testnet
ts-node scripts/SYTEPLOT\ NFT/set-authorization-flags.ts S... testnet

# Mainnet
ts-node scripts/SYTEPLOT\ NFT/set-authorization-flags.ts S... mainnet
```

### Parameters

- `issuerSecretKey` - The issuer's secret key for signing the transaction (must match the hardcoded issuer address)
- `network` - Either "testnet" or "mainnet"

### Notes

- **Issuer Address**: Hardcoded to `GDF55TDEZ4ERQEEPIIZBHSU34I5MQRZVNALBTU7OVDQZPYZUHKZDOQTC`
- **Flags Set**:
  - Auth Revocable: `true` - Allows the issuer to revoke trustlines
  - Auth Clawback Enabled: `true` - Allows the issuer to clawback (reclaim) assets
- **Account Derivation**: The issuer address is automatically derived from the provided secret key
- **Network Selection**: The script uses the appropriate Horizon URL based on the network parameter
- **Idempotent**: If the flags are already set correctly, the script will report success without creating a new transaction
- **Timing**: These flags should be set **before** issuing any assets

## Change Trust

The `change-trust.ts` script adds or updates a trustline for the SYTEPLOT asset. The issuer address is hardcoded. The account public key is automatically derived from the provided secret key.

### Prerequisites

- Node.js and npm installed
- TypeScript and ts-node installed (`npm install`)

### Usage

```bash
# Add/update trustline for SYTEPLOT asset
ts-node scripts/SYTEPLOT\ NFT/change-trust.ts SYTEPLOT <secretKey> <network>

# Add/update trustline with custom limit
ts-node scripts/SYTEPLOT\ NFT/change-trust.ts SYTEPLOT <secretKey> <network> --limit <limit>
```

### Examples

```bash
# Add trustline for SYTEPLOT asset on testnet (default max limit)
ts-node scripts/SYTEPLOT\ NFT/change-trust.ts SYTEPLOT S... testnet

# Add trustline for SYTEPLOT asset on mainnet with custom limit
ts-node scripts/SYTEPLOT\ NFT/change-trust.ts SYTEPLOT S... mainnet --limit 1000000
```

### Parameters

- `assetCode` - The asset code (must be "SYTEPLOT")
- `secretKey` - The secret key of the account adding the trustline (account public key will be derived from this)
- `network` - Either "testnet" or "mainnet"
- `--limit` (optional) - Trust limit (default: max limit `922337203685.4775807`)

### Notes

- **Issuer Address**: Hardcoded to `GDF55TDEZ4ERQEEPIIZBHSU34I5MQRZVNALBTU7OVDQZPYZUHKZDOQTC`
- **Account Derivation**: The account public key is automatically derived from the provided secret key
- **Network Selection**: The script uses the appropriate Horizon URL based on the network parameter
- **Trustline Updates**: If a trustline already exists, it will be updated with the new limit

## Send Payment

The `send-payment.ts` script sends a payment of 1 SYTEPLOT NFT (0.0000001 tokens) to a destination/distributor account. The issuer address and payment amount are hardcoded. The transaction is signed with the issuer's secret key.

### Prerequisites

- Node.js and npm installed
- TypeScript and ts-node installed (`npm install`)

### Usage

```bash
# Send payment to destination account
ts-node scripts/SYTEPLOT\ NFT/send-payment.ts SYTEPLOT <destinationAccount> <issuerSecretKey> <network>
```

### Examples

```bash
# Send 1 SYTEPLOT NFT to a destination account on testnet
ts-node scripts/SYTEPLOT\ NFT/send-payment.ts SYTEPLOT GABKZ6FQIU3L5WGMQNUL4QPDPWX5VMW5XBGHMESBP3N6NJ5ZAHK42JT2 SCV22GCANOEBBMARWVBH7GQCJR5GVWAKSUA2DTNXI2BONAMPFTS46WAU testnet

# Send 1 SYTEPLOT NFT to a destination account on mainnet
ts-node scripts/SYTEPLOT\ NFT/send-payment.ts SYTEPLOT GABKZ6FQIU3L5WGMQNUL4QPDPWX5VMW5XBGHMESBP3N6NJ5ZAHK42JT2 SCV22GCANOEBBMARWVBH7GQCJR5GVWAKSUA2DTNXI2BONAMPFTS46WAU mainnet
```

### Parameters

- `assetCode` - The asset code (must be "SYTEPLOT")
- `destinationAccount` - The destination/distributor account public key (must be a valid Stellar public key)
- `issuerSecretKey` - The issuer's secret key for signing the transaction
- `network` - Either "testnet" or "mainnet"

### Notes

- **Issuer Address**: Hardcoded to `GDF55TDEZ4ERQEEPIIZBHSU34I5MQRZVNALBTU7OVDQZPYZUHKZDOQTC`
- **Payment Amount**: Hardcoded to 0.0000001 tokens (1 NFT)
- **Source Account**: Automatically derived from the issuer secret key (must match the hardcoded issuer address)
- **Trustline Required**: The destination account must have a trustline for the SYTEPLOT asset before receiving the payment

### Common Errors

- **`op_no_trust`**: Destination account does not have a trustline for this asset. Run `change-trust.ts` first.
- **`op_underfunded`**: Source account has insufficient funds to pay transaction fees
- **`op_line_full`**: Destination account trustline limit reached

### Related Scripts

- `../fund-testnet-accounts.ts` - Fund testnet accounts using Friendbot
- `change-trust.ts` - Add or update trustlines for SYTEPLOT asset
- `set-home-domain.ts` - Set home domain for the issuer account
- `set-authorization-flags.ts` - Set authorization flags on the issuer account
- `../SYTE TOKEN/` - Scripts for SYTE token operations
- `../create-and-encrypt-account.ts` - Create new Stellar accounts
- `../generate-encryption-key.ts` - Generate encryption keys for secret key storage
