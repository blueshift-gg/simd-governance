"use client"

import { useState } from "react"
import { PublicKey } from "@solana/web3.js"
import { MerkleTreeData, TreeNode, findNodeForAddress, calculateAmountUnlocked, calculateAmountLocked } from "@/lib/merkle-tree"

interface EligibilityResult {
  eligible: boolean
  unlockedAmount?: bigint
  lockedAmount?: bigint
  totalAmount?: bigint
  error?: string
}

interface WalletEligibilityCheckerProps {
  merkleData: MerkleTreeData | null
  loading: boolean
}

export default function WalletEligibilityChecker({ merkleData, loading }: WalletEligibilityCheckerProps) {
  const [walletAddress, setWalletAddress] = useState("")
  const [checking, setChecking] = useState(false)
  const [result, setResult] = useState<EligibilityResult | null>(null)

  const formatAmount = (amount: bigint): string => {
    return (Number(amount) / 1_000_000_000).toLocaleString(undefined, {
      minimumFractionDigits: 3,
      maximumFractionDigits: 3
    })
  }

  const validateWalletAddress = (address: string): string | null => {
    if (!address.trim()) {
      return "Please enter a wallet address"
    }

    if (address.length < 32 || address.length > 44) {
      return "Invalid wallet address length"
    }

    try {
      new PublicKey(address.trim())
      return null
    } catch {
      return "Invalid wallet address format"
    }
  }

  const checkEligibility = async () => {
    const trimmedAddress = walletAddress.trim()
    
    const validationError = validateWalletAddress(trimmedAddress)
    if (validationError) {
      setResult({ eligible: false, error: validationError })
      return
    }

    if (!merkleData) {
      setResult({ eligible: false, error: "SolGov merkle tree data not loaded" })
      return
    }

    setChecking(true)
    setResult(null)

    try {
      const pubkey = new PublicKey(trimmedAddress)
      const node = findNodeForAddress(merkleData, pubkey)
      
      if (node) {
        const unlocked = calculateAmountUnlocked(node)
        const locked = calculateAmountLocked(node)
        const total = unlocked + locked
        
        setResult({
          eligible: true,
          unlockedAmount: unlocked,
          lockedAmount: locked,
          totalAmount: total
        })
      } else {
        setResult({ eligible: false })
      }
    } catch (error) {
      setResult({ eligible: false, error: "Failed to check SolGov eligibility" })
    } finally {
      setChecking(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setWalletAddress(e.target.value)
    if (result) {
      setResult(null)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !checking && !loading) {
      checkEligibility()
    }
  }

  const clearResult = () => {
    setWalletAddress("")
    setResult(null)
  }

  return (
    <div className="glass-card p-6 mb-6">
      <h2 className="text-lg font-semibold text-white mb-4 font-mono uppercase tracking-wider">
        Check Wallet Eligibility
      </h2>
      
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <input
              type="text"
              value={walletAddress}
              onChange={handleInputChange}
              onKeyPress={handleKeyPress}
              placeholder="Enter wallet address to check SolGov eligibility..."
              className="w-full px-4 py-3 bg-blueshift-gray-800 border border-blueshift-gray-700 rounded-lg text-white font-mono text-sm placeholder-blueshift-gray-500 focus:outline-none focus:ring-2 focus:ring-blueshift-cyan focus:border-transparent"
              disabled={checking || loading}
            />
          </div>
          
          <button
            onClick={checkEligibility}
            disabled={checking || loading || !walletAddress.trim()}
            className="px-6 py-3 bg-blueshift-cyan text-blueshift-dark font-mono font-semibold rounded-lg hover:bg-blueshift-blue transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {checking ? "Checking..." : "Check"}
          </button>
        </div>

        {result && (
          <div className="mt-4">
            {result.error ? (
              <div className="glass-card p-4 bg-red-500/10 border-red-500/30">
                <div className="flex items-center space-x-2">
                  <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  <span className="text-red-400 font-mono text-sm">{result.error}</span>
                </div>
              </div>
            ) : result.eligible ? (
              <div className="glass-card p-4 bg-blueshift-cyan/10 border-blueshift-cyan/30">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <svg className="w-5 h-5 text-blueshift-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-blueshift-cyan font-mono font-semibold uppercase tracking-wider">
                      Eligible for SolGov Tokens
                    </span>
                  </div>
                  <button
                    onClick={clearResult}
                    className="text-blueshift-gray-400 hover:text-white transition-colors"
                    title="Clear result"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-blueshift-gray-400 font-mono text-sm">Total SolGov Allocation</span>
                    <span className="text-blueshift-cyan font-mono font-bold">
                      {formatAmount(result.totalAmount!)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-blueshift-gray-400 font-mono text-sm">Unlocked</span>
                    <span className="text-white font-mono">
                      {formatAmount(result.unlockedAmount!)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-blueshift-gray-400 font-mono text-sm">Locked</span>
                    <span className="text-blueshift-gray-500 font-mono">
                      {formatAmount(result.lockedAmount!)}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="glass-card p-4 bg-blueshift-gray-800/50 border-blueshift-gray-700">
                <div className="flex items-center space-x-2">
                  <svg className="w-5 h-5 text-blueshift-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-blueshift-gray-400 font-mono text-sm">
                    This wallet is not eligible for SolGov tokens
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {loading && (
          <div className="text-center py-2">
            <span className="text-blueshift-gray-400 font-mono text-sm">
              Loading SolGov merkle tree data...
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
