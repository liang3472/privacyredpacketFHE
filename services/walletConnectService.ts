import { EthereumProvider } from '@walletconnect/ethereum-provider';
import { ethers } from 'ethers';

// Sepolia Testnet Configuration
export const SEPOLIA_CHAIN_ID = 11155111;
export const SEPOLIA_RPC_URL = 'https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161';
export const SEPOLIA_CHAIN_NAME = 'Sepolia';

// WalletConnect Project ID - Get your free project ID from https://cloud.walletconnect.com
// For now, using a placeholder. Replace with your own project ID for production.
const WALLETCONNECT_PROJECT_ID = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'c4f7918c8b8c4c118b5a4a6e8d8f9a0b';

let walletConnectProvider: EthereumProvider | null = null;
let ethersProvider: ethers.BrowserProvider | null = null;

/**
 * Initialize WalletConnect provider
 * Only supports Sepolia testnet
 */
export const initWalletConnect = async (): Promise<EthereumProvider> => {
  if (walletConnectProvider) {
    return walletConnectProvider;
  }

  try {
    walletConnectProvider = await EthereumProvider.init({
      projectId: WALLETCONNECT_PROJECT_ID,
      chains: [SEPOLIA_CHAIN_ID], // Only Sepolia testnet
      optionalChains: [], // No optional chains - only Sepolia
      showQrModal: true,
      metadata: {
        name: 'Privacy Red Packet',
        description: 'Privacy Red Packet DApp - Sepolia Testnet Only',
        url: window.location.origin,
        icons: [`${window.location.origin}/favicon.ico`],
      },
    });

    // Listen for chain changes
    walletConnectProvider.on('chainChanged', (chainId: number) => {
      console.log('Chain changed:', chainId);
      // Check if still on Sepolia
      if (chainId !== SEPOLIA_CHAIN_ID) {
        console.warn(`Network switched to chain ${chainId}. Please switch back to Sepolia (${SEPOLIA_CHAIN_ID})`);
      }
      window.location.reload();
    });

    // Listen for account changes
    walletConnectProvider.on('accountsChanged', (accounts: string[]) => {
      console.log('Accounts changed:', accounts);
      window.location.reload();
    });

    // Listen for disconnect
    walletConnectProvider.on('disconnect', () => {
      console.log('WalletConnect disconnected');
      walletConnectProvider = null;
      ethersProvider = null;
      window.location.reload();
    });

    return walletConnectProvider;
  } catch (error) {
    console.error('Failed to initialize WalletConnect:', error);
    throw error;
  }
};

/**
 * Connect to WalletConnect
 * Only allows connection on Sepolia testnet
 */
export const connectWalletConnect = async (): Promise<{
  address: string;
  chainId: number;
  provider: ethers.BrowserProvider;
}> => {
  try {
    const provider = await initWalletConnect();
    
    // Enable session
    const accounts = await provider.enable();
    
    if (!accounts || accounts.length === 0) {
      throw new Error('No accounts found');
    }

    const chainId = provider.chainId;
    
    // Strictly check if on Sepolia - this app only supports Sepolia testnet
    if (chainId !== SEPOLIA_CHAIN_ID) {
      console.warn(`Connected to wrong network. Chain ID: ${chainId}, Required: ${SEPOLIA_CHAIN_ID} (Sepolia)`);
      throw new Error('WRONG_NETWORK');
    }

    // Create ethers provider from WalletConnect provider
    ethersProvider = new ethers.BrowserProvider(provider as any);
    
    return {
      address: accounts[0],
      chainId,
      provider: ethersProvider,
    };
  } catch (error: any) {
    if (error.message === 'WRONG_NETWORK') {
      throw new Error('WRONG_NETWORK');
    }
    console.error('Failed to connect WalletConnect:', error);
    throw error;
  }
};

/**
 * Switch to Sepolia network via WalletConnect
 * This app only supports Sepolia testnet
 */
export const switchToSepolia = async (): Promise<void> => {
  try {
    const provider = await initWalletConnect();
    
    if (!provider.session) {
      throw new Error('Not connected to WalletConnect. Please connect first.');
    }

    const currentChainId = provider.chainId;
    
    // If already on Sepolia, no need to switch
    if (currentChainId === SEPOLIA_CHAIN_ID) {
      console.log('Already on Sepolia network');
      return;
    }

    // Request to switch chain
    try {
      await provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${SEPOLIA_CHAIN_ID.toString(16)}` }],
      });
    } catch (switchError: any) {
      // If chain doesn't exist, add it
      if (switchError.code === 4902 || switchError.message?.includes('not been added') || switchError.message?.includes('Unrecognized chain')) {
        console.log('Sepolia network not found in wallet, adding it...');
        await addSepoliaNetwork();
      } else {
        throw switchError;
      }
    }
  } catch (error: any) {
    console.error('Failed to switch to Sepolia:', error);
    throw new Error(`Failed to switch to Sepolia testnet: ${error.message || 'Unknown error'}`);
  }
};

/**
 * Add Sepolia network to wallet
 * This app only supports Sepolia testnet
 */
export const addSepoliaNetwork = async (): Promise<void> => {
  try {
    const provider = await initWalletConnect();
    
    if (!provider.session) {
      throw new Error('Not connected to WalletConnect. Please connect first.');
    }

    await provider.request({
      method: 'wallet_addEthereumChain',
      params: [
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
      ],
    });
  } catch (error: any) {
    console.error('Failed to add Sepolia network:', error);
    throw new Error(`Failed to add Sepolia testnet: ${error.message || 'Unknown error'}`);
  }
};

/**
 * Get current chain ID from WalletConnect
 * Returns null if not connected or not on Sepolia
 */
export const getWalletConnectChainId = async (): Promise<number | null> => {
  try {
    const provider = await initWalletConnect();
    if (!provider.session) {
      return null;
    }
    const chainId = provider.chainId;
    // Only return if on Sepolia
    return chainId === SEPOLIA_CHAIN_ID ? chainId : null;
  } catch (error) {
    console.error('Failed to get chain ID:', error);
    return null;
  }
};

/**
 * Check if currently connected to Sepolia testnet
 */
export const isOnSepolia = async (): Promise<boolean> => {
  try {
    const chainId = await getWalletConnectChainId();
    return chainId === SEPOLIA_CHAIN_ID;
  } catch (error) {
    return false;
  }
};

/**
 * Check if WalletConnect is connected
 */
export const isWalletConnectConnected = (): boolean => {
  return walletConnectProvider?.session !== undefined;
};

/**
 * Disconnect WalletConnect
 */
export const disconnectWalletConnect = async (): Promise<void> => {
  try {
    if (walletConnectProvider) {
      await walletConnectProvider.disconnect();
      walletConnectProvider = null;
      ethersProvider = null;
    }
  } catch (error) {
    console.error('Failed to disconnect WalletConnect:', error);
  }
};

/**
 * Get ethers provider from WalletConnect
 */
export const getWalletConnectEthersProvider = (): ethers.BrowserProvider | null => {
  return ethersProvider;
};

