# 🌟 SyteMap Stellar Service

A production-ready Node.js/TypeScript backend service for interacting with the Stellar blockchain. This service provides comprehensive APIs for managing Stellar accounts, sending SYTE tokens, distributing SYTEPLOT NFTs, and managing trustlines.

## ✨ Features

### Core Functionality

- ✅ **Account Management**: Create Stellar accounts with automatic trustline setup
- ✅ **SYTE Token Distribution**: Send SYTE tokens to wallet addresses
- ✅ **SYTEPLOT NFT Distribution**: Automated NFT transfer with trustline management
- ✅ **Wallet Operations**: Query balances and transaction history
- ✅ **Trustline Management**: Activate trustlines for custom assets
- ✅ **Fee Sponsorship**: Automatic fee-bumping for seamless transactions

### Technical Features

- 🔒 **Encryption**: AES-256 encryption for secret keys
- 📝 **TypeScript**: Full type safety and IntelliSense support
- 📚 **Swagger Documentation**: Auto-generated API documentation
- 🧪 **Testing**: Jest test suite with coverage
- 🔍 **Logging**: Winston-based structured logging
- 🛡️ **Security**: Helmet, CORS, rate limiting
- ⚡ **Performance**: Cluster mode for multi-core support

## 📦 Prerequisites

- **Node.js** >= 18.x
- **npm** >= 9.x
- **TypeScript** >= 5.5.x

## 🚀 Installation

> 📖 **For detailed setup instructions, see [SETUP.md](./SETUP.md)**

Quick start:

```bash
git clone <repository-url>
cd SyteMap-Stellar-Service
npm install
npm run generate:key // only run if you want to switch to mainnet
npm run build
npm run dev
```

## ⚙️ Configuration

### Network Configuration

**For Testnet (Development):**

- Set `NODE_ENV=development`
- Set `STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org`

**For Mainnet (Production):**

- Set `NODE_ENV=production`
- Set `STELLAR_HORIZON_URL=https://horizon.stellar.org`

### Environment Variables

Create a `.env` file in the root directory with the following variables:

## 🛠️ Scripts

### Utility Scripts

#### Generate Encryption Key

```bash
npm run generate:key
```

#### Create and Encrypt Account

```bash
npm run create:account
```

### SYTE Token Scripts

The [SYTE TOKEN README](scripts/SYTE%20TOKEN/README.md) provides comprehensive documentation for managing SYTE token operations. It covers the complete workflow for distributing SYTE tokens, including account funding, trustline management, and token transfers. The guide includes step-by-step instructions for both testnet and mainnet operations, with detailed examples and configuration options.

**Quick Start:**

```bash
# 1. Fund account
ts-node scripts/fund-testnet-accounts.ts <accountPublicKey>

# 2. Add trustline
ts-node scripts/SYTE\ TOKEN/change-trust.ts SYTE <secretKey> testnet

# 3. Send 100 billion SYTE tokens
ts-node scripts/SYTE\ TOKEN/send-payment.ts SYTE <destinationAccount> <issuerSecretKey> testnet
```

### SYTEPLOT NFT Scripts

The [SYTEPLOT NFT README](scripts/SYTEPLOT%20NFT/README.md) contains detailed documentation for managing SYTEPLOT NFT operations on the Stellar network. It includes issuer setup procedures (home domain and authorization flags), NFT distribution workflows, and trustline management. The guide provides complete instructions for both one-time issuer configuration and recurring NFT distribution operations.

**Quick Start:**

```bash
# 1. Set home domain
ts-node scripts/SYTEPLOT\ NFT/set-home-domain.ts <issuerSecretKey> testnet

# 2. Set authorization flags
ts-node scripts/SYTEPLOT\ NFT/set-authorization-flags.ts <issuerSecretKey> testnet

# 3. Add trustline
ts-node scripts/SYTEPLOT\ NFT/change-trust.ts SYTEPLOT <secretKey> testnet

# 4. Send 1 million NFTs to distributor
ts-node scripts/SYTEPLOT\ NFT/send-payment.ts SYTEPLOT <distributorAddress> <issuerSecretKey> testnet
```

## 💻 Development

### Project Structure

```
SyteMap-Stellar-Service/
├── src/
│   ├── config/          # Configuration files
│   ├── controllers/     # Request handlers
│   ├── routes/          # API routes
│   ├── stellar/         # Stellar service implementation
│   ├── encryption/      # Encryption service
│   ├── models/          # Data models
│   ├── middleware/      # Express middleware
│   ├── utils/           # Utility functions
│   └── swagger/         # Swagger documentation
├── scripts/             # Utility scripts
│   ├── SYTE TOKEN/      # SYTE token scripts
│   └── SYTEPLOT NFT/    # SYTEPLOT NFT scripts
├── tests/               # Test files
└── dist/                # Compiled JavaScript
```

### Available Scripts

```bash
# Development
npm run dev              # Start development server with hot reload
npm run build            # Build TypeScript to JavaScript
npm start                # Start production server

# Code Quality
npm run lint             # Run ESLint
npm run lint:fix         # Fix ESLint errors
npm run format           # Format code with Prettier

# Testing
npm test                 # Run tests
npm run test:watch       # Run tests in watch mode
npm run test:coverage    # Generate test coverage

# Documentation
npm run swagger          # Generate Swagger documentation
```

### Security Checklist

- ✅ No secret keys in logs
- ✅ Environment variables secured
- ✅ Encryption for sensitive data
- ✅ Rate limiting enabled
- ✅ Input validation
- ✅ Error handling without exposing internals
