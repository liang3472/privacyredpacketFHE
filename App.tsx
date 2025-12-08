import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import CreatePacket from './components/CreatePacket';
import Dashboard from './components/Dashboard';
import ClaimModal from './components/ClaimModal';
import { PixelCard, PixelButton, PixelBadge } from './components/ui/PixelComponents';
import { RedPacket, UserWallet, PacketType } from './types';
import { getPackets, connectWallet } from './services/blockchainService';
import { Search, Gift, Clock, Coins } from 'lucide-react';

declare global {
  interface Window {
    ethereum: any;
  }
}

export default function App() {
  const [wallet, setWallet] = useState<UserWallet>({
    address: '',
    balance: 0,
    isConnected: false,
  });
  
  const [currentPage, setCurrentPage] = useState('home');
  const [packets, setPackets] = useState<RedPacket[]>([]);
  const [selectedPacket, setSelectedPacket] = useState<RedPacket | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Initial load
  useEffect(() => {
    fetchPackets();
    // Check if previously connected
    if (window.ethereum && window.ethereum.selectedAddress) {
        handleConnect();
    }
  }, []);

  const fetchPackets = async () => {
    const data = await getPackets();
    setPackets(data);
  };

  const handleConnect = async () => {
    const walletData = await connectWallet();
    setWallet(walletData);
  };

  const filteredPackets = packets.filter(p => 
      (p.message.toLowerCase().includes(searchTerm.toLowerCase()) || p.id.includes(searchTerm))
  );

  const formatTimeLeft = (expiresAt: number) => {
    const diff = expiresAt - Date.now();
    if (diff <= 0) return 'Expired';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${mins}m`;
  };

  return (
    <div className="min-h-screen bg-pixel-bg pb-20">
      <Navbar 
        wallet={wallet} 
        onConnect={handleConnect} 
        currentPage={currentPage}
        onNavigate={setCurrentPage}
      />

      {/* Main Content */}
      <main className="container mx-auto">
        {currentPage === 'home' && (
            <div className="px-4 py-8">
                {/* Hero */}
                <div className="text-center mb-12">
                     <h1 className="text-3xl md:text-5xl font-pixel text-pixel-darkRed mb-4 leading-relaxed">
                        Privacy Red Packet
                     </h1>
                     <p className="font-pixel text-xs md:text-sm text-gray-600 max-w-2xl mx-auto leading-6">
                        Send crypto red packets with absolute privacy using <span className="bg-yellow-200 px-1">FHE technology</span>.
                        <br/>Amounts and passwords are fully encrypted on-chain.
                     </p>
                     
                     <div className="mt-8 flex justify-center gap-4">
                        <PixelButton onClick={() => setCurrentPage('create')} className="!text-sm px-8">
                            Create Packet
                        </PixelButton>
                        <PixelButton variant="secondary" onClick={() => {
                             document.getElementById('packet-list')?.scrollIntoView({ behavior: 'smooth' });
                        }}>
                            Find Packet
                        </PixelButton>
                     </div>
                </div>

                {/* Search */}
                <div id="packet-list" className="max-w-2xl mx-auto mb-8 flex gap-2">
                    <div className="flex-1 relative">
                        <input 
                            type="text" 
                            placeholder="Search by ID or Message..." 
                            className="w-full h-full border-4 border-black p-3 pl-10 font-pixel text-xs shadow-pixel-sm outline-none focus:bg-gray-50"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    </div>
                </div>

                {/* Packet List */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
                    {filteredPackets.length === 0 ? (
                        <div className="col-span-full text-center py-10">
                            <PixelCard>
                                <p className="font-pixel text-xs text-gray-400">No packets found. Create one!</p>
                                <p className="font-pixel text-[10px] text-red-300 mt-2">Make sure you are on Zama/Inco network and contract is set.</p>
                            </PixelCard>
                        </div>
                    ) : (
                        filteredPackets.map(packet => (
                            <div 
                                key={packet.id} 
                                onClick={() => setSelectedPacket(packet)}
                                className="group cursor-pointer relative top-0 hover:-top-2 transition-all duration-200"
                            >
                                <PixelCard className="h-full flex flex-col justify-between hover:border-pixel-red">
                                    <div>
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="w-12 h-12 bg-pixel-red border-4 border-black flex items-center justify-center text-white shadow-sm">
                                                <Gift />
                                            </div>
                                            <div className="space-y-2 flex flex-col items-end">
                                                <PixelBadge color={packet.type === PacketType.RANDOM ? 'bg-orange-400' : 'bg-blue-400'}>
                                                    {packet.type}
                                                </PixelBadge>
                                                {packet.expiresAt <= Date.now() && (
                                                    <PixelBadge color="bg-gray-500">Expired</PixelBadge>
                                                )}
                                                {packet.remainingQuantity === 0 && packet.expiresAt > Date.now() && (
                                                    <PixelBadge color="bg-gray-400">Finished</PixelBadge>
                                                )}
                                            </div>
                                        </div>
                                        <h3 className="font-pixel text-sm mb-2 truncate">"{packet.message}"</h3>
                                        <p className="font-pixel text-[10px] text-gray-500 mb-4">
                                            From: {packet.creator.slice(0,6)}...
                                        </p>
                                    </div>
                                    
                                    <div className="space-y-2 border-t-2 border-dashed border-gray-200 pt-3">
                                        <div className="flex justify-between text-[10px] font-pixel text-gray-600">
                                            <span className="flex items-center gap-1"><Coins size={12}/> Total</span>
                                            <span>{packet.totalAmount ? packet.totalAmount.toFixed(3) : '??'} {packet.tokenSymbol}</span>
                                        </div>
                                        <div className="flex justify-between text-[10px] font-pixel text-gray-600">
                                            <span className="flex items-center gap-1"><Clock size={12}/> Expires</span>
                                            <span>{formatTimeLeft(packet.expiresAt)}</span>
                                        </div>
                                        
                                        <div className="mt-3">
                                            <div className="w-full bg-gray-200 h-2 border-2 border-black rounded-none overflow-hidden">
                                                <div 
                                                    className="bg-pixel-red h-full transition-all duration-500" 
                                                    style={{ width: `${((packet.totalQuantity - packet.remainingQuantity) / packet.totalQuantity) * 100}%` }}
                                                />
                                            </div>
                                            <div className="flex justify-between mt-1 text-[8px] font-pixel text-gray-500">
                                                <span>{packet.totalQuantity - packet.remainingQuantity} claimed</span>
                                                <span>{packet.totalQuantity} total</span>
                                            </div>
                                        </div>
                                    </div>
                                </PixelCard>
                            </div>
                        ))
                    )}
                </div>
            </div>
        )}

        {currentPage === 'create' && (
            <CreatePacket 
                wallet={wallet} 
                onCreated={() => {
                    fetchPackets();
                    setCurrentPage('home');
                }} 
            />
        )}

        {currentPage === 'dashboard' && (
            <Dashboard wallet={wallet} />
        )}
      </main>

      {/* Footer */}
      <footer className="mt-20 border-t-4 border-black bg-white py-8 text-center">
        <p className="font-pixel text-[10px] text-gray-400">
            PrivacyRedPacket © 2024. Built with React & Tailwind.
        </p>
      </footer>

      {/* Modal */}
      {selectedPacket && (
        <ClaimModal 
            packet={selectedPacket} 
            userAddress={wallet.address || '0x000'}
            onClose={() => setSelectedPacket(null)}
            onSuccess={() => {
                fetchPackets(); // Refresh data
            }}
        />
      )}
    </div>
  );
}