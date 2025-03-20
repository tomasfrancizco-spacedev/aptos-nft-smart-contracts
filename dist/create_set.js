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
const NODE_URL = "https://fullnode.devnet.aptoslabs.com";
const FAUCET_URL = "https://faucet.devnet.aptoslabs.com";
const RESOURCE_ACCOUNT_ADDRESS = "0x464b630d38076515d4fa0229d123290d3eeef9fa9e0859fb36fe9401299650f3";
async function main() {
    const client = new aptos_1.AptosClient(NODE_URL);
    const faucetClient = new aptos_1.FaucetClient(NODE_URL, FAUCET_URL);
    // Create or load your account
    const account = new aptos_1.AptosAccount();
    // Fund the account using faucet
    await faucetClient.fundAccount(account.address(), 100000000);
    console.log("Account address:", account.address().hex());
    console.log("Resource account address:", RESOURCE_ACCOUNT_ADDRESS);
    // Load the series ID
    let seriesId;
    try {
        const fs = await Promise.resolve().then(() => __importStar(require('fs')));
        seriesId = fs.readFileSync("series_id.txt", "utf8").trim();
        console.log("Using series ID:", seriesId);
    }
    catch (error) {
        console.error("Failed to read series_id.txt. Please create a series first.");
        process.exit(1);
    }
    // Create a new set
    const payload = {
        type: "entry_function_payload",
        function: `${RESOURCE_ACCOUNT_ADDRESS}::ufc_nft::create_set`,
        type_arguments: [],
        arguments: [
            seriesId, // series_id
            "Main Event", // name
            "UFC 291 Main Event NFT Collection", // description
            100, // maximum_editions
            "QmHash..." // metadata_hash - replace with your IPFS hash
        ],
    };
    console.log("Creating set...");
    const txnRequest = await client.generateTransaction(account.address(), payload);
    const signedTxn = await client.signTransaction(account, txnRequest);
    const txnResult = await client.submitTransaction(signedTxn);
    console.log("Transaction submitted:", txnResult.hash);
    console.log("Waiting for transaction to be processed...");
    await client.waitForTransaction(txnResult.hash);
    // Get the set ID from events
    const txnInfo = await client.getTransactionByHash(txnResult.hash);
    const setCreatedEvent = txnInfo.events?.find((e) => e.type.includes("SetCreatedEvent"));
    if (setCreatedEvent) {
        console.log("Set created with ID:", setCreatedEvent.data.set_id);
        // Save the set ID to a file for use in other scripts
        const fs = await Promise.resolve().then(() => __importStar(require('fs')));
        fs.writeFileSync("set_id.txt", setCreatedEvent.data.set_id);
        console.log("Set ID saved to set_id.txt");
    }
    else {
        console.log("Set created but couldn't find the set ID in events");
    }
}
main().catch(console.error);
