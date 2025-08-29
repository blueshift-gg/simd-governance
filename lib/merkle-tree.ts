import { PublicKey } from "@solana/web3.js";
import { keccak_256 } from "@noble/hashes/sha3";

export interface TreeNode {
  claimant: number[]; // Array representation of PublicKey
  proof: number[][]; // Array of 32-byte arrays for proof
  total_unlocked_staker: number;
  total_locked_staker: number;
  total_unlocked_searcher: number;
  total_locked_searcher: number;
  total_unlocked_validator: number;
  total_locked_validator: number;
}

export interface MerkleTreeData {
  merkle_root: number[];
  max_num_nodes: number;
  max_total_claim: number;
  tree_nodes: TreeNode[];
}

export function findNodeForAddress(
  merkleData: MerkleTreeData,
  address: PublicKey
): TreeNode | null {
  const addressBytes = address.toBytes();

  for (const node of merkleData.tree_nodes) {
    if (arraysEqual(node.claimant, Array.from(addressBytes))) {
      return node;
    }
  }

  return null;
}

export function calculateAmountUnlocked(node: TreeNode): bigint {
  return (
    BigInt(node.total_unlocked_searcher) +
    BigInt(node.total_unlocked_validator) +
    BigInt(node.total_unlocked_staker)
  );
}

export function calculateAmountLocked(node: TreeNode): bigint {
  return (
    BigInt(node.total_locked_searcher) +
    BigInt(node.total_locked_validator) +
    BigInt(node.total_locked_staker)
  );
}

function arraysEqual(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export async function loadMerkleTree(url: string): Promise<MerkleTreeData> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load merkle tree: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Error loading merkle tree:", error);
    throw error;
  }
}
