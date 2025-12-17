import { ethers } from 'ethers';
import { RedPacket, PacketType, ClaimRecord, UserWallet } from '../types';
import { getConfiguredAddresses } from '../config/addresses';
import { SEPOLIA_CHAIN_ID } from './privyService';

declare global {
  interface Window {
    ethereum: any;
  }
}

// ==========================================
// CONFIGURATION
// ==========================================
const { contract: CONTRACT_ADDRESS, token: TOKEN_ADDRESS } = getConfiguredAddresses();
const isOnChainConfigured = CONTRACT_ADDRESS !== "0x0000000000000000000000000000000000000000";

// Import full ABI from compiled contract artifact
// Using contracts directory for better compatibility with Vercel builds
// @ts-ignore - JSON import is handled by Vite
import contractArtifact from '../contracts/PrivacyRedPacket.json';

const CONTRACT_ABI = contractArtifact.abi;

const TOKEN_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)"
];

// ==========================================
// FHEVM SETUP
// ==========================================
let _fhevmInstance: any = null;

/**
 * Check if current network is Sepolia
 * This app only supports Sepolia testnet
 */
export const checkNetwork = async (provider: ethers.BrowserProvider): Promise<{ isSepolia: boolean; chainId: number; chainName?: string }> => {
  try {
    const network = await provider.getNetwork();
    const chainId = Number(network.chainId);
    const isSepolia = chainId === SEPOLIA_CHAIN_ID;
    
    // Get chain name for better error messages
    let chainName = 'Unknown';
    if (chainId === 1) chainName = 'Ethereum Mainnet';
    else if (chainId === 11155111) chainName = 'Sepolia Testnet';
    else if (chainId === 5) chainName = 'Goerli Testnet';
    else if (chainId === 137) chainName = 'Polygon';
    else chainName = `Chain ${chainId}`;
    
    return {
      isSepolia,
      chainId,
      chainName,
    };
  } catch (error) {
    console.error('Error checking network:', error);
    return { isSepolia: false, chainId: 0, chainName: 'Unknown' };
  }
};

/**
 * Switch to Sepolia network via provider
 * This app only supports Sepolia testnet
 */
export const switchToSepolia = async (provider: ethers.BrowserProvider): Promise<void> => {
  try {
    const network = await provider.getNetwork();
    const currentChainId = Number(network.chainId);
    
    // If already on Sepolia, no need to switch
    if (currentChainId === SEPOLIA_CHAIN_ID) {
      console.log('Already on Sepolia network');
      return;
    }

    // Request to switch chain
    try {
      await provider.send('wallet_switchEthereumChain', [
        { chainId: `0x${SEPOLIA_CHAIN_ID.toString(16)}` }
      ]);
    } catch (switchError: any) {
      // If chain doesn't exist, add it
      if (switchError.code === 4902 || switchError.message?.includes('not been added') || switchError.message?.includes('Unrecognized chain')) {
        console.log('Sepolia network not found in wallet, adding it...');
        await provider.send('wallet_addEthereumChain', [
          {
            chainId: `0x${SEPOLIA_CHAIN_ID.toString(16)}`,
            chainName: 'Sepolia',
            nativeCurrency: {
              name: 'Ether',
              symbol: 'ETH',
              decimals: 18,
            },
            rpcUrls: ['https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161'],
            blockExplorerUrls: ['https://sepolia.etherscan.io'],
          },
        ]);
      } else {
        throw switchError;
      }
    }
  } catch (error: any) {
    console.error('Failed to switch to Sepolia:', error);
    throw new Error(`Failed to switch to Sepolia testnet: ${error.message || 'Unknown error'}`);
  }
};

const getFhevmInstance = async (provider: ethers.BrowserProvider) => {
  if (_fhevmInstance) return _fhevmInstance;
  
  if (!provider) throw new Error("No provider");
  
  const network = await provider.getNetwork();
  const chainId = Number(network.chainId);
  
  // Initialize FHEVM instance
  // Use dynamic import to prevent app crash if WASM fails to load on startup
  try {
    const { createInstance, getPublicKeyCallParams } = await import('fhevmjs');
    
    // Create instance without public key initially
    // The public key will be generated when needed via generatePublicKey
    _fhevmInstance = await createInstance({ chainId });
  } catch (e) {
    console.warn("Failed to init FHEVM. Ensure you are on a Zama-supported network.", e);
    return null;
  }
  return _fhevmInstance;
};

// ==========================================
// SERVICE METHODS
// ==========================================

// Check wallet status using Privy provider
export const checkWalletStatus = async (provider: ethers.BrowserProvider | null, address: string | null): Promise<UserWallet> => {
  if (!provider || !address) {
    return { address: '', balance: 0, isConnected: false };
  }
  
  try {
    const balance = parseFloat(ethers.formatEther(await provider.getBalance(address)));
    
    // Check network - this app only supports Sepolia testnet
    const networkCheck = await checkNetwork(provider);
    if (!networkCheck.isSepolia) {
      return { 
        address, 
        balance, 
        isConnected: true, 
        needsNetworkSwitch: true, 
        chainId: networkCheck.chainId,
        connectionType: 'metamask' // Privy uses 'metamask' as connection type
      };
    }
    
    return {
      address,
      balance,
      isConnected: true,
      connectionType: 'metamask'
    };
  } catch (e) {
    console.error("Error checking wallet status:", e);
    return { address: '', balance: 0, isConnected: false };
  }
};

// This function is no longer needed as Privy handles connection
// Keeping for backward compatibility but it should not be called
export const connectWallet = async (): Promise<UserWallet> => {
  console.warn('connectWallet is deprecated. Use Privy hooks directly.');
  return { address: '', balance: 0, isConnected: false };
};

export const getPackets = async (provider: ethers.BrowserProvider): Promise<RedPacket[]> => {
  if (!isOnChainConfigured) {
    throw new Error("Contract address not configured. Please set up the contract address.");
  }

  if (!provider) {
    throw new Error("Provider is required");
  }

  try {

    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
    
    const filter = contract.filters.PacketCreated();
    // Query all historical events to ensure we get all packets, including expired but unclaimed ones
    const events = await contract.queryFilter(filter);

    const packets: RedPacket[] = await Promise.all(events.map(async (event: any) => {
      const { id, creator, packetType, totalQuantity, message, expiresAt } = event.args;
      
      let remainingQuantity = 0;
      let totalAmount = 0;
      let remainingAmount = 0;
      
      try {
          const status = await contract.getPacketStatus(id);
          remainingQuantity = Number(status.remainingQty);
      } catch (e) {
          remainingQuantity = Number(totalQuantity);
      }

      // Get packet summary to get actual amounts
      let refunded = false;
      try {
          const summary = await contract.packetSummary(id);
          totalAmount = parseFloat(ethers.formatEther(summary.totalAmount));
          remainingAmount = parseFloat(ethers.formatEther(summary.remainingAmount));
          refunded = summary.refunded;
      } catch (e) {
          // If packetSummary fails, try to get amount from creation transaction
          console.warn(`Failed to get packet summary for ${id.toString()}:`, e);
          // Fallback: try to get amount from the creation transaction
          try {
              const tx = await provider.getTransaction(event.transactionHash);
              if (tx && tx.value) {
                  totalAmount = parseFloat(ethers.formatEther(tx.value));
                  remainingAmount = totalAmount; // Initial remaining is same as total
              }
          } catch (txError) {
              console.warn(`Failed to get transaction value for ${id.toString()}:`, txError);
          }
      }

      return {
        id: id.toString(),
        creator,
        type: Number(packetType) === 0 ? PacketType.RANDOM : PacketType.AVERAGE,
        tokenSymbol: 'ETH', 
        totalAmount, 
        remainingAmount, 
        totalQuantity: Number(totalQuantity),
        remainingQuantity: remainingQuantity,
        createdAt: Date.now(), 
        expiresAt: Number(expiresAt) * 1000,
        message,
        isEncrypted: true,
        refunded,
      };
    }));

    return packets.reverse();
  } catch (e) {
    console.error("Error fetching packets:", e);
    throw e;
  }
};

export const createPacket = async (
  packet: Omit<RedPacket, 'id' | 'remainingAmount' | 'remainingQuantity' | 'createdAt'> & { password?: string },
  provider: ethers.BrowserProvider,
  signer: ethers.Signer
) => {
  if (!isOnChainConfigured) {
    throw new Error("Contract address not configured. Please set up the contract address.");
  }

  if (!provider || !signer) {
    throw new Error("Provider and signer are required");
  }

  if (!packet.password) {
    throw new Error("Password required");
  }

  const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
  const token = new ethers.Contract(TOKEN_ADDRESS, TOKEN_ABI, signer);
  const instance = await getFhevmInstance(provider);

  if (!instance) {
    throw new Error("FHEVM not initialized. Are you on the correct network?");
  }

  const amountWei = ethers.parseEther(packet.totalAmount.toString());
  // await (await token.approve(CONTRACT_ADDRESS, amountWei)).wait();

  // Encrypt Password - convert string to BigInt via bytes
  const passwordBytes = ethers.toUtf8Bytes(packet.password);
  const passwordBigInt = BigInt(ethers.hexlify(passwordBytes));
  
    // First, try to get existing public key from the instance
    let publicKeyData = instance.getPublicKey(CONTRACT_ADDRESS);
    let signature: string;
    
    // If no public key exists, generate it
    if (!publicKeyData) {
      // Generate token - this will create a public key and EIP712 signature
      // Note: If contract doesn't support getPublicKey, we skip that step
      const { publicKey, eip712 } = await instance.generatePublicKey({
        verifyingContract: CONTRACT_ADDRESS,
        chainId: Number((await provider.getNetwork()).chainId)
      });
    
    // Sign the EIP712 message to create the proof
    // ethers v6: EIP712Domain should NOT be in types, only in domain
    const domain = {
      name: eip712.domain.name,
      version: eip712.domain.version,
      chainId: eip712.domain.chainId,
      verifyingContract: eip712.domain.verifyingContract
    };
    
    // Only include the primary type (e.g., "Reencrypt"), NOT EIP712Domain
    // EIP712Domain is automatically handled by ethers v6 via the domain parameter
    const filteredTypes: Record<string, any[]> = {};
    
    // Only include the primary type, exclude EIP712Domain
    if (eip712.primaryType && eip712.types[eip712.primaryType]) {
      filteredTypes[eip712.primaryType] = eip712.types[eip712.primaryType];
    } else {
      throw new Error(`Primary type "${eip712.primaryType}" not found in eip712.types`);
    }
    
    signature = await signer.signTypedData(
      domain,
      filteredTypes,
      eip712.message
    );
    
    // Set the signature in the instance so it can use the public key
    instance.setSignature(CONTRACT_ADDRESS, signature);
  } else {
    signature = publicKeyData.signature;
  }
  
  // Try to encrypt the password using FHE
  // If FHE is not available, fall back to using hash (contract supports both)
  let encryptedDataHex: string;
  let inputProofHex: string;
  
  // Check if FHE is available and try to use it
  let useFHE = false;
  if (instance.hasKeypair(CONTRACT_ADDRESS)) {
    try {
      const encryptedData = instance.encrypt64(passwordBigInt);
      encryptedDataHex = ethers.hexlify(encryptedData);
      inputProofHex = signature; // Use the EIP712 signature as proof
      useFHE = true;
    } catch (e: any) {
      // FHE encryption failed, will fall back to hash
      console.warn("FHE encryption not available, using hash fallback:", e.message);
      useFHE = false;
    }
  }
  
  // Fallback to hash if FHE is not available
  if (!useFHE) {
    // Use keccak256 hash of the password (contract will verify using this)
    const passwordHash = ethers.keccak256(passwordBytes);
    encryptedDataHex = passwordHash;
    // For non-FHE, we can use empty bytes or a simple signature as proof
    inputProofHex = '0x';
  }

  const tx = await contract.createPacket(
    packet.type === PacketType.RANDOM ? 0 : 1,
    amountWei,
    packet.totalQuantity,
    encryptedDataHex,
    inputProofHex,
    packet.message,
    { value: amountWei }
  );
  
  const receipt = await tx.wait();
  
  // Extract packet ID from PacketCreated event
  let packetId: string | null = null;
  if (receipt && receipt.logs) {
    const eventInterface = contract.interface;
    for (const log of receipt.logs) {
      try {
        const parsedLog = eventInterface.parseLog(log);
        if (parsedLog && parsedLog.name === 'PacketCreated') {
          packetId = parsedLog.args.id.toString();
          break;
        }
      } catch (e) {
        // Not the event we're looking for, continue
      }
    }
  }
  
  return { tx, packetId };
};

export const claimPacket = async (
  packetId: string,
  address: string,
  password: string,
  provider: ethers.BrowserProvider,
  signer: ethers.Signer
): Promise<{ success: boolean; amount: number; message?: string; remainingAttempts?: number; cooldown?: number }> => {
  if (!isOnChainConfigured) {
    return { success: false, amount: 0, message: "Contract address not configured. Please set up the contract address." };
  }

  if (!provider || !signer) {
    return { success: false, amount: 0, message: "Provider and signer are required" };
  }

  try {
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
    const instance = await getFhevmInstance(provider);

    if (!instance) {
      return { success: false, amount: 0, message: "FHEVM not initialized. Are you on the correct network?" };
    }

    // Encrypt Password - convert string to BigInt via bytes
    const passwordBytes = ethers.toUtf8Bytes(password);
    const passwordBigInt = BigInt(ethers.hexlify(passwordBytes));
    
    // Generate public key and EIP712 signature for the contract
    const network = await provider.getNetwork();
    const { publicKey, eip712 } = await instance.generatePublicKey({
      verifyingContract: CONTRACT_ADDRESS,
      chainId: Number(network.chainId)
    });
    
    // Sign the EIP712 message to create the proof
    // ethers v6: EIP712Domain should NOT be in types, only in domain
    const domain = {
      name: eip712.domain.name,
      version: eip712.domain.version,
      chainId: eip712.domain.chainId,
      verifyingContract: eip712.domain.verifyingContract
    };
    
    // Only include the primary type (e.g., "Reencrypt"), NOT EIP712Domain
    // EIP712Domain is automatically handled by ethers v6 via the domain parameter
    const filteredTypes: Record<string, any[]> = {};
    
    // Only include the primary type, exclude EIP712Domain
    if (eip712.primaryType && eip712.types[eip712.primaryType]) {
      filteredTypes[eip712.primaryType] = eip712.types[eip712.primaryType];
    } else {
      return { success: false, amount: 0, message: `Primary type "${eip712.primaryType}" not found in eip712.types` };
    }
    
    const signature = await signer.signTypedData(
      domain,
      filteredTypes,
      eip712.message
    );
    
    // Set the signature in the instance so it can use the public key
    instance.setSignature(CONTRACT_ADDRESS, signature);
    
    // Try to encrypt the password using FHE, fall back to hash if not available
    let encryptedDataHex: string;
    let inputProofHex: string;
    
    let useFHE = false;
    if (instance.hasKeypair(CONTRACT_ADDRESS)) {
      try {
        const encryptedData = instance.encrypt64(passwordBigInt);
        encryptedDataHex = ethers.hexlify(encryptedData);
        inputProofHex = signature;
        useFHE = true;
      } catch (e: any) {
        // FHE encryption failed, will fall back to hash
        console.warn("FHE encryption not available, using hash fallback:", e.message);
        useFHE = false;
      }
    }
    
    // Fallback to hash if FHE is not available
    if (!useFHE) {
      // Use keccak256 hash of the password (contract will verify using this)
      const passwordHash = ethers.keccak256(passwordBytes);
      encryptedDataHex = passwordHash;
      // Use signature as proof even in non-FHE mode to satisfy contract requirement
      inputProofHex = signature;
    }

    // Get balance before claim to calculate the amount received
    const balanceBefore = await provider.getBalance(address);
    
    // Convert packetId from string to BigInt for contract call
    const packetIdBigInt = BigInt(packetId);
    
    const tx = await contract.claimPacket(
      packetIdBigInt,
      encryptedDataHex,
      inputProofHex
    );
    
    const receipt = await tx.wait();
    
    // Get balance after claim to calculate the amount received
    const balanceAfter = await provider.getBalance(address);
    
    // Calculate the amount received (considering gas fees)
    // The actual amount received = (balanceAfter - balanceBefore) + gasUsed * gasPrice
    const gasUsed: bigint = receipt.gasUsed || 0n;
    const gasPrice: bigint = receipt.gasPrice || 0n;
    const gasCost: bigint = gasUsed * gasPrice;
    const balanceDiff: bigint = balanceAfter - balanceBefore;
    const amountReceived: bigint = balanceDiff + gasCost; // Add gas cost back since it was deducted
    
    // Convert from Wei to Ether
    const amountInEther = parseFloat(ethers.formatEther(amountReceived));
    
    return { success: true, amount: amountInEther, message: 'Claimed successfully!' };

  } catch (e: any) {
    console.error(e);
    return { success: false, amount: 0, message: e.reason || e.message || "Claim failed" };
  }
};

export const checkUserClaimed = async (packetId: string, userAddress: string, provider: ethers.BrowserProvider): Promise<boolean> => {
  if (!isOnChainConfigured) {
    return false;
  }

  if (!provider) {
    return false;
  }

  try {

    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
    // Convert packetId from string to BigInt for contract call
    const packetIdBigInt = BigInt(packetId);
    const hasClaimed = await contract.hasClaimed(packetIdBigInt, userAddress);
    return hasClaimed;
  } catch (e) {
    console.error("Error checking if user claimed:", e);
    return false;
  }
};

export const getUserHistory = async (address: string, provider: ethers.BrowserProvider): Promise<{ created: RedPacket[], claimed: ClaimRecord[] }> => {
   if (!isOnChainConfigured) {
     throw new Error("Contract address not configured. Please set up the contract address.");
   }

   if (!provider) {
     throw new Error("Provider is required");
   }

   const allPackets = await getPackets(provider);
   const created = allPackets.filter(p => p.creator.toLowerCase() === address.toLowerCase());

   const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
   const filter = contract.filters.PacketClaimed(null, address);
   const events = await contract.queryFilter(filter);

   console.log(events)
   
   // Process events to get actual amounts from transaction receipts
   const claimed: ClaimRecord[] = await Promise.all(
     events.map(async (e: any) => {
       try {
         const packetId = e.args.id.toString();
         const packet = allPackets.find(p => p.id === packetId);
         
         // Get transaction receipt to calculate amount
         const receipt = await provider.getTransactionReceipt(e.transactionHash);
         if (!receipt) {
           // Fallback: use average amount if packet is found and is average type
           if (packet && packet.type === PacketType.AVERAGE) {
             return {
               packetId,
               claimer: e.args.claimer,
               amount: packet.totalAmount / packet.totalQuantity,
               claimedAt: (receipt?.blockNumber ? (await provider.getBlock(receipt.blockNumber))?.timestamp * 1000 : Date.now()) || Date.now()
             };
           }
           return {
             packetId,
             claimer: e.args.claimer,
             amount: 0,
             claimedAt: Date.now()
           };
         }

         // Get block numbers for balance calculation
         const blockNumber = receipt.blockNumber;
         const blockBefore = blockNumber > 0 ? blockNumber - 1 : blockNumber;
         
         // Get balances before and after the transaction
         const balanceBefore = await provider.getBalance(address, blockBefore);
         const balanceAfter = await provider.getBalance(address, blockNumber);
         
         // Calculate gas cost
         const gasUsed = receipt.gasUsed || 0n;
         const gasPrice = receipt.gasPrice || 0n;
         const gasCost = gasUsed * gasPrice;
         
         // Calculate amount received: (balanceAfter - balanceBefore) + gasCost
         // (gasCost is added back because it was deducted from balance)
         const balanceDiff = balanceAfter - balanceBefore;
         const amountReceived = balanceDiff + gasCost;
         
         // Convert from Wei to Ether
         const amountInEther = parseFloat(ethers.formatEther(amountReceived));
         
         // Get block timestamp for claimedAt
         const block = await provider.getBlock(blockNumber);
         const claimedAt = block?.timestamp ? block.timestamp * 1000 : Date.now();
         
         return {
           packetId,
           claimer: e.args.claimer,
           amount: amountInEther,
           claimedAt
         };
       } catch (error) {
         console.error(`Error processing claim event for packet ${e.args.id.toString()}:`, error);
         // Fallback: try to use packet info if available
         const packetId = e.args.id.toString();
         const packet = allPackets.find(p => p.id === packetId);
         if (packet && packet.type === PacketType.AVERAGE) {
           return {
             packetId,
             claimer: e.args.claimer,
             amount: packet.totalAmount / packet.totalQuantity,
             claimedAt: Date.now()
           };
         }
         return {
           packetId,
           claimer: e.args.claimer,
           amount: 0,
           claimedAt: Date.now()
         };
       }
     })
   );

   return { created, claimed };
};

export const refundExpiredPacket = async (
  packetId: string,
  provider: ethers.BrowserProvider,
  signer: ethers.Signer
): Promise<{ success: boolean; message?: string; amount?: number }> => {
  if (!isOnChainConfigured) {
    return { success: false, message: "Contract address not configured. Please set up the contract address." };
  }

  if (!provider || !signer) {
    return { success: false, message: "Provider and signer are required" };
  }

  try {
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
    
    // Get balance before refund to calculate the amount received
    const signerAddress = await signer.getAddress();
    const balanceBefore = await provider.getBalance(signerAddress);
    
    // Convert packetId from string to BigInt for contract call
    const packetIdBigInt = BigInt(packetId);
    
    // Call refundExpired function
    const tx = await contract.refundExpired(packetIdBigInt);
    const receipt = await tx.wait();
    
    // Get balance after refund to calculate the amount received
    const balanceAfter = await provider.getBalance(signerAddress);
    
    // Calculate the amount received (considering gas fees)
    const gasUsed: bigint = receipt.gasUsed || 0n;
    const gasPrice: bigint = receipt.gasPrice || 0n;
    const gasCost: bigint = gasUsed * gasPrice;
    const balanceDiff: bigint = balanceAfter - balanceBefore;
    const amountReceived: bigint = balanceDiff + gasCost; // Add gas cost back since it was deducted
    
    // Convert from Wei to Ether
    const amountInEther = parseFloat(ethers.formatEther(amountReceived));
    
    return { success: true, amount: amountInEther, message: 'Refund successful!' };
  } catch (e: any) {
    console.error(e);
    return { success: false, message: e.reason || e.message || "Refund failed" };
  }
};