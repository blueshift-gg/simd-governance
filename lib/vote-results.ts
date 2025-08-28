import { Connection, PublicKey } from "@solana/web3.js"
import { AccountLayout, TOKEN_PROGRAM_ID, getMint, getAssociatedTokenAddress } from "@solana/spl-token"
import { getMerkleDistributorPDA } from "./pda"

export interface VoteResults {
  yesVotes: bigint
  noVotes: bigint
  abstainVotes: bigint
  totalVotes: bigint
  totalSupply: bigint
  totalClaimed: bigint
  distributorBalance: bigint
  participationRate: number
  claimRate: number
  lastUpdated: number
}

export interface UserVotingPower {
  userAllocation: bigint
  votingPowerPercentage: number
  isSignificantVoter: boolean // If user has > 0.1% of total supply
}

export async function fetchVoteResults(
  connection: Connection,
  mintAddress: string,
  yesAddress: string,
  noAddress: string,
  abstainAddress: string
): Promise<VoteResults> {
  console.log("fetchVoteResults called with addresses:", {
    mintAddress,
    yesAddress,
    noAddress,
    abstainAddress
  })
  
  try {
    const mintPubkey = new PublicKey(mintAddress)
    const yesPubkey = new PublicKey(yesAddress)
    const noPubkey = new PublicKey(noAddress)
    const abstainPubkey = new PublicKey(abstainAddress)

    // Get distributor PDA and its ATA
    const [distributor] = getMerkleDistributorPDA(undefined, mintPubkey)
    const distributorAta = await getAssociatedTokenAddress(mintPubkey, distributor, true, TOKEN_PROGRAM_ID)

    // Derive the vote ATAs
    const [yesAta, noAta, abstainAta] = await Promise.all([
      getAssociatedTokenAddress(mintPubkey, yesPubkey, true, TOKEN_PROGRAM_ID),
      getAssociatedTokenAddress(mintPubkey, noPubkey, false, TOKEN_PROGRAM_ID),
      getAssociatedTokenAddress(mintPubkey, abstainPubkey, false, TOKEN_PROGRAM_ID)
    ])

    console.log("All addresses:", {
      mint: mintPubkey.toBase58(),
      distributor: distributor.toBase58(),
      distributorAta: distributorAta.toBase58(),
      yesAta: yesAta.toBase58(),
      noAta: noAta.toBase58(),
      abstainAta: abstainAta.toBase58()
    })

    // Fetch ALL accounts in a single RPC call: mint + distributor ATA + 3 vote ATAs
    console.log("Making getMultipleAccountsInfo call for 5 accounts...")
    const accountInfos = await connection.getMultipleAccountsInfo([
      mintPubkey,        // 0: mint account (for total supply)
      distributorAta,    // 1: distributor ATA (remaining tokens)
      yesAta,           // 2: yes vote ATA
      noAta,            // 3: no vote ATA  
      abstainAta        // 4: abstain vote ATA
    ])

    console.log("getMultipleAccountsInfo returned:", accountInfos.map(info => !!info?.data))

    // Parse mint account for total supply
    let totalSupply = BigInt(0)
    if (accountInfos[0]?.data) {
      try {
        // Mint account layout: supply is at offset 36 (u64, little endian)
        totalSupply = accountInfos[0].data.readBigUInt64LE(36)
        console.log("Total supply:", totalSupply.toString())
      } catch (e) {
        console.warn("Failed to parse mint account:", e)
      }
    }

    // Parse distributor ATA for remaining balance
    let distributorBalance = BigInt(0)
    if (accountInfos[1]?.data) {
      try {
        const distributorAccountData = AccountLayout.decode(accountInfos[1].data)
        distributorBalance = distributorAccountData.amount
        console.log("Distributor balance:", distributorBalance.toString())
      } catch (e) {
        console.warn("Failed to decode distributor account data:", e)
      }
    }

    // Parse vote ATAs for vote balances
    let yesVotes = BigInt(0)
    let noVotes = BigInt(0)
    let abstainVotes = BigInt(0)

    if (accountInfos[2]?.data) {
      try {
        const yesAccountData = AccountLayout.decode(accountInfos[2].data)
        yesVotes = yesAccountData.amount
      } catch (e) {
        console.warn("Failed to decode yes vote account data:", e)
      }
    }

    if (accountInfos[3]?.data) {
      try {
        const noAccountData = AccountLayout.decode(accountInfos[3].data)
        noVotes = noAccountData.amount
      } catch (e) {
        console.warn("Failed to decode no vote account data:", e)
      }
    }

    if (accountInfos[4]?.data) {
      try {
        const abstainAccountData = AccountLayout.decode(accountInfos[4].data)
        abstainVotes = abstainAccountData.amount
      } catch (e) {
        console.warn("Failed to decode abstain vote account data:", e)
      }
    }

    const totalVotes = yesVotes + noVotes + abstainVotes
    // Calculate total claimed: total supply minus what's left in distributor
    const totalClaimed = totalSupply - distributorBalance

    const participationRate = totalSupply > 0 ? Number((totalVotes * BigInt(10000)) / totalSupply) / 100 : 0
    const claimRate = totalSupply > 0 ? Number((totalClaimed * BigInt(10000)) / totalSupply) / 100 : 0

    console.log("Final vote results:", {
      yesVotes: yesVotes.toString(),
      noVotes: noVotes.toString(), 
      abstainVotes: abstainVotes.toString(),
      totalVotes: totalVotes.toString(),
      totalSupply: totalSupply.toString(),
      distributorBalance: distributorBalance.toString(),
      totalClaimed: totalClaimed.toString(),
      participationRate,
      claimRate
    })

    return {
      yesVotes,
      noVotes,
      abstainVotes,
      totalVotes,
      totalSupply,
      totalClaimed,
      distributorBalance,
      participationRate,
      claimRate,
      lastUpdated: Date.now()
    }
  } catch (error) {
    console.error("Error fetching vote results:", error)
    // Return empty results on error
    return {
      yesVotes: BigInt(0),
      noVotes: BigInt(0),
      abstainVotes: BigInt(0),
      totalVotes: BigInt(0),
      totalSupply: BigInt(0),
      totalClaimed: BigInt(0),
      distributorBalance: BigInt(0),
      participationRate: 0,
      claimRate: 0,
      lastUpdated: Date.now()
    }
  }
}

export function calculateUserVotingPower(
  userAllocation: bigint,
  totalSupply: bigint
): UserVotingPower {
  if (totalSupply === BigInt(0)) {
    return {
      userAllocation,
      votingPowerPercentage: 0,
      isSignificantVoter: false
    }
  }

  // Calculate percentage with 4 decimal places precision
  const percentage = Number((userAllocation * BigInt(1000000)) / totalSupply) / 10000
  const isSignificantVoter = percentage >= 0.1 // 0.1% or more

  return {
    userAllocation,
    votingPowerPercentage: percentage,
    isSignificantVoter
  }
}

export function formatVotePercentage(votes: bigint, totalVotes: bigint): string {
  if (totalVotes === BigInt(0)) return "0.00"
  const percentage = Number((votes * BigInt(10000)) / totalVotes) / 100
  return percentage.toFixed(2)
}

export function formatTokenAmount(amount: bigint, decimals: number = 9): string {
  const divisor = BigInt(10 ** decimals)
  const whole = amount / divisor
  const fraction = amount % divisor
  
  return `${whole.toLocaleString()}.${fraction.toString().padStart(decimals, "0").slice(0, 3)}`
}