import React from 'react';
import { PixelButton } from './ui/PixelComponents';
import { UserWallet } from '../types';
import { Wallet, Menu, X } from 'lucide-react';

interface NavbarProps {
  wallet: UserWallet;
  onConnect: () => void;
  currentPage: string;
  onNavigate: (page: string) => void;
}

const Navbar: React.FC<NavbarProps> = ({ wallet, onConnect, currentPage, onNavigate }) => {
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);

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
        <div className="flex items-center gap-3">
            <PixelButton 
                onClick={onConnect} 
                variant={wallet.isConnected ? 'secondary' : 'primary'}
                className="!py-2 !px-3 !text-[10px] sm:!text-xs flex items-center gap-2"
            >
                <Wallet size={16} />
                {wallet.isConnected ? `${wallet.address.slice(0,6)}...${wallet.address.slice(-4)}` : 'Connect'}
            </PixelButton>
            
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
        </div>
      )}
    </nav>
  );
};

export default Navbar;