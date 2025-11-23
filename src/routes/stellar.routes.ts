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
  /* #swagger.responses[201] = {
      description: "Account created successfully",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              data: {
                type: "object",
                properties: {
                  UserId: { type: "integer", example: 1 },
                  WalletAddress: { type: "string", example: "GDUQ..." },
                  WalletSecret: { type: "string", example: "encrypted-secret-key" },
                  WalletMnemonic: { type: "string", example: "word1 word2 word3..." },
                  ActivationStatus: { type: "boolean", example: true },
                  DeveloperId: { type: "integer", example: 1 },
                  BlockchainType: { type: "string", example: "STELLAR" },
                  BlockchainAction: { type: "string", example: "CREATE" }
                }
              }
            }
          }
        }
      }
    } */
  StellarController.createAccount(req, res, next);
});

export default router;
