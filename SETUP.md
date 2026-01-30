# 🚀 Server Setup Guide

This guide will walk you through setting up the SyteMap Stellar Service from scratch after cloning the repository.

## 📋 Table of Contents

- [Prerequisites](#-prerequisites)
- [Step 1: Install Dependencies](#step-1-install-dependencies)
- [Step 2: Configure Environment Variables](#step-2-configure-environment-variables)
- [Step 3: Generate Encryption Key](#step-3-generate-encryption-key)
- [Step 4: Build the Project](#step-4-build-the-project)
- [Step 5: Start the Server](#step-5-start-the-server)
- [Step 6: Verify Installation](#step-6-verify-installation)
- [Troubleshooting](#-troubleshooting)

---

## ✅ Prerequisites

Before you begin, ensure you have the following installed on your system:

### Required Software

1. **Node.js** (version 18.x or higher)

   ```bash
   node --version  # Should show v18.x.x or higher
   ```

2. **npm** (version 9.x or higher)
   ```bash
   npm --version  # Should show 9.x.x or higher
   ```

### Required Accounts & Keys

- **Stellar Testnet Account** (for development) or **Stellar Mainnet Account** (for production)
- **Sponsor Account** (Stellar account with XLM for funding new accounts)
- **SYTE Token Distributor Account** (if using SYTE token features)
- **SYTEPLOT NFT Issuer Account** (if using NFT features)

---

## Step 1: Install Dependencies

1. **Navigate to the project directory**

   ```bash
   cd SyteMap-Stellar-Service
   ```

2. **Install all dependencies**

   ```bash
   npm install
   ```

3. **Important Security Notes:**
   - ⚠️ **Never commit the `.env` file to version control**
   - ⚠️ **Keep all private keys secure**
   - ⚠️ **Use testnet keys for development**
   - ⚠️ **Use mainnet keys only in production**

---

## Step 3: Generate Encryption Key

The encryption key is used to encrypt Stellar secret keys before storing them. It must be exactly 32 bytes (256 bits).

1. **Generate the encryption key**

   ```bash
   npm run generate:key
   ```

   This will output a 32-byte encryption key. Example output:

   ```
   Generated Encryption Key: a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
   ```

2. **Copy the generated key** and add it to your `.env` file:

   ```bash
   ENCRYPTION_KEY=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
   ```

3. **Save the encryption key securely** - you'll need it to decrypt stored keys later.

   ⚠️ **Warning:** If you lose this key, you won't be able to decrypt stored secret keys!

---

## Step 4: Build the Project

1. **Build the TypeScript code to JavaScript**

   ```bash
   npm run build
   ```

   This command will:

   - Generate Swagger documentation
   - Compile TypeScript files to JavaScript in the `dist/` directory
   - Copy public assets and Swagger JSON files

---

## Step 5: Start the Server

### Development Mode (Recommended for first-time setup)

Development mode includes hot-reload and better error messages:

```bash
npm run dev
```

The server will:

- Start with nodemon (auto-restarts on file changes)
- Run TypeScript files directly (no build needed)
- Show detailed error messages

### Production Mode

For production, use the built JavaScript files:

```bash
npm start
```

---

## Step 6: Verify Installation

### 1. Check Server Health

Open your browser or use curl:

```bash
curl http://localhost:3000/api/v1
```

You should receive a response indicating the API is running.

### 2. Access Swagger Documentation

Open in your browser:

```
http://localhost:3000/api-docs
```

You should see the interactive Swagger API documentation.

### 3. Test API Endpoint (Optional)

Test creating a Stellar account:

```bash
curl -X POST http://localhost:3000/api/v1/create_stellar_account \
  -H "Content-Type: application/json" \
  -d '{
    "UserId": 1,
    "UserEmail": "test@example.com",
    "Username": "testuser",
    "DeveloperId": 1,
    "BlockchainType": "STELLAR",
    "BlockchainAction": "CREATE"
  }'
```

---

## 🔧 Troubleshooting

### Common Issues and Solutions

#### 1. **Port Already in Use**

**Error:** `EADDRINUSE: address already in use :::3000`

**Solution:**

```bash
# Find process using port 3000
lsof -ti:3000

# Kill the process
kill -9 $(lsof -ti:3000)

# Or change PORT in .env file
APP_PORT=3001
```

#### 2. **Missing Environment Variables**

**Error:** `❌ Missing required environment variables`

**Solution:**

- Check `.env` file exists in project root
- Verify all required variables are set (see Step 3)
- Required variables: `STELLAR_HORIZON_URL`, `SYTE_DISTRIBUTOR_ADDRESS`, `SPONSOR_PUBLIC_KEY`, `SPONSOR_PRIVATE_KEY`

#### 3. **Encryption Key Issues**

**Error:** Encryption/decryption fails

**Solutions:**

- Ensure `ENCRYPTION_KEY` is exactly 32 bytes (64 hex characters)
- Regenerate key: `npm run generate:key`
- Update `.env` with the new key
- If you have existing encrypted data, you'll need the original key

#### 4. **Module Not Found Errors**

**Error:** `Cannot find module '...'`

**Solutions:**

- Delete `node_modules` and `package-lock.json`
- Run `npm install` again
- Check `package.json` for correct dependencies

#### 5. **Swagger Documentation Not Found**

**Error:** `Swagger file not found`

**Solutions:**

- Run `npm run build` to generate Swagger docs
- Check `dist/swagger/documentation.swagger.json` exists
- Run `npm run swagger` manually if needed

#### 6. **Stellar Network Connection Issues**

**Error:** Cannot connect to Stellar Horizon

**Solutions:**

- Check internet connection
- Verify `STELLAR_HORIZON_URL` is correct
- For testnet: `https://horizon-testnet.stellar.org`
- For mainnet: `https://horizon.stellar.org`
- Check if Horizon service is operational

#### 7. **Insufficient XLM in Sponsor Account**

**Error:** Transaction fails due to insufficient funds

**Solutions:**

- Fund your sponsor account with XLM
- For testnet: Use [Stellar Laboratory](https://laboratory.stellar.org/#account-creator?network=test)
- For mainnet: Purchase XLM from an exchange
- Ensure account has enough XLM for fees and account creation
