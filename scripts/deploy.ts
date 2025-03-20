import { AptosClient, AptosAccount, FaucetClient, HexString, Types } from "aptos";
import { BCS, TxnBuilderTypes } from "aptos";
import * as fs from "fs/promises";

const NODE_URL = "https://fullnode.devnet.aptoslabs.com";
const FAUCET_URL = "https://faucet.devnet.aptoslabs.com";

(async () => {
    try {
        // Create API and faucet clients
        const client = new AptosClient(NODE_URL);
        const faucetClient = new FaucetClient(NODE_URL, FAUCET_URL);

        // Read private key from config
        const configContent = await fs.readFile('.aptos/config.yaml', 'utf8');
        const privateKeyLine = configContent.split('\n').find(line => line.includes('private_key:'));
        if (!privateKeyLine) {
            throw new Error('Private key not found in config');
        }
        const privateKeyHex = privateKeyLine.split('private_key:')[1].trim().replace(/['"]/g, '');

        // Create account from private key
        const account = new AptosAccount(
            HexString.ensure(privateKeyHex).toUint8Array()
        );

        console.log("Loaded existing account from config");
        console.log("Account address:", account.address().hex());

        // Fund account
        await faucetClient.fundAccount(account.address(), 100_000_000);
        console.log("Account funded");

        // Publish module
        const metadataBytes = await fs.readFile('build/UFC_NFT/package-metadata.bcs');
        const codeBytes = await fs.readFile('build/UFC_NFT/bytecode_modules/ufc_nft.mv');

        const moduleHex = HexString.fromUint8Array(codeBytes).toString();
        const metadataHex = HexString.fromUint8Array(metadataBytes).toString();

        // Create a transaction payload for publishing the module
        const payload: any = {
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
        
        if (!(txnInfo as any).success) {
            throw new Error(`Transaction failed: ${(txnInfo as any).vm_status}`);
        }
        
        console.log("Module published successfully!");
    } catch (error) {
        console.error("Error:", error);
        process.exit(1);
    }
})();