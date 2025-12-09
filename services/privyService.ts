import { ethers } from 'ethers';
import { usePrivy, useWallets } from '@privy-io/react-auth';

// Sepolia Testnet Configuration
export const SEPOLIA_CHAIN_ID = 11155111;
export const SEPOLIA_RPC_URL = 'https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161';
export const SEPOLIA_CHAIN_NAME = 'Sepolia';

/**
 * Get Privy provider and signer
 * This function should be called from within a component that has access to Privy hooks
 */
export const getPrivyProvider = (): ethers.BrowserProvider | null => {
  // This will be called from components that have Privy context
  // The actual provider will be obtained via usePrivy hook
  return null;
};

/**
 * Get Privy signer
 * This function should be called from within a component that has access to Privy hooks
 */
export const getPrivySigner = async (provider: ethers.BrowserProvider): Promise<ethers.Signer | null> => {
  if (!provider) return null;
  return await provider.getSigner();
};

/**
 * Check if currently connected to Sepolia testnet
 */
export const isOnSepolia = (chainId: number | string): boolean => {
  const chainIdNum = typeof chainId === 'string' ? parseInt(chainId, 16) : chainId;
  return chainIdNum === SEPOLIA_CHAIN_ID;
};

/**
 * Switch to Sepolia network via Privy
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
            chainName: SEPOLIA_CHAIN_NAME,
            nativeCurrency: {
              name: 'Ether',
              symbol: 'ETH',
              decimals: 18,
            },
            rpcUrls: [SEPOLIA_RPC_URL],
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

