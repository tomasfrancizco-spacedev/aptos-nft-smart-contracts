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

async function loadAccount(privateKeyHex?: string): Promise<AptosAccount> {
    if (privateKeyHex) {
        return new AptosAccount(HexString.ensure(privateKeyHex).toUint8Array());
    }
    
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

async function fundAccountIfNeeded(account: AptosAccount, amount: number = 100_000_000): Promise<void> {
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
    maximum: number
): Promise<string> {
    console.log(`Creating collection: ${name}...`);
    
    const payload: Types.TransactionPayload = {
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

async function batchMintSimple(
    account: AptosAccount,
    collections: string[],
    uris: string[]
): Promise<string> {
    console.log(`Batch minting ${uris.length} tokens to ${collections.length} collections...`);
    
    if (collections.length !== uris.length) {
        throw new Error("Collections and URIs arrays must have the same length");
    }
    
    const payload: Types.TransactionPayload = {
        type: "entry_function_payload",
        function: `${CONTRACT_ADDRESS}::ufc_nft::batch_mint_simple`,
        type_arguments: [],
        arguments: [collections, uris],
    };
    
    const txnRequest = await client.generateTransaction(account.address(), payload);
    const signedTxn = await client.signTransaction(account, txnRequest);
    const txnResult = await client.submitTransaction(signedTxn);
    
    await client.waitForTransaction(txnResult.hash);
    console.log(`Batch minted ${uris.length} tokens! Transaction hash: ${txnResult.hash}`);
    
    return txnResult.hash;
}

async function batchMintSimpleFor(
    account: AptosAccount,
    collections: string[],
    recipients: string[],
    uris: string[]
): Promise<string> {
    console.log(`Batch minting ${uris.length} tokens for ${recipients.length} recipients across ${collections.length} collections...`);
    
    if (recipients.length !== uris.length || collections.length !== uris.length) {
        throw new Error("Collections, recipients, and URIs arrays must all have the same length");
    }
    
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
    console.log(`Batch minted ${uris.length} tokens for recipients! Transaction hash: ${txnResult.hash}`);
    
    return txnResult.hash;
}

// Helper function to parse comma-separated URIs
function parseUris(urisString: string): string[] {
    return urisString.split(',').map(uri => uri.trim()).filter(uri => uri.length > 0);
}

// Helper function to parse comma-separated collections
function parseCollections(collectionsString: string): string[] {
    return collectionsString.split(',').map(collection => collection.trim()).filter(collection => collection.length > 0);
}

// Helper function to parse comma-separated recipients
function parseRecipients(recipientsString: string): string[] {
    return recipientsString.split(',').map(addr => addr.trim()).filter(addr => addr.length > 0);
}

// Main function that demonstrates usage
async function main() {
    console.log("UFC NFT Management Script (Batch Version)");
    console.log("==========================================");
    
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
                await createCollection(
                    account,
                    args[1], // name
                    args[2], // uri
                    args[3], // description
                    parseInt(args[4]) // maximum
                );
                break;
                
            case "batch-mint":
                if (args.length < 4) {
                    console.error("Missing parameters for batch-mint");
                    printUsage();
                    return;
                }
                const collections = parseCollections(args[2]);
                const uris = parseUris(args[3]);
                if (collections.length === 0) {
                    console.error("No valid collections provided");
                    return;
                }
                if (uris.length === 0) {
                    console.error("No valid URIs provided");
                    return;
                }
                if (collections.length !== uris.length) {
                    console.error("Number of collections must match number of URIs");
                    return;
                }
                await batchMintSimple(
                    account,
                    collections, // array of collections
                    uris         // array of URIs
                );
                break;
                
            case "batch-mint-for":
                if (args.length < 5) {
                    console.error("Missing parameters for batch-mint-for");
                    printUsage();
                    return;
                }
                const collectionsFor = parseCollections(args[2]);
                const recipients = parseRecipients(args[3]);
                const urisFor = parseUris(args[4]);
                
                if (collectionsFor.length === 0) {
                    console.error("No valid collections provided");
                    return;
                }
                if (recipients.length === 0) {
                    console.error("No valid recipients provided");
                    return;
                }
                if (urisFor.length === 0) {
                    console.error("No valid URIs provided");
                    return;
                }
                if (collectionsFor.length !== recipients.length || recipients.length !== urisFor.length) {
                    console.error("Number of collections, recipients, and URIs must all match");
                    return;
                }
                
                await batchMintSimpleFor(
                    account,
                    collectionsFor, // array of collections
                    recipients,     // array of recipient addresses
                    urisFor         // array of URIs
                );
                break;
                
            default:
                console.error(`Unknown command: ${command}`);
                printUsage();
                return;
        }
        
        console.log("Operation completed successfully!");
    } catch (error) {
        console.error("Error:", error);
    }
}

function printUsage() {
    console.log(`
Usage:
    npx ts-node scripts/ufc-nft.ts create-collection <name> <uri> <description> <maximum>
    npx ts-node scripts/ufc-nft.ts batch-mint <collections_comma_separated> <uris_comma_separated>
    npx ts-node scripts/ufc-nft.ts batch-mint-for <collections_comma_separated> <recipients_comma_separated> <uris_comma_separated>

Examples:
    # Create a collection
    npx ts-node scripts/ufc-nft.ts create-collection "UFC Collection" "https://ufc.com/collection" "The official UFC NFT collection" 10000
    
    # Batch mint 3 tokens to different collections
    npx ts-node scripts/ufc-nft.ts batch-mint "UFC Collection,UFC Fighters,UFC Belts" "ipfs://QmHash1,ipfs://QmHash2,ipfs://QmHash3"
    
    # Batch mint tokens to different recipients and collections
    npx ts-node scripts/ufc-nft.ts batch-mint-for "UFC Collection,UFC Fighters,UFC Belts" "0xabc123...,0xdef456...,0x789xyz..." "ipfs://QmHash1,ipfs://QmHash2,ipfs://QmHash3"
    
    # Single token examples
    npx ts-node scripts/ufc-nft.ts batch-mint "UFC Collection" "ipfs://QmJonJonesHash"
    npx ts-node scripts/ufc-nft.ts batch-mint-for "UFC Collection" "0xb51f2b3cdaf5fbe19532e245052261cf9aa242acacc73e1dfa79cb8cda44e75c" "ipfs://QmConorHash"

Note: 
- Collections, URIs, and recipients should be comma-separated with no spaces (or spaces will be trimmed)
- All arrays (collections, recipients, URIs) must have the same length for batch-mint-for
- Collections and URIs must have the same length for batch-mint
- Maximum batch size is 100 tokens per transaction
- Each collection name can be up to 100 characters long
- Tokens will be automatically named as "Token #1", "Token #2", etc.
- All metadata should be stored in IPFS and referenced by the URI
`);
}

// Run the main function
main().catch(console.error); 