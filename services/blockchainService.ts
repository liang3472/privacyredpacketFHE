import { ethers } from 'ethers';
import { RedPacket, PacketType, ClaimRecord, UserWallet } from '../types';
import { getConfiguredAddresses } from '../config/addresses';

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
let _signer: ethers.Signer | null = null;
let _provider: ethers.BrowserProvider | null = null;


const getProvider = () => {
  if (!_provider && window.ethereum) {
    _provider = new ethers.BrowserProvider(window.ethereum);
  }
  return _provider;
};

const getSigner = async () => {
  const provider = getProvider();
  if (provider) {
    _signer = await provider.getSigner();
    return _signer;
  }
  throw new Error("No wallet provider");
};

const getFhevmInstance = async () => {
  if (_fhevmInstance) return _fhevmInstance;
  
  const provider = getProvider();
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

export const connectWallet = async (): Promise<UserWallet> => {
  if (!window.ethereum) {
    alert("Please install MetaMask!");
    return { address: '', balance: 0, isConnected: false };
  }
  
  try {
    const provider = getProvider();
    await provider?.send("eth_requestAccounts", []);
    const signer = await getSigner();
    const address = await signer.getAddress();
    const balance = parseFloat(ethers.formatEther(await provider!.getBalance(address)));
    
    return {
      address,
      balance,
      isConnected: true
    };
  } catch (e) {
    console.error(e);
    return { address: '', balance: 0, isConnected: false };
  }
};

export const getPackets = async (): Promise<RedPacket[]> => {
  if (!isOnChainConfigured) {
    throw new Error("Contract address not configured. Please set up the contract address.");
  }

  if (!window.ethereum) {
    throw new Error("Please install MetaMask or another Web3 wallet.");
  }

  try {
    const provider = getProvider();
    if (!provider) {
      throw new Error("Failed to get provider");
    }

    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
    
    const filter = contract.filters.PacketCreated();
    const events = await contract.queryFilter(filter, -10000); // Last 10k blocks

    const packets: RedPacket[] = await Promise.all(events.map(async (event: any) => {
      const { id, creator, packetType, totalQuantity, message, expiresAt } = event.args;
      
      let remainingQuantity = 0;
      try {
          const status = await contract.getPacketStatus(id);
          remainingQuantity = Number(status.remainingQty);
      } catch (e) {
          remainingQuantity = Number(totalQuantity);
      }

      return {
        id: id.toString(),
        creator,
        type: Number(packetType) === 0 ? PacketType.RANDOM : PacketType.AVERAGE,
        tokenSymbol: 'ZAMA', 
        totalAmount: 0, 
        remainingAmount: 0, 
        totalQuantity: Number(totalQuantity),
        remainingQuantity: remainingQuantity,
        createdAt: Date.now(), 
        expiresAt: Number(expiresAt) * 1000,
        message,
        isEncrypted: true,
      };
    }));

    return packets.reverse();
  } catch (e) {
    console.error("Error fetching packets:", e);
    throw e;
  }
};

export const createPacket = async (packet: Omit<RedPacket, 'id' | 'remainingAmount' | 'remainingQuantity' | 'createdAt'> & { password?: string }) => {
  if (!isOnChainConfigured) {
    throw new Error("Contract address not configured. Please set up the contract address.");
  }

  if (!window.ethereum) {
    throw new Error("Please install MetaMask or another Web3 wallet.");
  }

  if (!packet.password) {
    throw new Error("Password required");
  }

  const signer = await getSigner();
  const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
  const token = new ethers.Contract(TOKEN_ADDRESS, TOKEN_ABI, signer);
  const instance = await getFhevmInstance();

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
    const provider = getProvider();
    if (!provider) throw new Error("No provider");
    
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
  
  await tx.wait();
  return tx;
};

export const claimPacket = async (packetId: string, address: string, password: string): Promise<{ success: boolean; amount: number; message?: string; remainingAttempts?: number; cooldown?: number }> => {
  if (!isOnChainConfigured) {
    return { success: false, amount: 0, message: "Contract address not configured. Please set up the contract address." };
  }

  if (!window.ethereum) {
    return { success: false, amount: 0, message: "Please install MetaMask or another Web3 wallet." };
  }

  try {
    const signer = await getSigner();
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
    const instance = await getFhevmInstance();

    if (!instance) {
      return { success: false, amount: 0, message: "FHEVM not initialized. Are you on the correct network?" };
    }

    // Encrypt Password - convert string to BigInt via bytes
    const passwordBytes = ethers.toUtf8Bytes(password);
    const passwordBigInt = BigInt(ethers.hexlify(passwordBytes));
    
    // Generate public key and EIP712 signature for the contract
    const provider = getProvider();
    if (!provider) {
      return { success: false, amount: 0, message: 'Failed to get provider' };
    }
    
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
    
    const tx = await contract.claimPacket(
      packetId,
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

export const getUserHistory = async (address: string): Promise<{ created: RedPacket[], claimed: ClaimRecord[] }> => {
   if (!isOnChainConfigured) {
     throw new Error("Contract address not configured. Please set up the contract address.");
   }

   if (!window.ethereum) {
     throw new Error("Please install MetaMask or another Web3 wallet.");
   }

   const allPackets = await getPackets();
   const created = allPackets.filter(p => p.creator.toLowerCase() === address.toLowerCase());
   
   const provider = getProvider();
   if (!provider) {
     return { created, claimed: [] };
   }

   const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
   const filter = contract.filters.PacketClaimed(null, address);
   const events = await contract.queryFilter(filter);
   
   const claimed: ClaimRecord[] = events.map((e: any) => ({
       packetId: e.args.id.toString(),
       claimer: e.args.claimer,
       amount: 0, 
       claimedAt: Date.now() 
   }));

   return { created, claimed };
};