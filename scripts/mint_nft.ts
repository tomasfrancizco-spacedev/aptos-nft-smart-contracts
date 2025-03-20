import { AptosAccount, AptosClient, FaucetClient, Types } from "aptos";

const NODE_URL = "https://fullnode.devnet.aptoslabs.com";
const FAUCET_URL = "https://faucet.devnet.aptoslabs.com";
const RESOURCE_ACCOUNT_ADDRESS = "0x464b630d38076515d4fa0229d123290d3eeef9fa9e0859fb36fe9401299650f3";

async function main() {
    const client = new AptosClient(NODE_URL);
    const faucetClient = new FaucetClient(NODE_URL, FAUCET_URL);
    
    // Create or load your account
    const account = new AptosAccount();
    
    // Fund the account using faucet
    await faucetClient.fundAccount(account.address(), 100_000_000);
    
    console.log("Account address:", account.address().hex());
    console.log("Resource account address:", RESOURCE_ACCOUNT_ADDRESS);

    // Load the series and set IDs
    let seriesId, setId;
    try {
        const fs = await import('fs');
        seriesId = fs.readFileSync("series_id.txt", "utf8").trim();
        setId = fs.readFileSync("set_id.txt", "utf8").trim();
        console.log("Using series ID:", seriesId);
        console.log("Using set ID:", setId);
    } catch (error) {
        console.error("Failed to read series_id.txt or set_id.txt. Please create a series and set first.");
        process.exit(1);
    }

    // Mint a new NFT
    const payload: Types.TransactionPayload = {
        type: "entry_function_payload",
        function: `${RESOURCE_ACCOUNT_ADDRESS}::ufc_nft::mint_nft`,
        type_arguments: [],
        arguments: [
            account.address().hex(), // recipient
            seriesId, // series_id
            setId, // set_id
            1, // edition_number
        ],
    };

    console.log("Minting NFT...");
    const txnRequest = await client.generateTransaction(account.address(), payload);
    const signedTxn = await client.signTransaction(account, txnRequest);
    const txnResult = await client.submitTransaction(signedTxn);
    
    console.log("Transaction submitted:", txnResult.hash);
    console.log("Waiting for transaction to be processed...");
    
    await client.waitForTransaction(txnResult.hash);
    
    // Get the NFT ID from events
    const txnInfo = await client.getTransactionByHash(txnResult.hash);
    const nftMintedEvent = (txnInfo as any).events?.find(
        (e: any) => e.type.includes("NFTMintedEvent")
    );
    
    if (nftMintedEvent) {
        console.log("NFT minted with ID:", nftMintedEvent.data.nft_id);
        
        // Add metadata to the NFT
        const metadataPayload: Types.TransactionPayload = {
            type: "entry_function_payload",
            function: `${RESOURCE_ACCOUNT_ADDRESS}::ufc_nft::add_metadata`,
            type_arguments: [],
            arguments: [
                nftMintedEvent.data.nft_id, // nft_id
                ["Fighter: Dustin Poirier", "Event: UFC 291"], // attributes
                "image/jpeg", // media_type
                "https://ipfs.io/ipfs/QmHash...", // media_url (replace with your IPFS URL)
            ],
        };

        console.log("Adding metadata to NFT...");
        const metadataTxnRequest = await client.generateTransaction(account.address(), metadataPayload);
        const signedMetadataTxn = await client.signTransaction(account, metadataTxnRequest);
        const metadataTxnResult = await client.submitTransaction(signedMetadataTxn);
        
        console.log("Metadata transaction submitted:", metadataTxnResult.hash);
        console.log("Waiting for metadata transaction to be processed...");
        
        await client.waitForTransaction(metadataTxnResult.hash);
        console.log("NFT metadata added successfully!");
    } else {
        console.log("NFT minted but couldn't find the NFT ID in events");
    }
}

main().catch(console.error); 