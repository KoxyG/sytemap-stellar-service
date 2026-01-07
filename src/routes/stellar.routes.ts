import { Router } from 'express';

import StellarController from '../controllers/stellar.controller';

const router = Router();

router.post('/create_stellar_account', (req, res, next) => {
  // #swagger.tags = ['Stellar']
  // #swagger.operationId = 'create_stellar_account'
  // #swagger.description = 'Generate a mnemonic phrase, derive a keypair from it, create a new Stellar account, and return account details including the mnemonic'
  /* #swagger.requestBody = {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            required: ["UserId", "UserEmail", "Username", "DeveloperId", "BlockchainType", "BlockchainAction"],
            properties: {
              UserId: { type: "integer", minimum: 1, example: 1 },
              UserEmail: { type: "string", format: "email", example: "user@example.com" },
              Username: { type: "string", minLength: 1, example: "testuser" },
              DeveloperId: { type: "integer", minimum: 1, example: 1 },
              BlockchainType: { type: "string", enum: ["STELLAR"], example: "STELLAR" },
              BlockchainAction: { type: "string", enum: ["CREATE"], example: "CREATE" }
            }
          }
        }
      }
    } */
  StellarController.createAccount(req, res, next);
});

router.post('/send_syte_tokens', (req, res, next) => {
  // #swagger.tags = ['Stellar']
  // #swagger.operationId = 'send_syte_tokens'
  // #swagger.description = 'Send SYTE tokens to a specified wallet address'
  /* #swagger.requestBody = {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            required: ["UserId", "DeveloperId", "WalletAddress", "AmountPaid"],
            properties: {
              UserId: { type: "integer", minimum: 1, example: 1 },
              DeveloperId: { type: "integer", minimum: 1, example: 1 },
              WalletAddress: { type: "string", example: "GBMYWRUGENOVBAZUN2HAOHOREMPNKQBVSLIBEBTLIBSL4Y4JTWPALGHQ" },
              AmountPaid: { type: "number", minimum: 0, example: 100 }
            }
          }
        }
      }
    } */
  StellarController.sendSyteTokens(req, res, next);
});

router.get('/get_stellar_wallet', (req, res, next) => {
  // #swagger.tags = ['Stellar']
  // #swagger.operationId = 'get_stellar_wallet'
  // #swagger.description = 'Get wallet details and balances for a Stellar wallet address'
  // #swagger.parameters['walletAddress'] = {
  //   in: 'query',
  //   required: true,
  //   type: 'string',
  //   description: 'Stellar wallet address (public key)',
  //   example: 'GBMYWRUGENOVBAZUN2HAOHOREMPNKQBVSLIBEBTLIBSL4Y4JTWPALGHQ'
  // }
  StellarController.getStellarWallet(req, res, next);
});

router.get('/get_stellar_transaction_history', (req, res, next) => {
  // #swagger.tags = ['Stellar']
  // #swagger.operationId = 'get_stellar_transaction_history'
  // #swagger.description = 'Get all transaction history for a Stellar wallet address'
  // #swagger.parameters['walletAddress'] = {
  //   in: 'query',
  //   required: true,
  //   type: 'string',
  //   description: 'Stellar wallet address (public key)',
  //   example: 'GBMYWRUGENOVBAZUN2HAOHOREMPNKQBVSLIBEBTLIBSL4Y4JTWPALGHQ'
  // }
  StellarController.getStellarAllTransactionHistory(req, res, next);
});

router.post('/activate_syte_token_trustline', (req, res, next) => {
  // #swagger.tags = ['Stellar']
  // #swagger.operationId = 'activate_syte_token_trustline'
  // #swagger.description = 'Admin function to activate SYTE token trustline for a wallet address. IMPORTANT: Only use this function if you are certain that the account already exists on the Stellar network and only lacks the SYTE token trustline activation. This function will fail if the account does not exist on-chain.'
  /* #swagger.requestBody = {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            required: ["WalletAddress", "EncryptedSecretKey"],
            properties: {
              WalletAddress: { 
                type: "string", 
                example: "GBMYWRUGENOVBAZUN2HAOHOREMPNKQBVSLIBEBTLIBSL4Y4JTWPALGHQ",
                description: "Stellar wallet address (public key)"
              },
              EncryptedSecretKey: { 
                type: "string", 
                example: "encrypted-secret-key-here",
                description: "Encrypted secret key for the wallet"
              }
            }
          }
        }
      }
    } */
  StellarController.activateSyteTokenTrustline(req, res, next);
});

router.post('/send_syteplot_nft', (req, res, next) => {
  // #swagger.tags = ['Stellar']
  // #swagger.operationId = 'send_syteplot_nft'
  // #swagger.description = 'Send SYTEPLOT NFT to a specified wallet address. This function will automatically add the trustline (if needed) and send the NFT (0.0000001 tokens) in one operation. The wallet address and encrypted secret key are provided in the Metadata object (buyer_wallet_id and buyer_wallet_secret).'
  /* #swagger.requestBody = {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            required: ["UserId", "PlotId", "Metadata"],
            properties: {
              UserId: { type: "integer", minimum: 1, example: 1 },
              PlotId: { type: "integer", minimum: 1, example: 1 },
              Metadata: {
                type: "object",
                required: ["buyer_wallet_id", "buyer_wallet_secret"],
                properties: {
                  plot_no: { type: "integer", example: 123 },
                  estate_name: { type: "string", example: "Sunset Estate" },
                  size_of_plot: { type: "number", example: 500.5 },
                  plot_url: { type: "string", example: "https://example.com/plot/123" },
                  price_of_plot: { type: "number", example: 100000 },
                  date_of_allocation: { type: "string", format: "date", example: "2024-01-15" },
                  coordinate_of_plot: { type: "string", example: "40.7128,-74.0060" },
                  buyer_wallet_id: { type: "string", example: "GBMYWRUGENOVBAZUN2HAOHOREMPNKQBVSLIBEBTLIBSL4Y4JTWPALGHQ" },
                  buyer_wallet_secret: { type: "string", example: "encrypted-secret-key-here" },
                  estate_company_name: { type: "string", example: "ABC Real Estate" },
                  property_verification_no: { type: "integer", example: 12345 }
                }
              }
            }
          }
        }
      }
    } */
  StellarController.sendSytePlotNft(req, res, next);
});

export default router;
