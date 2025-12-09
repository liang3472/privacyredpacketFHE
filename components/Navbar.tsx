import React from 'react';
import { PixelButton } from './ui/PixelComponents';
import { UserWallet } from '../types';
import { Wallet, Menu, X, RefreshCw, ChevronDown } from 'lucide-react';

interface NavbarProps {
  wallet: UserWallet;
  onConnect: () => void;
  onDisconnect?: () => void;
  onSwitchNetwork?: () => void;
  currentPage: string;
  onNavigate: (page: string) => void;
  isAuthenticated: boolean;
}

const Navbar: React.FC<NavbarProps> = ({ wallet, onConnect, onDisconnect, onSwitchNetwork, currentPage, onNavigate, isAuthenticated }) => {
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const [showConnectMenu, setShowConnectMenu] = React.useState(false);

  const NavItems = [
    { id: 'home', label: 'Home' },
    { id: 'create', label: 'Create' },
    { id: 'dashboard', label: 'Dashboard' },
  ];

  return (
    <nav className="border-b-4 border-black bg-white sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
        {/* Logo */}
        <div 
          className="flex items-center gap-2 cursor-pointer" 
          onClick={() => onNavigate('home')}
        >
          <div className="w-10 h-10 bg-pixel-red border-4 border-black flex items-center justify-center text-white font-bold text-xl shadow-pixel-sm">
            R
          </div>
          <span className="hidden sm:block font-pixel text-sm md:text-lg font-bold">PrivacyPacket</span>
        </div>

        {/* Desktop Nav */}
        <div className="hidden md:flex gap-6 items-center">
          {NavItems.map(item => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`font-pixel text-xs hover:text-pixel-red transition-colors ${currentPage === item.id ? 'text-pixel-red underline decoration-4 underline-offset-4' : 'text-gray-600'}`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Wallet & Mobile Menu Toggle */}
        <div className="flex items-center gap-3 relative">
            {wallet.isConnected && wallet.needsNetworkSwitch && onSwitchNetwork ? (
              <PixelButton 
                  onClick={onSwitchNetwork} 
                  variant="primary"
                  className="!py-2 !px-3 !text-[10px] sm:!text-xs flex items-center gap-2 bg-orange-500 hover:bg-orange-600"
                  title={`Switch to Sepolia testnet (Chain ID: 11155111). Current: ${wallet.chainId || 'Unknown'}`}
              >
                  <RefreshCw size={16} />
                  Switch to Sepolia
              </PixelButton>
            ) : null}
            
            {!wallet.isConnected || !isAuthenticated ? (
              <PixelButton 
                  onClick={onConnect} 
                  variant="primary"
                  className="!py-2 !px-3 !text-[10px] sm:!text-xs flex items-center gap-2"
              >
                  <Wallet size={16} />
                  Connect
              </PixelButton>
            ) : (
              <PixelButton 
                  onClick={onDisconnect} 
                  variant="secondary"
                  className="!py-2 !px-3 !text-[10px] sm:!text-xs flex items-center gap-2"
              >
                  <Wallet size={16} />
                  {wallet.address.slice(0,6)}...{wallet.address.slice(-4)}
              </PixelButton>
            )}
            
            <button 
                className="md:hidden p-2 border-4 border-black hover:bg-gray-100"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
                {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="md:hidden border-t-4 border-black bg-white p-4 flex flex-col gap-4 shadow-xl">
           {NavItems.map(item => (
            <button
              key={item.id}
              onClick={() => {
                  onNavigate(item.id);
                  setIsMenuOpen(false);
              }}
              className={`font-pixel text-left text-xs p-2 hover:bg-gray-100 border-2 border-transparent hover:border-black ${currentPage === item.id ? 'text-pixel-red' : ''}`}
            >
              {item.label}
            </button>
          ))}
          {(!wallet.isConnected || !isAuthenticated) && (
            <>
              <div className="border-t-2 border-gray-300 my-2"></div>
              <button
                onClick={() => {
                  onConnect();
                  setIsMenuOpen(false);
                }}
                className="font-pixel text-left text-xs p-2 hover:bg-gray-100 border-2 border-transparent hover:border-black flex items-center gap-2"
              >
                <Wallet size={16} />
                Connect Wallet
              </button>
            </>
          )}
          {wallet.isConnected && isAuthenticated && onDisconnect && (
            <>
              <div className="border-t-2 border-gray-300 my-2"></div>
              <button
                onClick={() => {
                  onDisconnect();
                  setIsMenuOpen(false);
                }}
                className="font-pixel text-left text-xs p-2 hover:bg-gray-100 border-2 border-transparent hover:border-black flex items-center gap-2"
              >
                <Wallet size={16} />
                Disconnect
              </button>
            </>
          )}
          {wallet.isConnected && wallet.needsNetworkSwitch && onSwitchNetwork && (
            <>
              <div className="border-t-2 border-gray-300 my-2"></div>
              <button
                onClick={() => {
                  onSwitchNetwork();
                  setIsMenuOpen(false);
                }}
                className="font-pixel text-left text-xs p-2 bg-orange-500 text-white hover:bg-orange-600 border-2 border-black flex items-center gap-2"
                title={`Switch to Sepolia testnet (Chain ID: 11155111). Current: ${wallet.chainId || 'Unknown'}`}
              >
                <RefreshCw size={16} />
                Switch to Sepolia
              </button>
            </>
          )}
        </div>
      )}
      
      {/* Click outside to close connect menu */}
      {showConnectMenu && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setShowConnectMenu(false)}
        />
      )}
    </nav>
  );
};

export default Navbar;