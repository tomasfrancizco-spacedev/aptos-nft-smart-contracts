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
            formattedPrivateKey = formattedPrivateKey.replace('ed25519-priv-', '');
        } else if (!formattedPrivateKey.startsWith('0x')) {
            formattedPrivateKey = '0x' + formattedPrivateKey;
        }
        
        return new AptosAccount(HexString.ensure(formattedPrivateKey).toUint8Array());
    } catch (e) {
        // Generate a new account if config doesn't exist
        console.log("⚠️  Config not found, generating new account...");
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

async function updateTokenUri(
    account: AptosAccount,
    digitalAssetAddress: string,
    newUri: string
): Promise<string> {
    console.log(`🔄 Updating URI for token at address ${digitalAssetAddress}...`);
    console.log(`📝 New URI: ${newUri}`);

    // Use the standard Aptos token object URI update function
    const payload: Types.TransactionPayload = {
        type: "entry_function_payload",
        function: `0x4::token::set_uri`,
        type_arguments: [],
        arguments: [digitalAssetAddress, newUri],
    };

    const txnRequest = await client.generateTransaction(account.address(), payload);
    const signedTxn = await client.signTransaction(account, txnRequest);
    const txnResult = await client.submitTransaction(signedTxn);

    await client.waitForTransaction(txnResult.hash);
    console.log(`✅ NFT URI updated successfully! Transaction hash: ${txnResult.hash}`);

    return txnResult.hash;
}

async function main() {
    const scriptStartTime = new Date();
    console.log("🚀 Update Token URI");
    console.log("==================");
    console.log(`⏰ Started at: ${scriptStartTime.toLocaleString()}`);
    console.log("");

    try {
        // Load or create account
        const account = await loadAccount();
        console.log(`🔑 Using account: ${account.address().hex()}`);

        // Fund the account if needed
        await fundAccountIfNeeded(account, 1000_000_000); // 10 APT

        // Replace these values with the correct ones
        const digitalAssetAddress = "0xe7997c14b16417a76a50425e485810a1fb4514b773ae9cda5d30c1638902603d"; // Address of the token to update
        const newUri = "ipfs://bafkreieuw2ho5y2sdsz3s57vzyayqsqdv7tarklmwqaqhhfek3ls5ljvuu"; // New URI to assign

        console.log("📋 Update Details:");
        console.log(`   Token Address: ${digitalAssetAddress}`);
        console.log(`   New URI: ${newUri}`);
        console.log("");

        const startTime = Date.now();

        // Update the token URI
        const hash = await updateTokenUri(account, digitalAssetAddress, newUri);

        const endTime = Date.now();
        const duration = (endTime - startTime) / 1000;
        const scriptEndTime = new Date();
        const totalScriptDuration = (scriptEndTime.getTime() - scriptStartTime.getTime()) / 1000;

        // Success summary
        console.log("");
        console.log("🎉 Update Complete!");
        console.log("===================");
        console.log(`✅ Token URI updated successfully`);
        console.log(`📋 Transaction hash: ${hash}`);
        console.log(`⏱️  Update transaction time: ${duration.toFixed(2)} seconds`);
        console.log("");
        console.log(`🕐 Script started at: ${scriptStartTime.toLocaleString()}`);
        console.log(`🕐 Script ended at: ${scriptEndTime.toLocaleString()}`);
        console.log(`⏱️  Total script duration: ${totalScriptDuration.toFixed(2)} seconds`);

        // Save transaction result
        const result = {
            success: true,
            transactionHash: hash,
            digitalAssetAddress,
            newUri,
            duration: duration,
            totalScriptDuration: totalScriptDuration,
            startTime: scriptStartTime.toISOString(),
            endTime: scriptEndTime.toISOString(),
            timestamp: new Date().toISOString()
        };

        await fs.writeFile(
            'update-uri-result.json', 
            JSON.stringify(result, null, 2)
        );
        console.log("\n📄 Results saved to: update-uri-result.json");

    } catch (error) {
        const scriptEndTime = new Date();
        const totalScriptDuration = (scriptEndTime.getTime() - scriptStartTime.getTime()) / 1000;

        console.error("❌ Update failed:", error);
        console.log("");
        console.log(`🕐 Script started at: ${scriptStartTime.toLocaleString()}`);
        console.log(`🕐 Script ended at: ${scriptEndTime.toLocaleString()}`);
        console.log(`⏱️  Total script duration: ${totalScriptDuration.toFixed(2)} seconds`);

        // Save error result
        const errorResult = {
            success: false,
            error: error instanceof Error ? error.message : String(error),
            digitalAssetAddress: "0xe7997c14b16417a76a50425e485810a1fb4514b773ae9cda5d30c1638902603d",
            duration: totalScriptDuration,
            startTime: scriptStartTime.toISOString(),
            endTime: scriptEndTime.toISOString(),
            timestamp: new Date().toISOString()
        };

        await fs.writeFile(
            'update-uri-error.json', 
            JSON.stringify(errorResult, null, 2)
        );
        console.log("📄 Error details saved to: update-uri-error.json");

        process.exit(1);
    }
}

main().catch((error) => {
    console.error("Main error:", error);
    process.exit(1);
});
