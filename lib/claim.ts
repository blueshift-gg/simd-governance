import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  ComputeBudgetProgram,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
} from "@solana/spl-token";
import { BN } from "@coral-xyz/anchor";
import {
  TreeNode,
  calculateAmountLocked,
  calculateAmountUnlocked,
} from "./merkle-tree";
import { getMerkleDistributorPDA, getClaimStatusPDA } from "./pda";
import {
  MERKLE_DISTRIBUTOR_PROGRAM_ID,
  TOKEN_MINT,
  AIRDROP_VERSION,
} from "./constants";

interface NewClaimInstructionData {
  amount_unlocked: BN;
  amount_locked: BN;
  proof: Buffer[];
}

function serializeNewClaimInstruction(data: NewClaimInstructionData): Buffer {
  // Anchor discriminator for "new_claim" instruction
  // First 8 bytes of SHA256("global:new_claim")
  const discriminator = Buffer.from([
    0x4e, 0xb1, 0x62, 0x7b, 0xd2, 0x15, 0xbb, 0x53,
  ]);

  // Serialize amount_unlocked (8 bytes, little-endian)
  const amountUnlockedBuffer = Buffer.allocUnsafe(8);
  amountUnlockedBuffer.writeBigUInt64LE(
    BigInt(data.amount_unlocked.toString())
  );

  // Serialize amount_locked (8 bytes, little-endian)
  const amountLockedBuffer = Buffer.allocUnsafe(8);
  amountLockedBuffer.writeBigUInt64LE(BigInt(data.amount_locked.toString()));

  // Serialize proof as Vec<[u8; 32]>
  // First 4 bytes: length of vector (little-endian)
  const proofLengthBuffer = Buffer.allocUnsafe(4);
  proofLengthBuffer.writeUInt32LE(data.proof.length);

  // Then concatenate all 32-byte proof elements
  const proofBuffer = Buffer.concat(data.proof);

  const result = Buffer.concat([
    discriminator,
    amountUnlockedBuffer,
    amountLockedBuffer,
    proofLengthBuffer,
    proofBuffer,
  ]);

  console.log("Serialized instruction data:", {
    discriminator: discriminator.toString("hex"),
    amountUnlocked: data.amount_unlocked.toString(),
    amountLocked: data.amount_locked.toString(),
    proofLength: data.proof.length,
    totalLength: result.length,
    fullData: result.toString("hex"),
  });

  return result;
}

export async function buildClaimTransaction(
  connection: Connection,
  claimant: PublicKey,
  node: TreeNode,
  priorityFee?: number
): Promise<Transaction> {
  const transaction = new Transaction();

  // Get PDAs
  const [distributor] = getMerkleDistributorPDA();
  const [claimStatusPda] = getClaimStatusPDA(claimant, distributor);

  console.log("Building claim transaction:", {
    distributor: distributor.toBase58(),
    claimStatusPda: claimStatusPda.toBase58(),
    claimant: claimant.toBase58(),
    mint: TOKEN_MINT.toBase58(),
    programId: MERKLE_DISTRIBUTOR_PROGRAM_ID.toBase58(),
    airdropVersion: AIRDROP_VERSION,
  });

  // Get token accounts
  const claimantAta = await getAssociatedTokenAddress(
    TOKEN_MINT,
    claimant,
    false, // claimant is on-curve
    TOKEN_PROGRAM_ID
  );
  // Distributor is a PDA, so we need to allow off-curve addresses
  const distributorAta = await getAssociatedTokenAddress(
    TOKEN_MINT,
    distributor,
    true, // allowOwnerOffCurve = true for PDAs
    TOKEN_PROGRAM_ID
  );

  console.log("Token accounts:", {
    claimantAta: claimantAta.toBase58(),
    distributorAta: distributorAta.toBase58(),
  });

  // Add compute budget instructions first
  const modifyComputeUnits = ComputeBudgetProgram.setComputeUnitLimit({
    units: 300000,
  });
  transaction.add(modifyComputeUnits);

  // Check if claimant's ATA exists and create if needed
  const claimantAtaInfo = await connection.getAccountInfo(claimantAta);
  if (!claimantAtaInfo) {
    console.log("Creating ATA for claimant");
    const createAtaIx = createAssociatedTokenAccountInstruction(
      claimant, // payer
      claimantAta, // ata
      claimant, // owner
      TOKEN_MINT, // mint
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    transaction.add(createAtaIx);
  }

  // Calculate amounts
  const amountUnlocked = calculateAmountUnlocked(node);
  const amountLocked = calculateAmountLocked(node);

  console.log("Claim amounts:", {
    amountUnlocked: amountUnlocked.toString(),
    amountLocked: amountLocked.toString(),
    proofLength: node.proof.length,
    proof: node.proof.map((p) => Buffer.from(p).toString("hex")),
  });

  // Convert proof from number arrays to 32-byte Buffers
  const proof = node.proof.map((proofElement) => {
    // Ensure each proof element is exactly 32 bytes
    if (proofElement.length !== 32) {
      throw new Error(
        `Invalid proof element length: ${proofElement.length}, expected 32`
      );
    }
    return Buffer.from(proofElement);
  });

  // Create NewClaim instruction with exact account ordering from example
  const newClaimIx = new TransactionInstruction({
    programId: MERKLE_DISTRIBUTOR_PROGRAM_ID,
    keys: [
      { pubkey: distributor, isSigner: false, isWritable: true },
      { pubkey: claimStatusPda, isSigner: false, isWritable: true },
      { pubkey: distributorAta, isSigner: false, isWritable: true },
      { pubkey: claimantAta, isSigner: false, isWritable: true },
      { pubkey: claimant, isSigner: true, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: serializeNewClaimInstruction({
      amount_unlocked: new BN(amountUnlocked.toString()),
      amount_locked: new BN(amountLocked.toString()),
      proof,
    }),
  });

  // Add the claim instruction
  transaction.add(newClaimIx);

  // Add priority fee AFTER main instruction (like CLI does)
  if (priorityFee && priorityFee > 0) {
    const priorityFeeIx = ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: priorityFee,
    });
    transaction.add(priorityFeeIx);
    console.log(
      `Added priority fee instruction of ${priorityFee} microlamports`
    );
  }

  // Set recent blockhash
  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = claimant;

  console.log("Transaction details:", {
    instructions: transaction.instructions.length,
    feePayer: transaction.feePayer?.toBase58(),
    recentBlockhash: transaction.recentBlockhash,
    signatures: transaction.signatures.map((s) => s.publicKey.toBase58()),
  });

  // Test simulation before returning
  try {
    const simulation = await connection.simulateTransaction(transaction);
    console.log("Transaction simulation:", simulation);
    if (simulation.value.err) {
      console.error("Simulation failed:", simulation.value.err);
    }
  } catch (e) {
    console.error("Simulation error:", e);
  }

  return transaction;
}

export async function checkClaimStatus(
  connection: Connection,
  claimant: PublicKey
): Promise<boolean> {
  const [distributor] = getMerkleDistributorPDA();
  const [claimStatusPda] = getClaimStatusPDA(claimant, distributor);

  console.log("Checking claim status:", {
    claimant: claimant.toBase58(),
    distributor: distributor.toBase58(),
    claimStatusPda: claimStatusPda.toBase58(),
  });

  try {
    const account = await connection.getAccountInfo(claimStatusPda);
    const hasClaimed = account !== null;

    console.log("Claim status result:", {
      hasClaimed,
      accountExists: !!account,
      accountData: account?.data ? "Present" : "None",
    });

    return hasClaimed;
  } catch (error) {
    console.error("Error checking claim status:", error);
    return false;
  }
}
