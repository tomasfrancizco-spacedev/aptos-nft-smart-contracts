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

async function createCollection(
    account: AptosAccount,
    name: string,
    uri: string,
    description: string,
    maximum: number,
    mutable_uri: boolean = true,
    retries: number = 3
): Promise<string> {
    console.log(`Creating collection: ${name}...`);
    
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const payload: Types.TransactionPayload = {
                type: "entry_function_payload",
                function: `${CONTRACT_ADDRESS}::ufc_nft::create_collection`,
                type_arguments: [],
                arguments: [name, uri, description, maximum.toString(), mutable_uri],
            };
            
            const txnRequest = await client.generateTransaction(account.address(), payload);
            const signedTxn = await client.signTransaction(account, txnRequest);
            const txnResult = await client.submitTransaction(signedTxn);
            
            await client.waitForTransaction(txnResult.hash);
            console.log(`✅ Collection "${name}" created! Hash: ${txnResult.hash}`);
            
            return txnResult.hash;
        } catch (error: any) {
            // Check if it's a rate limit error
            if (error.status === 429 || (error.message && error.message.includes("rate limit"))) {
                const delay = Math.pow(2, attempt) * 5000; // Exponential backoff: 10s, 20s, 40s
                console.log(`⚠️  Rate limit hit for "${name}". Waiting ${delay/1000}s before retry ${attempt}/${retries}...`);
                
                if (attempt < retries) {
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                } else {
                    throw new Error(`Rate limit exceeded after ${retries} attempts: ${error.message}`);
                }
            } else {
                // For non-rate-limit errors, throw immediately
                throw error;
            }
        }
    }
    
    throw new Error("Should not reach here");
}

async function create50Collections() {
    const scriptStartTime = new Date();
    console.log("🚀 Creating 50 UFC Collections...");
    console.log("===================================");
    console.log(`⏰ Script started at: ${scriptStartTime.toLocaleString()}`);
    console.log("⚠️  Note: Using longer delays to avoid rate limits");
    console.log("");
    
    // Load or create account
    const account = await loadAccount();
    console.log(`Using account: ${account.address().hex()}`);
    
    // Fund the account with sufficient APT for 50 transactions
    await fundAccountIfNeeded(account, 500_000_000); // 5 APT should be enough for 50 collections
    
    const results: { name: string; hash: string; error?: string }[] = [];
    const startTime = Date.now();
    
    // Create 50 collections with better rate limiting
    for (let i = 1; i <= 50; i++) {
        try {
            const collectionName = `UFC Fighters #${i}`;
            const uri = `https://ipfs.io/ipfs/collection-metadata-${i}`;
            const description = `Official UFC Fighters Collection #${i} - Featuring legendary fighters and champions`;
            const maximum = 1000; // Each collection can have 1000 tokens max
            const mutable_uri = true; // Enable URI mutability for all collections
            
            const hash = await createCollection(account, collectionName, uri, description, maximum, mutable_uri);
            results.push({ name: collectionName, hash });
            
            // Progress logging and rate limiting delays
            if (i % 5 === 0) {
                console.log(`📊 Progress: ${i}/50 collections created`);
            }
            
            // Longer delays to avoid rate limits
            if (i < 50) { // Don't delay after the last collection
                const baseDelay = 8000; // 8 seconds base delay
                const randomDelay = Math.random() * 2000; // 0-2 seconds random
                const totalDelay = baseDelay + randomDelay;
                
                console.log(`⏳ Waiting ${(totalDelay/1000).toFixed(1)}s before next collection...`);
                await new Promise(resolve => setTimeout(resolve, totalDelay));
            }
            
        } catch (error) {
            console.error(`❌ Failed to create collection #${i}:`, error);
            results.push({ 
                name: `UFC Fighters #${i}`, 
                hash: "", 
                error: error instanceof Error ? error.message : String(error) 
            });
            
            // Even on error, wait a bit before continuing
            if (i < 50) {
                console.log("⏳ Waiting 5s before continuing after error...");
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }
    }
    
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    const scriptEndTime = new Date();
    const totalScriptDuration = (scriptEndTime.getTime() - scriptStartTime.getTime()) / 1000;
    
    // Summary
    const successful = results.filter(r => !r.error).length;
    const failed = results.filter(r => r.error).length;
    
    console.log("\n🎉 Collection Creation Complete!");
    console.log("================================");
    console.log(`✅ Successful: ${successful}/50`);
    console.log(`❌ Failed: ${failed}/50`);
    console.log(`⏱️  Collections creation time: ${duration.toFixed(2)} seconds`);
    console.log(`⚡ Average: ${(duration / successful).toFixed(2)} seconds per successful collection`);
    console.log("");
    console.log(`🕐 Script started at: ${scriptStartTime.toLocaleString()}`);
    console.log(`🕐 Script ended at: ${scriptEndTime.toLocaleString()}`);
    console.log(`⏱️  Total script duration: ${totalScriptDuration.toFixed(2)} seconds`);
    
    // Save results to file
    const detailedResults = {
        summary: {
            total: 50,
            successful,
            failed,
            duration,
            totalScriptDuration,
            startTime: scriptStartTime.toISOString(),
            endTime: scriptEndTime.toISOString()
        },
        collections: results
    };
    
    await fs.writeFile(
        'collection-creation-results.json', 
        JSON.stringify(detailedResults, null, 2)
    );
    console.log("\n📄 Results saved to: collection-creation-results.json");
    
    if (failed > 0) {
        console.log("\n❌ Failed collections:");
        results.filter(r => r.error).forEach(r => {
            console.log(`   ${r.name}: ${r.error}`);
        });
        
        console.log("\n💡 Tips to reduce failures:");
        console.log("   1. Use Aptos API keys for higher rate limits");
        console.log("   2. Run during off-peak hours");
        console.log("   3. Consider running in smaller batches");
    }
    
    console.log("\n🌐 For production use, get API keys at:");
    console.log("   https://build.aptoslabs.com/docs/start");
}

// Run the script
create50Collections().catch(console.error); 