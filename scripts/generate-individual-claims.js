#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { PublicKey } = require('@solana/web3.js');

// Read the merkle tree JSON file
const merkleTreePath = path.join(__dirname, '..', 'public', 'simd326-merkle-tree.json');
const outputDir = path.join(__dirname, '..', 'public', 'simd326');

console.log('Reading merkle tree from:', merkleTreePath);

try {
  // Read and parse the merkle tree data
  const merkleTreeData = JSON.parse(fs.readFileSync(merkleTreePath, 'utf8'));
  
  // Create output directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
    console.log('Created directory:', outputDir);
  }

  console.log(`Processing ${merkleTreeData.tree_nodes.length} tree nodes...`);

  // Process each tree node
  merkleTreeData.tree_nodes.forEach((node, index) => {
    try {
      // Convert claimant byte array to PublicKey and then to base58 string
      const claimantBytes = new Uint8Array(node.claimant);
      const claimantPubkey = new PublicKey(claimantBytes);
      const walletAddress = claimantPubkey.toBase58();
      
      // Create individual claim data
      const claimData = {
        claimant: node.claimant,
        claimant_address: walletAddress,
        proof: node.proof,
        amount_unlocked: node.amount_unlocked,
        amount_locked: node.amount_locked
      };
      
      // Write individual claim file named by wallet address
      const outputFilePath = path.join(outputDir, `${walletAddress}.json`);
      fs.writeFileSync(outputFilePath, JSON.stringify(claimData, null, 2));
      
      if (index % 100 === 0 || index === merkleTreeData.tree_nodes.length - 1) {
        console.log(`Processed ${index + 1}/${merkleTreeData.tree_nodes.length} claims`);
      }
      
    } catch (error) {
      console.error(`Error processing node ${index}:`, error);
    }
  });

  console.log(`\nGenerated ${merkleTreeData.tree_nodes.length} individual claim files in ${outputDir}`);
  
} catch (error) {
  console.error('Error reading or processing merkle tree data:', error);
  process.exit(1);
}