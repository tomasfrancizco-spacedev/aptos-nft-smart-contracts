# Aptos UFC NFT Scripts

This repository contains scripts to interact with the UFC NFT contract on the Aptos blockchain.

## About the Script

All functionality is implemented in the `scripts/ufc-nft.ts` file, which provides three main functions:
- Creating NFT collections
- Minting tokens with custom IDs
- Minting tokens for other accounts

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure your environment:
   - Copy `.env.example` to `.env` if needed (already created in this setup)
   - Update any configuration values in `.env` as needed
   - The main configuration values are:
     - `NODE_URL`: The Aptos node URL (defaults to Devnet)
     - `CONTRACT_ADDRESS`: The address of the deployed UFC NFT contract

## Running the Scripts

You can run the scripts either using npm commands or directly with ts-node:

### Create a Collection

```bash
npm run create-collection "UFC Collection" "https://ufc.com/collection" "The official UFC NFT collection" 10000
```

Or using ts-node directly:

```bash
npx ts-node scripts/ufc-nft.ts create-collection "UFC Collection" "https://ufc.com/collection" "The official UFC NFT collection" 10000
```

### Mint a Token with Custom ID

```bash
npm run mint 7 "UFC Collection" "Jon Jones" "https://ufc.com/nft/jon-jones" "UFC Heavyweight Champion Jon Jones" "Jon Jones" "Heavyweight" "27-1-0" 1
```

Or using ts-node directly:

```bash
npx ts-node scripts/ufc-nft.ts mint 7 "UFC Collection" "Jon Jones" "https://ufc.com/nft/jon-jones" "UFC Heavyweight Champion Jon Jones" "Jon Jones" "Heavyweight" "27-1-0" 1
```

### Mint a Token for Another Account

```bash
npm run mint-for 0xb51f2b3cdaf5fbe19532e245052261cf9aa242acacc73e1dfa79cb8cda44e75c 42 "UFC Collection" "Conor McGregor" "https://ufc.com/nft/conor-mcgregor" "UFC Champion Conor McGregor" "Conor McGregor" "Lightweight" "22-6-0" 5
```

Or using ts-node directly:

```bash
npx ts-node scripts/ufc-nft.ts mint-for 0xb51f2b3cdaf5fbe19532e245052261cf9aa242acacc73e1dfa79cb8cda44e75c 42 "UFC Collection" "Conor McGregor" "https://ufc.com/nft/conor-mcgregor" "UFC Champion Conor McGregor" "Conor McGregor" "Lightweight" "22-6-0" 5
```

## Account Management

The script automatically handles account management:
1. It attempts to load your account from `.aptos/config.yaml` from the Aptos CLI
2. If no account is found, it will create a new one
3. It ensures your account has enough funds to execute transactions

If you want to use a specific private key, you can add it to the `.env` file as `PRIVATE_KEY=your_key_here`.

## Parameters Reference

### Create Collection Parameters
- `name`: The name of the collection
- `uri`: The URI pointing to the collection's media
- `description`: A description of the collection
- `maximum`: The maximum number of tokens in the collection

### Mint Token Parameters
- `tokenId`: The custom ID for your token (must be unique)
- `collection`: The collection name
- `name`: The token name
- `uri`: The URI pointing to the token's media
- `description`: A description of the token
- `fighterName`: The name of the UFC fighter
- `weightClass`: The fighter's weight class
- `record`: The fighter's record (e.g., "27-1-0")
- `ranking`: The fighter's ranking

### Mint Token For Another Account Parameters
- `recipient`: The address of the account that will receive the NFT
- `tokenId`: The custom ID for your token (must be unique)
- `collection`: The collection name
- `name`: The token name
- `uri`: The URI pointing to the token's media
- `description`: A description of the token
- `fighterName`: The name of the UFC fighter
- `weightClass`: The fighter's weight class
- `record`: The fighter's record (e.g., "27-1-0")
- `ranking`: The fighter's ranking