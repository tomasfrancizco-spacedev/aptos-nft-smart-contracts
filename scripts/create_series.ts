import { AptosClient, AptosAccount, FaucetClient, HexString, Types } from "aptos";
import * as fs from "fs/promises";

const NODE_URL = "https://fullnode.devnet.aptoslabs.com";
const FAUCET_URL = "https://faucet.devnet.aptoslabs.com";
const RESOURCE_ACCOUNT_ADDRESS = "0xc0386ca51fff965280b4141d1d464f444e96480304db4c8dc1c00a223ea4c8e5";

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

        // Create series
        const createSeriesPayload: Types.TransactionPayload = {
            type: "entry_function_payload",
            function: `${RESOURCE_ACCOUNT_ADDRESS}::ufc_nft::create_series`,
            type_arguments: [],
            arguments: [
                "UFC Series 1",
                "First series of UFC NFTs",
                "https://ufc.com/series1",
                10000,
                100,
                "https://ufc.com/series1/metadata"
            ],
        };

        console.log("Creating series...");
        const txnRequest = await client.generateTransaction(account.address(), createSeriesPayload);
        const signedTxn = await client.signTransaction(account, txnRequest);
        const txnResult = await client.submitTransaction(signedTxn);
        
        console.log("Transaction submitted:", txnResult.hash);
        console.log("Waiting for transaction to be processed...");
        
        const txnInfo = await client.waitForTransactionWithResult(txnResult.hash);
        if (!txnInfo) {
            throw new Error("Transaction info not found");
        }
        console.log("Transaction info:", JSON.stringify(txnInfo, null, 2));

        // Check for events
        if ((txnInfo as any).events && (txnInfo as any).events.length > 0) {
            console.log("Events found in transaction:", (txnInfo as any).events.length);
            console.log("Event types:", (txnInfo as any).events.map((e: any) => e.type));
            
            // Look for SeriesCreatedEvent
            const seriesCreatedEvent = (txnInfo as any).events.find(
                (e: any) => e.type.includes(`${RESOURCE_ACCOUNT_ADDRESS}::ufc_nft::SeriesCreatedEvent`)
            );
            
            if (seriesCreatedEvent) {
                console.log("Series created event found!");
                console.log("Series ID:", seriesCreatedEvent.data.series_id);
                console.log("Full event data:", seriesCreatedEvent.data);
                
                // Save series ID to file
                await fs.writeFile("series_id.txt", seriesCreatedEvent.data.series_id);
                console.log("Series ID saved to series_id.txt");
            } else {
                console.log("No SeriesCreatedEvent found in transaction events");
            }
        } else {
            console.log("No events found in transaction");
        }

        if (!(txnInfo as any).success) {
            throw new Error(`Transaction failed: ${(txnInfo as any).vm_status}`);
        }
        
        console.log("Series created successfully!");
    } catch (error) {
        console.error("Error:", error);
        process.exit(1);
    }
})();