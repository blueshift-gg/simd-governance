# SolGov Token Claim Web Interface

A web interface for claiming SolGov tokens using Solana Wallet Adapter. This application allows users to connect their wallets and claim tokens based on merkle proofs.

## Features

- Solana wallet integration (Phantom, Solflare, Torus, Ledger)
- Automatic merkle proof lookup from public folder
- Display of claimable amounts (locked and unlocked)
- Transaction building and submission
- Claim status checking

## Setup

### Prerequisites

- Node.js 18+ and npm
- A merkle tree JSON file with proofs for eligible addresses

### Installation

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables:
```bash
cp .env.example .env
```

Edit `.env` and set:
- `NEXT_PUBLIC_RPC_URL`: Your Solana RPC endpoint
- `NEXT_PUBLIC_TOKEN_MINT`: The token mint address
- `NEXT_PUBLIC_AIRDROP_VERSION`: The airdrop version number

3. Add your merkle tree file:

Place your merkle tree JSON file in the `public` folder as `merkle-tree.json`. This file should have the following structure:

```json
{
  "merkle_root": [...],
  "max_num_nodes": 1000,
  "max_total_claim": 1000000000000,
  "tree_nodes": [
    {
      "claimant": [...],
      "proof": [...],
      "total_unlocked_staker": 0,
      "total_locked_staker": 0,
      "total_unlocked_searcher": 0,
      "total_locked_searcher": 0,
      "total_unlocked_validator": 0,
      "total_locked_validator": 0
    }
  ]
}
```

### Development

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

### Production Build

Build for production:

```bash
npm run build
npm run start
```

## How It Works

1. **Merkle Tree Loading**: The application loads the merkle tree from `/public/merkle-tree.json`
2. **Wallet Connection**: Users connect their Solana wallet using the wallet adapter
3. **Eligibility Check**: The app searches for the connected wallet's address in the merkle tree
4. **Claim Status**: Checks on-chain if the user has already claimed
5. **Token Claiming**: Builds and sends a transaction to claim tokens with the merkle proof

## Security Notes

- The merkle tree file should be generated securely and verified before deployment
- Users should verify the program ID and mint address before claiming
- All transactions require user approval through their wallet

## Customization

### Changing the Merkle Tree Location

Update the URL in `components/ClaimInterface.tsx`:

```typescript
const data = await loadMerkleTree("/your-merkle-tree.json")
```

### Adding Priority Fees

Modify the priority fee in `components/ClaimInterface.tsx`:

```typescript
const transaction = await buildClaimTransaction(
  connection,
  publicKey,
  userNode,
  10000 // Priority fee in microlamports
)
```

## License

MIT