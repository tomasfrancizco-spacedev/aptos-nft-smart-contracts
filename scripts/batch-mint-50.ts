import { AptosAccount, AptosClient, FaucetClient, HexString, Types } from "aptos";
import * as fs from "fs/promises";
require("dotenv").config();

// Configuration
const NODE_URL = process.env.NODE_URL || "https://fullnode.devnet.aptoslabs.com";
const FAUCET_URL = process.env.FAUCET_URL || "https://faucet.devnet.aptoslabs.com";
const CONTRACT_ADDRESS = "0x70c3a99237fe6e34da53a324b53685aeffb20c09b35681eb32c7718bd36179dc";

// Create API clients
const client = new AptosClient(NODE_URL);
const faucetClient = new FaucetClient(NODE_URL, FAUCET_URL);

interface BatchMintItem {
    collection: string;
    recipient: string;
    uri: string;
}

interface BatchMintData {
    batchMintData: BatchMintItem[];
}

async function loadAccount(): Promise<AptosAccount> {
    try {
        // Try to load from config
        const configContent = await fs.readFile('.aptos/config.yaml', 'utf8');
        const privateKeyLine = configContent.split('\n').find(line => line.includes('private_key:'));
        if (!privateKeyLine) {
            throw new Error('Private key not found in config');
        }
        const privateKeyFromConfig = privateKeyLine.split('private_key:')[1].trim().replace(/['"]/g, '');
        
        // Handle different private key formats from Aptos CLI
        let formattedPrivateKey = privateKeyFromConfig;
        if (formattedPrivateKey.startsWith('ed25519-priv-0x')) {
            // Remove the ed25519-priv- prefix and keep just the hex part
            formattedPrivateKey = formattedPrivateKey.replace('ed25519-priv-', '');
        } else if (!formattedPrivateKey.startsWith('0x')) {
            // Add 0x prefix if missing
            formattedPrivateKey = '0x' + formattedPrivateKey;
        }
        
        return new AptosAccount(HexString.ensure(formattedPrivateKey).toUint8Array());
    } catch (e) {
        // Generate a new account if config doesn't exist
        return new AptosAccount();
    }
}

async function fundAccountIfNeeded(account: AptosAccount, amount: number = 1000_000_000): Promise<void> {
    console.log(`Funding account ${account.address().hex()} if needed...`);
    try {
        const resources = await client.getAccountResources(account.address());
        const accountResource = resources.find((r) => r.type === "0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>");
        if (!accountResource || (accountResource.data as any).coin.value < amount / 10) {
            await faucetClient.fundAccount(account.address(), amount);
            console.log(`Account funded with ${amount} Octas`);
        } else {
            console.log("Account already has sufficient funds");
        }
    } catch (e) {
        // If account doesn't exist, fund it
        await faucetClient.fundAccount(account.address(), amount);
        console.log(`Account funded with ${amount} Octas`);
    }
}

async function loadBatchMintData(): Promise<BatchMintItem[]> {
    try {
        const data = await fs.readFile('data/batch-mint-data-50.json', 'utf8');
        const parsed: BatchMintData = JSON.parse(data);
        return parsed.batchMintData;
    } catch (error) {
        console.error("Error loading batch mint data:", error);
        throw new Error("Failed to load batch mint data. Make sure data/batch-mint-data.json exists");
    }
}

async function batchMintSimpleFor(
    account: AptosAccount,
    collections: string[],
    recipients: string[],
    uris: string[]
): Promise<string> {
    console.log(`Batch minting ${collections.length} tokens...`);
    
    const payload: Types.TransactionPayload = {
        type: "entry_function_payload",
        function: `${CONTRACT_ADDRESS}::ufc_nft::batch_mint_simple_for`,
        type_arguments: [],
        arguments: [collections, recipients, uris],
    };
    
    const txnRequest = await client.generateTransaction(account.address(), payload);
    const signedTxn = await client.signTransaction(account, txnRequest);
    const txnResult = await client.submitTransaction(signedTxn);
    
    await client.waitForTransaction(txnResult.hash);
    console.log(`✅ Batch mint completed! Hash: ${txnResult.hash}`);
    
    return txnResult.hash;
}

async function batchMint100() {
    const scriptStartTime = new Date();
    console.log("🚀 Batch Minting 100 UFC NFTs...");
    console.log("==================================");
    console.log(`⏰ Script started at: ${scriptStartTime.toLocaleString()}`);
    console.log("");
    
    try {
        // Load or create account
        const account = await loadAccount();
        console.log(`Using account: ${account.address().hex()}`);
        
        // Fund the account with sufficient APT for batch minting
        await fundAccountIfNeeded(account, 2000_000_000); // 20 APT to be safe
        
        // Load batch mint data
        console.log("📁 Loading batch mint data...");
        const batchData = await loadBatchMintData();
        
        if (batchData.length !== 50) {
            throw new Error(`Expected 50 items, got ${batchData.length}`);
        }
        
        // Prepare vectors for the batch mint
        const collections = batchData.map(item => item.collection);
        const recipients = batchData.map(item => item.recipient);
        const uris = batchData.map(item => item.uri);
        
        console.log("📊 Batch mint summary:");
        console.log(`   Collections: ${collections.length} items`);
        console.log(`   Recipients: ${recipients.length} items`);
        console.log(`   URIs: ${uris.length} items`);
        console.log(`   Unique collections: ${new Set(collections).size}`);
        console.log(`   Unique recipients: ${new Set(recipients).size}`);
        
        const startTime = Date.now();
        
        // Execute batch mint
        console.log("\n🎯 Starting batch mint transaction...");
        const hash = await batchMintSimpleFor(account, collections, recipients, uris);
        
        const endTime = Date.now();
        const duration = (endTime - startTime) / 1000;
        const scriptEndTime = new Date();
        const totalScriptDuration = (scriptEndTime.getTime() - scriptStartTime.getTime()) / 1000;
        
        // Success summary
        console.log("\n🎉 Batch Mint Complete!");
        console.log("========================");
        console.log(`✅ Successfully minted: 50 NFTs`);
        console.log(`📋 Transaction hash: ${hash}`);
        console.log(`⏱️  Batch mint transaction time: ${duration.toFixed(2)} seconds`);
        console.log(`⚡ Average: ${(duration / 50).toFixed(3)} seconds per NFT`);
        console.log("");
        console.log(`🕐 Script started at: ${scriptStartTime.toLocaleString()}`);
        console.log(`🕐 Script ended at: ${scriptEndTime.toLocaleString()}`);
        console.log(`⏱️  Total script duration: ${totalScriptDuration.toFixed(2)} seconds`);
        
        // Save transaction result
        const result = {
            success: true,
            transactionHash: hash,
            mintedTokens: 50,
            duration: duration,
            totalScriptDuration: totalScriptDuration,
            startTime: scriptStartTime.toISOString(),
            endTime: scriptEndTime.toISOString(),
            timestamp: new Date().toISOString(),
            collections: collections,
            recipients: recipients,
            uris: uris
        };
        
        await fs.writeFile(
            'batch-mint-results.json', 
            JSON.stringify(result, null, 2)
        );
        console.log("\n📄 Results saved to: batch-mint-results.json");
        
        // Display some sample minted tokens
        console.log("\n🎨 Sample minted tokens:");
        for (let i = 0; i < Math.min(5, batchData.length); i++) {
            console.log(`   Token ${i + 1}: ${collections[i]} → ${recipients[i].substring(0, 10)}...`);
        }
        if (batchData.length > 5) {
            console.log(`   ... and ${batchData.length - 5} more tokens`);
        }
        
    } catch (error) {
        const scriptEndTime = new Date();
        const totalScriptDuration = (scriptEndTime.getTime() - scriptStartTime.getTime()) / 1000;
        
        console.error("❌ Batch mint failed:", error);
        console.log("");
        console.log(`🕐 Script started at: ${scriptStartTime.toLocaleString()}`);
        console.log(`🕐 Script ended at: ${scriptEndTime.toLocaleString()}`);
        console.log(`⏱️  Total script duration: ${totalScriptDuration.toFixed(2)} seconds`);
        
        // Save error result
        const errorResult = {
            success: false,
            error: error instanceof Error ? error.message : String(error),
            totalScriptDuration: totalScriptDuration,
            startTime: scriptStartTime.toISOString(),
            endTime: scriptEndTime.toISOString(),
            timestamp: new Date().toISOString()
        };
        
        await fs.writeFile(
            'batch-mint-error.json', 
            JSON.stringify(errorResult, null, 2)
        );
        console.log("📄 Error details saved to: batch-mint-error.json");
        
        process.exit(1);
    }
}

// Run the script
batchMint100().catch(console.error); 