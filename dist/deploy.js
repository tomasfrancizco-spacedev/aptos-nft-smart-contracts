"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const aptos_1 = require("aptos");
const fs = __importStar(require("fs/promises"));
const NODE_URL = "https://fullnode.devnet.aptoslabs.com";
const FAUCET_URL = "https://faucet.devnet.aptoslabs.com";
(async () => {
    try {
        // Create API and faucet clients
        const client = new aptos_1.AptosClient(NODE_URL);
        const faucetClient = new aptos_1.FaucetClient(NODE_URL, FAUCET_URL);
        // Read private key from config
        const configContent = await fs.readFile('.aptos/config.yaml', 'utf8');
        const privateKeyLine = configContent.split('\n').find(line => line.includes('private_key:'));
        if (!privateKeyLine) {
            throw new Error('Private key not found in config');
        }
        const privateKeyHex = privateKeyLine.split('private_key:')[1].trim().replace(/['"]/g, '');
        // Create account from private key
        const account = new aptos_1.AptosAccount(aptos_1.HexString.ensure(privateKeyHex).toUint8Array());
        console.log("Loaded existing account from config");
        console.log("Account address:", account.address().hex());
        // Fund account
        await faucetClient.fundAccount(account.address(), 100000000);
        console.log("Account funded");
        // Publish module
        const metadataBytes = await fs.readFile('build/UFC_NFT/package-metadata.bcs');
        const codeBytes = await fs.readFile('build/UFC_NFT/bytecode_modules/ufc_nft.mv');
        const moduleHex = aptos_1.HexString.fromUint8Array(codeBytes).toString();
        const metadataHex = aptos_1.HexString.fromUint8Array(metadataBytes).toString();
        // Create a transaction payload for publishing the module
        const payload = {
            type: "module_bundle_payload",
            modules: [
                { bytecode: `0x${moduleHex}` }
            ]
        };
        // Submit the transaction
        const txnRequest = await client.generateTransaction(account.address(), payload);
        const signedTxn = await client.signTransaction(account, txnRequest);
        const txnResult = await client.submitTransaction(signedTxn);
        console.log("Transaction submitted:", txnResult.hash);
        console.log("Waiting for transaction to be processed...");
        const txnInfo = await client.waitForTransactionWithResult(txnResult.hash);
        if (!txnInfo) {
            throw new Error("Transaction info not found");
        }
        console.log("Transaction info:", JSON.stringify(txnInfo, null, 2));
        if (!txnInfo.success) {
            throw new Error(`Transaction failed: ${txnInfo.vm_status}`);
        }
        console.log("Module published successfully!");
    }
    catch (error) {
        console.error("Error:", error);
        process.exit(1);
    }
})();
