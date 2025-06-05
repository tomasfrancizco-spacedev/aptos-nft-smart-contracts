# Aptos UFC NFT Scripts (Multi-Collection Batch Version)

This repository contains scripts to interact with the UFC NFT contract on the Aptos blockchain.

## About the Script

All functionality is implemented in the `scripts/ufc-nft.ts` file, which provides three main functions:
- Creating NFT collections
- Batch minting tokens across multiple collections (gas-efficient)
- Batch minting tokens for multiple recipients across multiple collections

## Key Features

- **Multi-Collection Batch Minting**: Mint up to 100 tokens across different collections in a single transaction
- **Auto-naming**: Tokens are automatically named "Token #1", "Token #2", etc.
- **IPFS Integration**: All metadata stored in IPFS, only URI stored on-chain
- **Sequential IDs**: Automatic sequential token ID generation across all collections
- **Flexible Collection Names**: Support for collection names up to 100 characters

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure your environment by creating a `.env` file:
```bash
NODE_URL=https://fullnode.devnet.aptoslabs.com
FAUCET_URL=https://faucet.devnet.aptoslabs.com
```

3. Initialize Aptos CLI (if not done already):
```bash
aptos init
```

## Usage

### Deploy Contract
```bash
npm run deploy
```

### Create a Collection
```bash
npm run create-collection "UFC Collection" "https://ufc.com/metadata" "Official UFC NFT Collection" 10000
```

### Batch Mint (Multi-Collection)
```bash
# Mint tokens to different collections
npm run batch-mint "UFC Fighters,UFC Belts,UFC Events" "ipfs://QmHash1,ipfs://QmHash2,ipfs://QmHash3"

# Single collection (backward compatible)
npm run batch-mint "UFC Collection" "ipfs://QmHash1"
```

### Batch Mint for Recipients (Multi-Collection)
```bash
# Mint to different recipients across different collections
npm run batch-mint-for "UFC Fighters,UFC Belts,UFC Events" "0xabc123...,0xdef456...,0x789xyz..." "ipfs://QmHash1,ipfs://QmHash2,ipfs://QmHash3"

# Single recipient and collection
npm run batch-mint-for "UFC Collection" "0xrecipient..." "ipfs://QmHash1"
```

## Function Parameters

### `batch_mint_simple`
- `collections`: Array of collection names (up to 100 chars each)
- `uris`: Array of IPFS URIs for token metadata
- **Requirement**: `collections.length == uris.length`

### `batch_mint_simple_for`  
- `collections`: Array of collection names (up to 100 chars each)
- `recipients`: Array of recipient wallet addresses
- `uris`: Array of IPFS URIs for token metadata
- **Requirement**: `collections.length == recipients.length == uris.length`

## Constraints

- **Max Batch Size**: 100 tokens per transaction
- **Max Collection Name**: 100 characters
- **Max URI Length**: 100 characters
- **Array Matching**: All input arrays must have the same length

## Gas Optimization

This implementation is optimized for gas efficiency:
- Batch operations reduce transaction costs
- Minimal on-chain storage (only URI stored)
- Sequential ID generation prevents collisions
- Multiple collections in single transaction