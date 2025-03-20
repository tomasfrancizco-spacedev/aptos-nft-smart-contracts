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
require("dotenv").config();
// Configuration
const NODE_URL = process.env.NODE_URL || "https://fullnode.devnet.aptoslabs.com";
const FAUCET_URL = process.env.FAUCET_URL || "https://faucet.devnet.aptoslabs.com";
const CONTRACT_ADDRESS = "0x5b4b6e2e43bd03f96692402f36c0103349c87dde06cb921552dace4db9dbf8cc";
// Create API clients
const client = new aptos_1.AptosClient(NODE_URL);
const faucetClient = new aptos_1.FaucetClient(NODE_URL, FAUCET_URL);
async function loadAccount(privateKeyHex) {
    if (privateKeyHex) {
        return new aptos_1.AptosAccount(aptos_1.HexString.ensure(privateKeyHex).toUint8Array());
    }
    try {
        // Try to load from config
        const configContent = await fs.readFile('.aptos/config.yaml', 'utf8');
        const privateKeyLine = configContent.split('\n').find(line => line.includes('private_key:'));
        if (!privateKeyLine) {
            throw new Error('Private key not found in config');
        }
        const privateKeyFromConfig = privateKeyLine.split('private_key:')[1].trim().replace(/['"]/g, '');
        return new aptos_1.AptosAccount(aptos_1.HexString.ensure(privateKeyFromConfig).toUint8Array());
    }
    catch (e) {
        // Generate a new account if config doesn't exist
        return new aptos_1.AptosAccount();
    }
}
async function fundAccountIfNeeded(account, amount = 100000000) {
    console.log(`Funding account ${account.address().hex()} if needed...`);
    try {
        const resources = await client.getAccountResources(account.address());
        const accountResource = resources.find((r) => r.type === "0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>");
        if (!accountResource || accountResource.data.coin.value < amount / 10) {
            await faucetClient.fundAccount(account.address(), amount);
            console.log(`Account funded with ${amount} Octas`);
        }
        else {
            console.log("Account already has sufficient funds");
        }
    }
    catch (e) {
        // If account doesn't exist, fund it
        await faucetClient.fundAccount(account.address(), amount);
        console.log(`Account funded with ${amount} Octas`);
    }
}
async function createCollection(account, name, uri, description, maximum) {
    console.log(`Creating collection: ${name}...`);
    const payload = {
        type: "entry_function_payload",
        function: `${CONTRACT_ADDRESS}::ufc_nft::create_collection`,
        type_arguments: [],
        arguments: [name, uri, description, maximum.toString()],
    };
    const txnRequest = await client.generateTransaction(account.address(), payload);
    const signedTxn = await client.signTransaction(account, txnRequest);
    const txnResult = await client.submitTransaction(signedTxn);
    await client.waitForTransaction(txnResult.hash);
    console.log(`Collection created! Transaction hash: ${txnResult.hash}`);
    return txnResult.hash;
}
async function mintToken(account, tokenId, collection, name, uri, description, fighterName, weightClass, record, ranking) {
    console.log(`Minting token: ${name} with ID ${tokenId}...`);
    const payload = {
        type: "entry_function_payload",
        function: `${CONTRACT_ADDRESS}::ufc_nft::mint_token`,
        type_arguments: [],
        arguments: [
            tokenId.toString(),
            collection,
            name,
            uri,
            description,
            fighterName,
            weightClass,
            record,
            ranking.toString()
        ],
    };
    const txnRequest = await client.generateTransaction(account.address(), payload);
    const signedTxn = await client.signTransaction(account, txnRequest);
    const txnResult = await client.submitTransaction(signedTxn);
    await client.waitForTransaction(txnResult.hash);
    console.log(`Token minted! Transaction hash: ${txnResult.hash}`);
    return txnResult.hash;
}
async function mintTokenFor(account, recipient, tokenId, collection, name, uri, description, fighterName, weightClass, record, ranking) {
    console.log(`Minting token: ${name} with ID ${tokenId} for recipient ${recipient}...`);
    const payload = {
        type: "entry_function_payload",
        function: `${CONTRACT_ADDRESS}::ufc_nft::mint_token_for`,
        type_arguments: [],
        arguments: [
            recipient,
            tokenId.toString(),
            collection,
            name,
            uri,
            description,
            fighterName,
            weightClass,
            record,
            ranking.toString()
        ],
    };
    const txnRequest = await client.generateTransaction(account.address(), payload);
    const signedTxn = await client.signTransaction(account, txnRequest);
    const txnResult = await client.submitTransaction(signedTxn);
    await client.waitForTransaction(txnResult.hash);
    console.log(`Token minted for ${recipient}! Transaction hash: ${txnResult.hash}`);
    return txnResult.hash;
}
// Main function that demonstrates usage
async function main() {
    console.log("UFC NFT Management Script");
    console.log("=========================");
    // Load or create account
    const account = await loadAccount();
    console.log(`Using account: ${account.address().hex()}`);
    // Fund the account if needed
    await fundAccountIfNeeded(account);
    // Read command line arguments
    const args = process.argv.slice(2);
    if (args.length === 0) {
        printUsage();
        return;
    }
    const command = args[0];
    try {
        switch (command) {
            case "create-collection":
                if (args.length < 5) {
                    console.error("Missing parameters for create-collection");
                    printUsage();
                    return;
                }
                await createCollection(account, args[1], // name
                args[2], // uri
                args[3], // description
                parseInt(args[4]) // maximum
                );
                break;
            case "mint":
                if (args.length < 10) {
                    console.error("Missing parameters for mint");
                    printUsage();
                    return;
                }
                await mintToken(account, parseInt(args[1]), // tokenId
                args[2], // collection
                args[3], // name
                args[4], // uri
                args[5], // description
                args[6], // fighterName
                args[7], // weightClass
                args[8], // record
                parseInt(args[9]) // ranking
                );
                break;
            case "mint-for":
                if (args.length < 11) {
                    console.error("Missing parameters for mint-for");
                    printUsage();
                    return;
                }
                await mintTokenFor(account, args[1], // recipient
                parseInt(args[2]), // tokenId
                args[3], // collection
                args[4], // name
                args[5], // uri
                args[6], // description
                args[7], // fighterName
                args[8], // weightClass
                args[9], // record
                parseInt(args[10]) // ranking
                );
                break;
            default:
                console.error(`Unknown command: ${command}`);
                printUsage();
                return;
        }
        console.log("Operation completed successfully!");
    }
    catch (error) {
        console.error("Error:", error);
    }
}
function printUsage() {
    console.log(`
Usage:
    node ufc-nft.js create-collection <name> <uri> <description> <maximum>
    node ufc-nft.js mint <tokenId> <collection> <name> <uri> <description> <fighterName> <weightClass> <record> <ranking>
    node ufc-nft.js mint-for <recipient> <tokenId> <collection> <name> <uri> <description> <fighterName> <weightClass> <record> <ranking>

Examples:
    node ufc-nft.js create-collection "UFC Collection" "https://ufc.com/collection" "The official UFC NFT collection" 10000
    node ufc-nft.js mint 1 "UFC Collection" "Jon Jones" "https://ufc.com/nft/jon-jones" "UFC Heavyweight Champion Jon Jones" "Jon Jones" "Heavyweight" "27-1-0" 1
    node ufc-nft.js mint-for 0xb51f2b3cdaf5fbe19532e245052261cf9aa242acacc73e1dfa79cb8cda44e75c 2 "UFC Collection" "Conor McGregor" "https://ufc.com/nft/conor-mcgregor" "UFC Champion Conor McGregor" "Conor McGregor" "Lightweight" "22-6-0" 5
`);
}
// Run the main function
main().catch(console.error);
