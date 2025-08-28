"use client"

import { useState, useEffect, useCallback } from "react"
import toast from "react-hot-toast"
import { useWallet, useConnection } from "@solana/wallet-adapter-react"
import { WalletMultiButton } from "./WalletMultiButton"
import { PublicKey, Transaction } from "@solana/web3.js"
import { getAssociatedTokenAddress, AccountLayout, TOKEN_PROGRAM_ID, createTransferInstruction, createAssociatedTokenAccountInstruction } from "@solana/spl-token"
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, RadialBarChart, RadialBar } from 'recharts'
import { 
  MerkleTreeData,
  TreeNode,
  findNodeForAddress,
  loadMerkleTree,
  calculateAmountUnlocked,
  calculateAmountLocked
} from "@/lib/merkle-tree"
import { buildClaimTransaction, checkClaimStatus } from "@/lib/claim"
import { 
  fetchVoteResults, 
  calculateUserVotingPower, 
  formatVotePercentage,
  formatTokenAmount as formatVoteTokens,
  VoteResults,
  UserVotingPower 
} from "@/lib/vote-results"
import { TOKEN_MINT } from "@/lib/constants"
import WalletEligibilityChecker from "@/components/WalletEligibilityChecker"

export default function ClaimInterface() {
  const { publicKey, sendTransaction } = useWallet()
  const { connection } = useConnection()
  const [merkleData, setMerkleData] = useState<MerkleTreeData | null>(null)
  const [userNode, setUserNode] = useState<TreeNode | null>(null)
  const [loading, setLoading] = useState(false)
  const [claiming, setClaiming] = useState(false)
  const [hasClaimed, setHasClaimed] = useState(false)
  const [voteResults, setVoteResults] = useState<VoteResults | null>(null)
  const [userVotingPower, setUserVotingPower] = useState<UserVotingPower | null>(null)
  const [loadingVotes, setLoadingVotes] = useState(false)
  const [userTokenBalance, setUserTokenBalance] = useState<bigint>(BigInt(0))
  const [loadingBalance, setLoadingBalance] = useState(false)
  const [checkingClaimStatus, setCheckingClaimStatus] = useState(false)
  const [voting, setVoting] = useState(false)
  const [selectedVoteOption, setSelectedVoteOption] = useState<'yes' | 'no' | 'abstain'>('yes')
  const [voteAmount, setVoteAmount] = useState("")

  // Load merkle tree data
  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      try {
        const data = await loadMerkleTree("/simd326-merkle-tree.json")
        setMerkleData(data)
      } catch (err) {
        console.error("Error loading merkle tree:", err)
        toast.error("Failed to load merkle tree data")
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  // Find user's node when wallet connects
  useEffect(() => {
    if (publicKey && merkleData) {
      const node = findNodeForAddress(merkleData, publicKey)
      setUserNode(node)
      
      setCheckingClaimStatus(true)
      checkClaimStatus(connection, publicKey).then(claimed => {
        setHasClaimed(claimed)
      }).finally(() => {
        setCheckingClaimStatus(false)
      })
    } else {
      setUserNode(null)
      setHasClaimed(false)
    }
  }, [publicKey, merkleData, connection])

  // Load vote results
  useEffect(() => {
    const loadVoteData = async () => {
      setLoadingVotes(true)
      try {
        const simd326 = {
          mintAddress: "s3262ckXrLnzPXG8RScfFAYWDQzZYgnr4vo1R2SboMW",
          yesAddress: "YESsimd326111111111111111111111111111111111",
          noAddress: "nosimd3261111111111111111111111111111111111",
          abstainAddress: "ABSTA1Nsimd32611111111111111111111111111111"
        }
        const results = await fetchVoteResults(
          connection,
          simd326.mintAddress,
          simd326.yesAddress,
          simd326.noAddress,
          simd326.abstainAddress
        )
        setVoteResults(results)
        
        if (userNode) {
          const userAllocation = calculateAmountUnlocked(userNode) + calculateAmountLocked(userNode)
          const votingPower = calculateUserVotingPower(userAllocation, results.totalSupply)
          setUserVotingPower(votingPower)
        }
      } catch (error) {
        console.error("Error loading vote data:", error)
      } finally {
        setLoadingVotes(false)
      }
    }
    
    loadVoteData()
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadVoteData()
      }
    }, 15000)
    
    return () => clearInterval(interval)
  }, [connection, userNode])

  // Fetch user token balance
  const fetchUserTokenBalance = useCallback(async () => {
    if (!publicKey) {
      setUserTokenBalance(BigInt(0))
      return
    }
    
    setLoadingBalance(true)
    try {
      const userAta = await getAssociatedTokenAddress(TOKEN_MINT, publicKey, false, TOKEN_PROGRAM_ID)
      const accountInfo = await connection.getAccountInfo(userAta)
      
      if (accountInfo?.data) {
        const accountData = AccountLayout.decode(accountInfo.data)
        setUserTokenBalance(accountData.amount)
      } else {
        setUserTokenBalance(BigInt(0))
      }
    } catch (error) {
      console.error("Error fetching token balance:", error)
      setUserTokenBalance(BigInt(0))
    } finally {
      setLoadingBalance(false)
    }
  }, [publicKey, connection])

  useEffect(() => {
    fetchUserTokenBalance()
  }, [fetchUserTokenBalance])

  const handleClaim = useCallback(async () => {
    if (!publicKey || !userNode) return
    
    setClaiming(true)
    const toastId = toast.loading('Building transaction...')
    
    try {
      const transaction = await buildClaimTransaction(
        connection,
        publicKey,
        userNode,
        100000
      )
      
      toast.loading('Sending transaction...', { id: toastId })
      const signature = await sendTransaction(transaction, connection)
      
      toast.loading('Confirming...', { id: toastId })
      await connection.confirmTransaction(signature, "confirmed")
      
      toast.success(
        <div>
          <span className="font-semibold">Tokens claimed!</span>
          <a 
            href={`https://solscan.io/tx/${signature}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-xs mt-1 underline"
          >
            View transaction →
          </a>
        </div>,
        { id: toastId, duration: 8000 }
      )
      
      setHasClaimed(true)
      // Add small delay to ensure blockchain state is updated
      await new Promise(resolve => setTimeout(resolve, 1000))
      await fetchUserTokenBalance()
    } catch (err: any) {
      toast.error(err.message || "Failed to claim", { id: toastId })
    } finally {
      setClaiming(false)
    }
  }, [publicKey, userNode, connection, sendTransaction, fetchUserTokenBalance])

  const handleVote = useCallback(async () => {
    if (!publicKey) return
    
    const amount = parseFloat(voteAmount || '0')
    
    if (amount <= 0) {
      toast.error("Enter a vote amount")
      return
    }
    
    const amountBN = BigInt(Math.floor(amount * 1_000_000_000))
    
    if (amountBN > userTokenBalance) {
      toast.error("Insufficient balance")
      return
    }
    
    setVoting(true)
    
    // These are the vote account addresses
    const voteAccounts = {
      yes: new PublicKey("YESsimd326111111111111111111111111111111111"),
      no: new PublicKey("nosimd3261111111111111111111111111111111111"), 
      abstain: new PublicKey("ABSTA1Nsimd32611111111111111111111111111111")
    }
    
    const voteAccount = voteAccounts[selectedVoteOption]
    const voteType = selectedVoteOption.toUpperCase()
    
    const toastId = toast.loading(`Casting ${voteType} vote...`)
    
    try {
      console.log("Vote details:", { 
        selectedVoteOption, 
        voteAccount: voteAccount.toString(), 
        amount, 
        amountBN: amountBN.toString(),
        userTokenBalance: userTokenBalance.toString()
      })
      
      const userAta = await getAssociatedTokenAddress(TOKEN_MINT, publicKey, false, TOKEN_PROGRAM_ID)
      const transaction = new Transaction()
      
      // Get the ATA for the vote account (allow owner off curve)
      const voteAta = await getAssociatedTokenAddress(TOKEN_MINT, voteAccount, true, TOKEN_PROGRAM_ID)
      
      console.log("ATAs:", {
        userAta: userAta.toString(),
        voteAta: voteAta.toString()
      })
      
      // Check if the vote ATA exists, create if needed
      const voteAtaInfo = await connection.getAccountInfo(voteAta)
      if (!voteAtaInfo) {
        const createAtaIx = createAssociatedTokenAccountInstruction(
          publicKey,
          voteAta,
          voteAccount,
          TOKEN_MINT,
          TOKEN_PROGRAM_ID
        )
        transaction.add(createAtaIx)
      }
      
      // Transfer tokens to the vote ATA
      const transferIx = createTransferInstruction(
        userAta,
        voteAta,
        publicKey,
        amountBN,
        [],
        TOKEN_PROGRAM_ID
      )
      transaction.add(transferIx)
      
      const signature = await sendTransaction(transaction, connection)
      await connection.confirmTransaction({
        signature,
        blockhash: (await connection.getLatestBlockhash()).blockhash,
        lastValidBlockHeight: (await connection.getLatestBlockhash()).lastValidBlockHeight,
      }, 'confirmed')
      
      toast.success(
        <div>
          <span className="font-semibold">{voteType} vote cast!</span>
          <a 
            href={`https://solscan.io/tx/${signature}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-xs mt-1 underline"
          >
            View transaction →
          </a>
        </div>,
        { id: toastId, duration: 8000 }
      )
      
      setVoteAmount("")
      await fetchUserTokenBalance()
      
    } catch (error: any) {
      console.error("Vote error:", error)
      const errorMessage = error.message || "Vote failed"
      toast.error(`Vote failed: ${errorMessage}`, { id: toastId })
    } finally {
      setVoting(false)
    }
  }, [publicKey, selectedVoteOption, voteAmount, userTokenBalance, connection, sendTransaction, fetchUserTokenBalance])

  const formatAmount = (amount: bigint): string => {
    const divisor = BigInt(1_000_000_000)
    const whole = amount / divisor
    const fraction = amount % divisor
    return `${whole.toLocaleString()}.${fraction.toString().padStart(9, "0").slice(0, 3)}`
  }

  // Chart data preparation
  const voteChartData = voteResults ? [
    { name: 'YES', value: Number(voteResults.yesVotes), color: '#00FFFF' },
    { name: 'NO', value: Number(voteResults.noVotes), color: '#69A2F1' },
    { name: 'ABSTAIN', value: Number(voteResults.abstainVotes), color: '#2A2B30' }
  ].filter(d => d.value > 0) : []

  const tokenDistributionData = voteResults ? [
    { 
      name: 'CLAIMED', 
      value: ((Number(voteResults.totalClaimed) / Number(voteResults.totalSupply)) * 100), 
      fill: '#00FFFF' 
    },
    { 
      name: 'VOTED', 
      value: voteResults.participationRate, 
      fill: '#69A2F1' 
    },
    { 
      name: 'UNCLAIMED', 
      value: ((Number(voteResults.distributorBalance) / Number(voteResults.totalSupply)) * 100), 
      fill: '#2A2B30' 
    }
  ] : []

  const participationData = voteResults ? [
    { 
      name: 'Claimed', 
      value: Number(voteResults.totalClaimed) / 1e9, 
      fill: '#00FFFF' 
    },
    { 
      name: 'Voted', 
      value: Number(voteResults.totalVotes) / 1e9, 
      fill: '#69A2F1' 
    },
    { 
      name: 'Unclaimed', 
      value: Number(voteResults.distributorBalance) / 1e9, 
      fill: '#2A2B30' 
    }
  ] : []

  // Current epoch and slot state
  const [currentEpoch, setCurrentEpoch] = useState<number | null>(null)
  const [currentSlot, setCurrentSlot] = useState<number | null>(null)
  const [epochInfo, setEpochInfo] = useState<{ slotsInEpoch: number, slotIndex: number } | null>(null)
  const [voteEndTimestamp, setVoteEndTimestamp] = useState<number | null>(null)
  const [currentTime, setCurrentTime] = useState(Date.now())

  // Update current time every second for real-time countdown
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now())
    }, 1000)
    
    return () => clearInterval(interval)
  }, [])

  // Fetch current epoch info and calculate vote end timestamp
  useEffect(() => {
    const fetchEpochInfo = async () => {
      try {
        const info = await connection.getEpochInfo()
        setCurrentEpoch(info.epoch)
        setCurrentSlot(info.absoluteSlot)
        setEpochInfo({
          slotsInEpoch: info.slotsInEpoch,
          slotIndex: info.slotIndex
        })

        // Calculate estimated end time of epoch 842
        const VOTING_END_EPOCH = 842
        const SLOT_TIME_MS = 400
        
        if (info.epoch <= VOTING_END_EPOCH) {
          const epochsRemaining = VOTING_END_EPOCH - info.epoch
          const slotsRemaining = (epochsRemaining * 432000) + (info.slotsInEpoch - info.slotIndex)
          const timeRemainingMs = slotsRemaining * SLOT_TIME_MS
          const estimatedEndTime = Date.now() + timeRemainingMs
          setVoteEndTimestamp(estimatedEndTime)
        }
      } catch (error) {
        console.error("Error fetching epoch info:", error)
      }
    }
    
    fetchEpochInfo()
    const interval = setInterval(fetchEpochInfo, 30000) // Update epoch info every 30 seconds
    return () => clearInterval(interval)
  }, [connection])

  // Voting status calculations
  const calculateTimeRemaining = () => {
    if (!voteEndTimestamp) {
      return "LOADING"
    }

    const VOTING_START_EPOCH = 840
    
    // If voting hasn't started yet
    if (currentEpoch !== null && currentEpoch < VOTING_START_EPOCH) {
      return "NOT STARTED"
    }

    // Calculate time remaining until vote end
    const timeRemaining = voteEndTimestamp - currentTime

    // If time has passed
    if (timeRemaining <= 0) {
      return "ENDED"
    }

    // Format time remaining with real-time precision
    const days = Math.floor(timeRemaining / (1000 * 60 * 60 * 24))
    const hours = Math.floor((timeRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60))
    const seconds = Math.floor((timeRemaining % (1000 * 60)) / 1000)

    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m ${seconds}s`
    } else if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`
    } else {
      return `${seconds}s`
    }
  }

  const votingStatus = voteResults ? {
    participationRate: voteResults.participationRate,
    yesPercentage: Number(voteResults.totalVotes) > 0 ? (Number(voteResults.yesVotes) / Number(voteResults.totalVotes)) * 100 : 0,
    quorumMet: voteResults.participationRate >= 33.33,
    supermajorityMet: Number(voteResults.totalVotes) > 0 ? (Number(voteResults.yesVotes) / Number(voteResults.totalVotes)) >= (2/3) : false,
    votesNeededForQuorum: Math.max(0, Math.ceil((Number(voteResults.totalSupply) * 0.3333) / 1e9) - (Number(voteResults.totalVotes) / 1e9)),
    timeRemaining: calculateTimeRemaining()
  } : null

  const getVoteStatus = () => {
    if (!votingStatus) return { status: "LOADING", subtext: "", color: "text-blueshift-gray-400" }
    
    if (!votingStatus.quorumMet) {
      return { status: "PENDING", subtext: "PENDING QUORUM", color: "text-blueshift-gray-400" }
    }
    
    if (votingStatus.supermajorityMet) {
      return { status: "PASSING", subtext: "", color: "text-blueshift-cyan" }
    } else {
      return { status: "PENDING", subtext: "PENDING SUPERMAJORITY", color: "text-blueshift-blue" }
    }
  }

  const voteStatusInfo = getVoteStatus()

  return (
    <div className="min-h-screen px-4 py-8 bg-gradient-radial from-blueshift-cyan/[0.02] to-blueshift-dark">
      {/* Header */}
      <header className="max-w-7xl mx-auto mb-8">
        <div className="flex items-center justify-between mb-6">
          <img 
            src="/logo.svg" 
            alt="Blueshift Logo" 
            className="h-6 w-auto"
          />
          <WalletMultiButton className="!bg-gradient-to-r !from-blueshift-cyan !to-blueshift-blue !text-blueshift-dark hover:!shadow-lg hover:!shadow-blueshift-cyan/25 !font-mono !font-semibold !rounded-xl !transition-all !duration-200 hover:!scale-105" />
        </div>
        
        <div className="text-left">
          <h1 className="text-3xl font-bold text-white font-mono uppercase mb-2">
            SIMD-0326:Alpenglow
          </h1>
          <div className="flex items-center space-x-4 text-xs">
            <a 
              href="https://github.com/solana-foundation/solana-improvement-documents/pull/326" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center space-x-1 text-gray-400 hover:text-blueshift-cyan font-mono transition-colors"
            >
              <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12c0-6.63-5.37-12-12-12"/>
              </svg>
              <span>View SIMD</span>
            </a>
            <a 
              href="https://forum.solana.com/t/simd-0326-alpenglow-protocol/1234" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center space-x-1 text-gray-400 hover:text-blueshift-cyan font-mono transition-colors"
            >
              <svg className="w-3 h-3 fill-current" x="0" y="0" version="1.1" viewBox="0 0 397.7 311.7">
                <path d="M64.6 237.9a13 13 0 0 1 9.2-3.8h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7a13 13 0 0 1-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1l62.7-62.7z"/>
                <path d="M64.6 3.8C67.1 1.4 70.4 0 73.8 0h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7a13 13 0 0 1-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1L64.6 3.8z"/>
                <path d="M333.1 120.1a13 13 0 0 0-9.2-3.8H6.5c-5.8 0-8.7 7-4.6 11.1l62.7 62.7a13 13 0 0 0 9.2 3.8h317.4c5.8 0 8.7-7 4.6-11.1l-62.7-62.7z"/>
              </svg>
              <span>Forum Discussion</span>
            </a>
          </div>
        </div>
      </header>
      <div className="max-w-7xl mx-auto mb-6">
        <WalletEligibilityChecker merkleData={merkleData} loading={loading} />
      </div>
      {/* Voting Status */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Current Status */}
          <div className="glass-card p-4 text-center flex flex-col relative group" title="Overall vote status - shows if proposal is passing">
            <h3 className="text-sm font-semibold text-white mb-2 font-mono uppercase tracking-wider">Status</h3>
            <div className="mb-2 flex-1 flex items-center justify-center gap-2">
              <span className={`text-xl font-bold font-mono ${voteStatusInfo.color}`}>
                {voteStatusInfo.status}
              </span>
              {votingStatus?.quorumMet && votingStatus?.supermajorityMet && (
                <svg className="w-5 h-5 fill-current text-blueshift-cyan" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </div>
            <p className="text-xs text-blueshift-gray-500 font-mono">
              {voteStatusInfo.subtext || (votingStatus ? `${votingStatus.yesPercentage.toFixed(1)}% VOTED YES` : 'Loading...')}
            </p>
          </div>

          {/* Quorum */}
          <div className="glass-card p-4 text-center flex flex-col relative group" title="Quorum requires at least 33.33% of total token supply to participate in voting">
            <h3 className="text-sm font-semibold text-white mb-2 font-mono uppercase tracking-wider">Quorum</h3>
            <div className="mb-2 flex-1 flex items-center justify-center gap-2">
              <span className={`text-xl font-bold font-mono ${votingStatus?.quorumMet ? 'text-blueshift-cyan' : 'text-blueshift-gray-400'}`}>
                {votingStatus?.quorumMet ? 'ACHIEVED' : 'PENDING'}
              </span>
              {votingStatus?.quorumMet && (
                <svg className="w-5 h-5 fill-current text-blueshift-cyan" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </div>
            <p className="text-xs text-blueshift-gray-500 font-mono">
              {votingStatus ? `${votingStatus.participationRate.toFixed(1)}% PARTICIPATED` : 'Loading...'}
            </p>
          </div>

          {/* Supermajority */}
          <div className="glass-card p-4 text-center flex flex-col relative group" title="Supermajority requires at least 66.67% of participants to vote YES">
            <h3 className="text-sm font-semibold text-white mb-2 font-mono uppercase tracking-wider">Supermajority</h3>
            <div className="mb-2 flex-1 flex items-center justify-center gap-2">
              <span className={`text-xl font-bold font-mono ${votingStatus?.supermajorityMet ? 'text-blueshift-cyan' : 'text-blueshift-gray-400'}`}>
                {votingStatus?.supermajorityMet ? 'ACHIEVED' : 'PENDING'}
              </span>
              {votingStatus?.supermajorityMet && (
                <svg className="w-5 h-5 fill-current text-blueshift-cyan" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </div>
            <p className="text-xs text-blueshift-gray-500 font-mono">
              {votingStatus ? `${votingStatus.yesPercentage.toFixed(1)}% VOTED YES` : 'Loading...'}
            </p>
          </div>

          {/* Time Remaining */}
          <div className="glass-card p-4 text-center flex flex-col relative group" title="Voting deadline - countdown to end of Epoch 842">
            <h3 className="text-sm font-semibold text-white mb-2 font-mono uppercase tracking-wider">Time Left</h3>
            <div className="mb-2 flex-1 flex items-center justify-center">
              <span className="text-xl font-bold font-mono text-white">
                {votingStatus ? votingStatus.timeRemaining : 'TBD'}
              </span>
            </div>
            <p className="text-xs text-blueshift-gray-500 font-mono uppercase">
              UNTIL EPOCH 843
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Vote Results Chart */}
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold text-white mb-4 font-mono uppercase tracking-wider">Vote Distribution</h2>
          {voteChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={voteChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="none"
                >
                  {voteChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number) => formatVoteTokens(BigInt(value))}
                  contentStyle={{ 
                    backgroundColor: '#0A0B0D', 
                    color: '#CDD1DB',
                    border: '1px solid #2A2B30', 
                    borderRadius: '8px',
                    fontFamily: 'JetBrains Mono, monospace'
                  }}
                  labelStyle={{ color: '#CDD1DB' }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-blueshift-gray-500">
              No votes yet
            </div>
          )}
          <div className="mt-4 space-y-2">
            {voteResults && (
              <>
                <div className="flex justify-between text-sm font-mono">
                  <span className="text-blueshift-cyan uppercase tracking-wider">YES</span>
                  <span className="text-blueshift-gray-300">{formatVotePercentage(voteResults.yesVotes, voteResults.totalVotes)}%</span>
                </div>
                <div className="flex justify-between text-sm font-mono">
                  <span className="text-blueshift-blue uppercase tracking-wider">NO</span>
                  <span className="text-blueshift-gray-300">{formatVotePercentage(voteResults.noVotes, voteResults.totalVotes)}%</span>
                </div>
                <div className="flex justify-between text-sm font-mono">
                  <span className="text-blueshift-gray-400 uppercase tracking-wider">ABSTAIN</span>
                  <span className="text-blueshift-gray-300">{formatVotePercentage(voteResults.abstainVotes, voteResults.totalVotes)}%</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Token Distribution */}
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold text-white mb-4 font-mono uppercase tracking-wider">Token Distribution</h2>
          {tokenDistributionData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={tokenDistributionData}>
                <XAxis 
                  dataKey="name" 
                  stroke="#6B6D76" 
                  style={{ fontFamily: 'JetBrains Mono, monospace' }}
                />
                <YAxis 
                  stroke="#6B6D76" 
                  domain={[0, 100]} 
                  style={{ fontFamily: 'JetBrains Mono, monospace' }}
                />
                <Tooltip 
                  cursor={false} 
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div style={{
                          backgroundColor: '#0A0B0D',
                          color: '#CDD1DB',
                          border: '1px solid #2A2B30',
                          borderRadius: '8px',
                          fontFamily: 'JetBrains Mono, monospace',
                          padding: '8px 12px'
                        }}>
                          <div>{label}</div>
                          <div>{payload[0].value.toFixed(1)}%</div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="value" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-blueshift-gray-500">
              Loading data...
            </div>
          )}
          {voteResults && (
            <div className="mt-4 space-y-2">
              <div className="flex justify-between text-sm font-mono">
                <span className="text-blueshift-cyan uppercase tracking-wider">Claimed</span>
                <span className="text-blueshift-gray-300">{((Number(voteResults.totalClaimed) / Number(voteResults.totalSupply)) * 100).toFixed(1)}%</span>
              </div>
              <div className="flex justify-between text-sm font-mono">
                <span className="text-blueshift-blue uppercase tracking-wider">Voted</span>
                <span className="text-blueshift-gray-300">{voteResults.participationRate.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between text-sm font-mono">
                <span className="text-blueshift-gray-400 uppercase tracking-wider">Unclaimed</span>
                <span className="text-blueshift-gray-300">{((Number(voteResults.distributorBalance) / Number(voteResults.totalSupply)) * 100).toFixed(1)}%</span>
              </div>
            </div>
          )}
        </div>

        {/* User Section */}
        {publicKey && (
          <div className="lg:col-span-2 grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Allocation & Balance */}
            <div className="glass-card p-6">
              <h2 className="text-lg font-semibold text-white mb-4 font-mono uppercase tracking-wider">Your Allocation</h2>
              
              {userNode ? (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-blueshift-gray-400 font-mono text-sm uppercase tracking-wider">Current Balance</span>
                    <span className="text-lg font-bold text-blueshift-cyan font-mono">
                      {formatAmount(userTokenBalance)}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-blueshift-gray-400 font-mono text-sm uppercase tracking-wider">Claimed</span>
                    <span className="font-mono text-white text-sm">
                      {hasClaimed ? formatAmount(calculateAmountUnlocked(userNode)) : '0.000'}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-blueshift-gray-400 font-mono text-sm uppercase tracking-wider">Unclaimed</span>
                    <span className="font-mono text-blueshift-gray-500 text-sm">
                      {hasClaimed ? formatAmount(calculateAmountLocked(userNode)) : formatAmount(calculateAmountUnlocked(userNode))}
                    </span>
                  </div>
                  
                  {userVotingPower && (
                    <div className="pt-4 border-t border-blueshift-gray-800">
                      <div className="flex justify-between items-center">
                        <span className="text-blueshift-gray-400 font-mono text-sm uppercase tracking-wider">Voting Power</span>
                        <span className="text-base font-bold text-blueshift-blue font-mono">
                          {userVotingPower.votingPowerPercentage.toFixed(4)}%
                        </span>
                      </div>
                    </div>
                  )}
                  
                  {checkingClaimStatus ? (
                    <div className="flex items-center justify-center py-4">
                      <svg className="animate-spin h-5 w-5 text-blueshift-cyan mr-3" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span className="text-blueshift-gray-400 font-mono">Checking claim status...</span>
                    </div>
                  ) : hasClaimed ? (
                    <div className="glass-card p-4 bg-blueshift-cyan/10 border-blueshift-cyan/30">
                      <div className="flex items-center justify-center space-x-3">
                        <svg className="w-5 h-5 text-blueshift-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-blueshift-cyan font-mono uppercase tracking-wider font-semibold">
                          Tokens Already Claimed
                        </span>
                      </div>
                      <p className="text-blueshift-gray-400 text-center text-sm mt-2 font-mono">
                        Your allocation has been successfully claimed
                      </p>
                    </div>
                  ) : (
                    <button
                      onClick={handleClaim}
                      disabled={claiming}
                      className="w-full btn-primary"
                    >
                      {claiming ? "Claiming..." : "Claim Tokens"}
                    </button>
                  )}
                </div>
              ) : (
                <p className="text-blueshift-gray-500 text-center py-8 font-mono text-sm">
                  No allocation found for this wallet
                </p>
              )}
            </div>

            {/* Voting Interface */}
            <div className="glass-card p-6">
              <h2 className="text-lg font-semibold text-white mb-4 font-mono uppercase tracking-wider">Cast Your Vote</h2>
                
                <div className="space-y-4">
                  {/* Vote Option Switcher */}
                  <div className="space-y-2">
                    <label className="text-white font-mono text-sm uppercase tracking-wider">Vote Option</label>
                    <div className="flex bg-blueshift-gray-800 rounded-lg p-1">
                      <button
                        type="button"
                        onClick={() => setSelectedVoteOption('yes')}
                        className={`flex-1 py-2 px-4 rounded-md text-sm font-mono font-semibold transition-all ${
                          selectedVoteOption === 'yes'
                            ? 'bg-blueshift-cyan text-blueshift-dark'
                            : 'text-blueshift-cyan hover:bg-blueshift-gray-700'
                        }`}
                      >
                        YES
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedVoteOption('no')}
                        className={`flex-1 py-2 px-4 rounded-md text-sm font-mono font-semibold transition-all ${
                          selectedVoteOption === 'no'
                            ? 'bg-blueshift-blue text-white'
                            : 'text-blueshift-blue hover:bg-blueshift-gray-700'
                        }`}
                      >
                        NO
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedVoteOption('abstain')}
                        className={`flex-1 py-2 px-4 rounded-md text-sm font-mono font-semibold transition-all ${
                          selectedVoteOption === 'abstain'
                            ? 'bg-blueshift-gray-400 text-blueshift-dark'
                            : 'text-blueshift-gray-400 hover:bg-blueshift-gray-700'
                        }`}
                      >
                        ABSTAIN
                      </button>
                    </div>
                  </div>

                  {/* Vote Amount */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className={`font-mono text-sm uppercase tracking-wider ${
                        selectedVoteOption === 'yes' ? 'text-blueshift-cyan' :
                        selectedVoteOption === 'no' ? 'text-blueshift-blue' :
                        'text-blueshift-gray-400'
                      }`}>
                        Amount for {selectedVoteOption.toUpperCase()}
                      </label>
                      <div>
                        <span className="text-blueshift-gray-400 font-mono text-xs uppercase tracking-wider">Available: </span>
                        <span className="text-blueshift-cyan font-mono text-xs">
                          {formatAmount(userTokenBalance)}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        step="0.001"
                        value={voteAmount}
                        onChange={(e) => setVoteAmount(e.target.value)}
                        placeholder={`Amount for ${selectedVoteOption.toUpperCase()}`}
                        className="input-dark flex-1 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setVoteAmount((Number(userTokenBalance) / 1_000_000_000).toString())}
                        className={`px-3 py-2 bg-blueshift-gray-800 hover:bg-blueshift-gray-700 text-sm font-mono rounded-lg border border-blueshift-gray-600 transition-colors ${
                          selectedVoteOption === 'yes' ? 'text-blueshift-cyan' :
                          selectedVoteOption === 'no' ? 'text-blueshift-blue' :
                          'text-blueshift-gray-400'
                        }`}
                      >
                        MAX
                      </button>
                    </div>
                  </div>
                  
                  <button
                    onClick={handleVote}
                    disabled={voting || userTokenBalance === BigInt(0) || parseFloat(voteAmount || '0') <= 0}
                    className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {voting ? "Casting Vote..." : userTokenBalance === BigInt(0) ? "No Tokens Available" : `Submit ${selectedVoteOption.toUpperCase()} Vote`}
                  </button>
                  
                  <p className="text-xs text-blueshift-gray-500 text-center">
                    {userTokenBalance === BigInt(0) ? "You need tokens to vote. Claim your allocation above if eligible." : "Votes are permanent and transfer tokens to vote addresses"}
                  </p>
                </div>
              </div>
          </div>
        )}
      </div>
    </div>
  )
}