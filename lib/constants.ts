import { PublicKey } from "@solana/web3.js";

// Program ID for the merkle distributor
export const MERKLE_DISTRIBUTOR_PROGRAM_ID = new PublicKey(
  "mERKcfxMC5SqJn4Ld4BUris3WKZZ1ojjWJ3A3J5CKxv"
);

// Token mint address - this should be configured based on your deployment
export const TOKEN_MINT = new PublicKey(
  process.env.NEXT_PUBLIC_TOKEN_MINT ||
    "JTZGoVsQQMkkUPvCM9s7K5L4qN1evKMCtF1fVT7KTMj"
);

// Airdrop version
export const AIRDROP_VERSION = BigInt(
  process.env.NEXT_PUBLIC_AIRDROP_VERSION || "0"
);

// Seeds for PDAs
export const DISTRIBUTOR_SEED = "MerkleDistributor";
export const CLAIM_STATUS_SEED = "ClaimStatus";

// Common constants
export const LAMPORTS_PER_SOL = 1_000_000_000;
export const PRIORITY_FEE_MICROLAMPORTS = 100000;
export const REFRESH_INTERVAL_MS = 15000;
export const SLOT_TIME_MS = 400;
export const BLOCKS_PER_EPOCH = 432000;

// Vote addresses for SIMD-326
export const VOTE_ADDRESSES = {
  YES: "YESsimd326111111111111111111111111111111111",
  NO: "nosimd3261111111111111111111111111111111111",
  ABSTAIN: "ABSTA1Nsimd32611111111111111111111111111111",
};

// SIMD-326 mint address
export const SIMD_326_MINT = "s3262ckXrLnzPXG8RScfFAYWDQzZYgnr4vo1R2SboMW";

// Voting epochs configuration
export const VOTING_START_EPOCH = 840;
export const VOTING_END_EPOCH = 842;
