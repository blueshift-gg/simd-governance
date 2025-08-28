import { PublicKey } from "@solana/web3.js"
import { MERKLE_DISTRIBUTOR_PROGRAM_ID, DISTRIBUTOR_SEED, CLAIM_STATUS_SEED, TOKEN_MINT, AIRDROP_VERSION } from "./constants"

export function getMerkleDistributorPDA(
  programId: PublicKey = MERKLE_DISTRIBUTOR_PROGRAM_ID,
  mint: PublicKey = TOKEN_MINT,
  version: bigint = AIRDROP_VERSION
): [PublicKey, number] {
  // Version needs to be a little-endian u64 buffer
  const versionBuffer = Buffer.allocUnsafe(8)
  versionBuffer.writeBigUInt64LE(version)
  
  const seeds = [
    Buffer.from(DISTRIBUTOR_SEED),
    mint.toBuffer(),
    versionBuffer
  ]
  
  return PublicKey.findProgramAddressSync(seeds, programId)
}

export function getClaimStatusPDA(
  claimant: PublicKey,
  distributor: PublicKey,
  programId: PublicKey = MERKLE_DISTRIBUTOR_PROGRAM_ID
): [PublicKey, number] {
  const seeds = [
    Buffer.from(CLAIM_STATUS_SEED),
    claimant.toBuffer(),
    distributor.toBuffer()
  ]
  
  return PublicKey.findProgramAddressSync(seeds, programId)
}