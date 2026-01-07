# 🌟 SyteMap Stellar Service

A production-ready Node.js/TypeScript backend service for interacting with the Stellar blockchain. This service provides comprehensive APIs for managing Stellar accounts, sending SYTE tokens, distributing SYTEPLOT NFTs, and managing trustlines.

## 📋 Table of Contents

- [Features](#-features)
- [Prerequisites](#-prerequisites)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [API Endpoints](#-api-endpoints)
- [Scripts](#-scripts)
- [Development](#-development)
- [Security](#-security)
- [Documentation](#-documentation)
- [Contributing](#-contributing)
- [License](#-license)

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
- **npm** >= 9.x or **yarn** >= 1.x
- **MySQL** >= 8.0 (for database operations)
- **TypeScript** >= 5.5.x

## 🚀 Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd SyteMap-Stellar-Service
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   yarn install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Generate encryption key** (if not already set)
   ```bash
   npm run generate:key
   ```

5. **Build the project**
   ```bash
   npm run build
   ```

6. **Start the server**
   ```bash
   # Development mode
   npm run dev

   # Production mode
   npm start
   ```

## ⚙️ Configuration

### Environment Variables

Create a `.env` file in the root directory with the following variables:

```bash
# Server Configuration
NODE_ENV=development
PORT=3000
NUMBER_OF_WORKERS=4

# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_NAME=sytemap_db
DB_USER=your_db_user
DB_PASSWORD=your_db_password

# Stellar Network Configuration
STELLAR_NETWORK=testnet
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
STELLAR_BASE_FEE=100

# Sponsor Account (for fee sponsorship and account creation)
SPONSOR_PUBLIC_KEY=G...
SPONSOR_PRIVATE_KEY=S...

# SYTE Token Configuration
SYTE_ASSET_CODE=SYTE
SYTE_ISSUER_ADDRESS=GDF55TDEZ4ERQEEPIIZBHSU34I5MQRZVNALBTU7OVDQZPYZUHKZDOQTC
SYTE_DISTRIBUTOR_ADDRESS=G...
SYTE_DISTRIBUTOR_PRIVATE_KEY=S...

# SYTEPLOT NFT Configuration
SYTEPLOT_ASSET_CODE=SYTEPLOT
SYTEPLOT_ISSUER_ADDRESS=GDF55TDEZ4ERQEEPIIZBHSU34I5MQRZVNALBTU7OVDQZPYZUHKZDOQTC

# Encryption Configuration
ENCRYPTION_KEY=your-32-byte-encryption-key
```

### Important Notes

- **Never commit `.env` files** to version control
- **Secret keys** should be kept secure and never logged
- For **production**, use `STELLAR_NETWORK=mainnet` and mainnet Horizon URL
- The **encryption key** must be exactly 32 bytes (256 bits)

## 📡 API Endpoints

### Base URL
```
http://localhost:3000/api/v1
```

### Endpoints

#### 1. Create Stellar Account
```http
POST /create_stellar_account
```

Creates a new Stellar account with automatic trustline setup.

**Request Body:**
```json
{
  "UserId": 1,
  "UserEmail": "user@example.com",
  "Username": "testuser",
  "DeveloperId": 1,
  "BlockchainType": "STELLAR",
  "BlockchainAction": "CREATE"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "UserId": 1,
    "WalletAddress": "G...",
    "WalletSecret": "encrypted-secret-key",
    "WalletMnemonic": "word1 word2 ... word12",
    "ActivationStatus": true,
    "DeveloperId": 1,
    "BlockchainType": "STELLAR",
    "BlockchainAction": "CREATE"
  }
}
```

#### 2. Send SYTE Tokens
```http
POST /send_syte_tokens
```

Sends SYTE tokens to a wallet address.

**Request Body:**
```json
{
  "UserId": 1,
  "DeveloperId": 1,
  "WalletAddress": "GBMYWRUGENOVBAZUN2HAOHOREMPNKQBVSLIBEBTLIBSL4Y4JTWPALGHQ",
  "AmountPaid": 100
}
```

#### 3. Send SYTEPLOT NFT
```http
POST /send_syteplot_nft
```

Sends a SYTEPLOT NFT to a wallet. Automatically handles trustline creation.

**Request Body:**
```json
{
  "UserId": 1,
  "PlotId": 1,
  "Metadata": {
    "plot_no": 123,
    "estate_name": "Sunset Estate",
    "size_of_plot": 500.5,
    "plot_url": "https://example.com/plot/123",
    "price_of_plot": 100000,
    "date_of_allocation": "2024-01-15",
    "coordinate_of_plot": "40.7128,-74.0060",
    "buyer_wallet_id": "GBMYWRUGENOVBAZUN2HAOHOREMPNKQBVSLIBEBTLIBSL4Y4JTWPALGHQ",
    "buyer_wallet_secret": "encrypted-secret-key-here",
    "estate_company_name": "ABC Real Estate",
    "property_verification_no": 12345
  }
}
```

#### 4. Get Stellar Wallet
```http
GET /get_stellar_wallet?walletAddress=G...
```

Retrieves wallet details and balances.

#### 5. Get Transaction History
```http
GET /get_stellar_transaction_history?walletAddress=G...
```

Retrieves all transaction history for a wallet.

#### 6. Activate SYTE Token Trustline
```http
POST /activate_syte_token_trustline
```

Activates SYTE token trustline for an existing account.

**Request Body:**
```json
{
  "WalletAddress": "GBMYWRUGENOVBAZUN2HAOHOREMPNKQBVSLIBEBTLIBSL4Y4JTWPALGHQ",
  "EncryptedSecretKey": "encrypted-secret-key-here"
}
```

### Swagger Documentation

Interactive API documentation is available at:
```
http://localhost:3000/api-docs
```

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

See [SYTE TOKEN README](scripts/SYTE%20TOKEN/README.md) for complete documentation.

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

See [SYTEPLOT NFT README](scripts/SYTEPLOT%20NFT/README.md) for complete documentation.

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
│   ├── models/          # Database models
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

### Development Workflow

1. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**

3. **Run linter and formatter**
   ```bash
   npm run lint:fix
   npm run format
   ```

4. **Run tests**
   ```bash
   npm test
   ```

5. **Build and test**
   ```bash
   npm run build
   npm start
   ```

## 🔒 Security

### Best Practices

1. **Never log secret keys**
   - All secret keys are encrypted before storage
   - No secret keys are logged in console or files
   - Only public keys and encrypted values are logged

2. **Environment Variables**
   - Never commit `.env` files
   - Use strong encryption keys (32 bytes minimum)
   - Rotate keys regularly in production

3. **API Security**
   - Rate limiting is enabled
   - CORS is configured
   - Helmet.js provides security headers
   - Input validation on all endpoints

4. **Secret Key Management**
   - Secret keys are encrypted using AES-256
   - Only encrypted keys are stored in database
   - Decryption happens in-memory only

### Security Checklist

- ✅ No secret keys in logs
- ✅ Environment variables secured
- ✅ Encryption for sensitive data
- ✅ Rate limiting enabled
- ✅ Input validation
- ✅ Error handling without exposing internals

## 📚 Documentation

- [Stellar Service Documentation](src/stellar/README.md)
- [Encryption Service Documentation](src/encryption/README.md)
- [SYTE Token Scripts](scripts/SYTE%20TOKEN/README.md)
- [SYTEPLOT NFT Scripts](scripts/SYTEPLOT%20NFT/README.md)
- [Swagger API Docs](http://localhost:3000/api-docs) (when server is running)

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### Contribution Guidelines

- Follow the existing code style
- Write tests for new features
- Update documentation as needed
- Ensure all tests pass
- Follow security best practices

## 📝 License

This project is licensed under the MIT License - see the [License](License) file for details.

## 👥 Author

**Progress ochuko Eyaadah - Koxy**

## 🙏 Acknowledgments

- [Stellar Development Foundation](https://www.stellar.org/)
- [Stellar SDK](https://github.com/stellar/js-stellar-sdk)
- All contributors and maintainers

## 📞 Support

For issues, questions, or contributions, please open an issue on GitHub.

---

**⚠️ Important**: This service handles sensitive cryptographic operations. Always:
- Test thoroughly on testnet before mainnet deployment
- Keep secret keys secure and encrypted
- Never commit secrets to version control
- Use environment variables for all sensitive configuration
