import { PublicKey } from "@solana/web3.js"

// Program ID for the merkle distributor
export const MERKLE_DISTRIBUTOR_PROGRAM_ID = new PublicKey(
  "mERKcfxMC5SqJn4Ld4BUris3WKZZ1ojjWJ3A3J5CKxv"
)

// Token mint address - this should be configured based on your deployment
export const TOKEN_MINT = new PublicKey(
  process.env.NEXT_PUBLIC_TOKEN_MINT || "JTZGoVsQQMkkUPvCM9s7K5L4qN1evKMCtF1fVT7KTMj"
)

// Airdrop version
export const AIRDROP_VERSION = BigInt(process.env.NEXT_PUBLIC_AIRDROP_VERSION || "0")

// Seeds for PDAs
export const DISTRIBUTOR_SEED = "MerkleDistributor"
export const CLAIM_STATUS_SEED = "ClaimStatus"