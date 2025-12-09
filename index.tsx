import React from 'react';
import ReactDOM from 'react-dom/client';
import { PrivyProvider } from '@privy-io/react-auth';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// Get Privy App ID from environment variable or use a default
const PRIVY_APP_ID = import.meta.env.VITE_PRIVY_APP_ID || '';

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        loginMethods: ['wallet', 'email', 'sms', 'google', 'twitter', 'github', 'discord'],
        appearance: {
          theme: 'light',
          accentColor: '#ef4444',
        },
        embeddedWallets: {
          createOnLogin: 'users-without-wallets',
        },
        defaultChain: {
          id: 11155111, // Sepolia
          name: 'Sepolia',
          network: 'sepolia',
          nativeCurrency: {
            name: 'Ether',
            symbol: 'ETH',
            decimals: 18,
          },
          rpcUrls: {
            default: {
              http: ['https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161'],
            },
          },
          blockExplorers: {
            default: {
              name: 'Etherscan',
              url: 'https://sepolia.etherscan.io',
            },
          },
        },
      }}
    >
      <App />
    </PrivyProvider>
  </React.StrictMode>
);