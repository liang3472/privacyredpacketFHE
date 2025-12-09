import React, { useEffect, useState } from 'react';
import { RedPacket, ClaimRecord, UserWallet } from '../types';
import { getUserHistory } from '../services/blockchainService';
import { PixelCard, PixelBadge } from './ui/PixelComponents';
import { Coins, ArrowUpRight, ArrowDownLeft } from 'lucide-react';

interface DashboardProps {
    wallet: UserWallet;
}

const Dashboard: React.FC<DashboardProps> = ({ wallet }) => {
    const [history, setHistory] = useState<{ created: RedPacket[], claimed: ClaimRecord[] }>({ created: [], claimed: [] });
    const [activeTab, setActiveTab] = useState<'received' | 'sent'>('received');

    useEffect(() => {
        if (wallet.isConnected) {
            getUserHistory(wallet.address).then(setHistory);
        }
    }, [wallet]);

    if (!wallet.isConnected) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh]">
                <PixelCard className="text-center p-10">
                    <h2 className="font-pixel text-xl mb-4">Wallet Not Connected</h2>
                    <p className="font-pixel text-xs text-gray-500">Please connect your wallet to view history.</p>
                </PixelCard>
            </div>
        );
    }

    const totalReceived = history.claimed.reduce((acc, curr) => acc + curr.amount, 0);
    const totalSent = history.created.reduce((acc, curr) => acc + curr.totalAmount, 0);

    return (
        <div className="max-w-4xl mx-auto py-8 px-4">
             {/* Stats Cards */}
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <PixelCard className="flex items-center gap-4 bg-red-50">
                    <div className="w-12 h-12 bg-white border-4 border-black flex items-center justify-center">
                        <ArrowDownLeft className="text-green-600" />
                    </div>
                    <div>
                        <p className="font-pixel text-xs text-gray-500 mb-1">Total Received</p>
                        <h3 className="font-pixel text-xl md:text-2xl text-green-600">{totalReceived.toFixed(3)} ETH</h3>
                    </div>
                </PixelCard>
                <PixelCard className="flex items-center gap-4 bg-blue-50">
                    <div className="w-12 h-12 bg-white border-4 border-black flex items-center justify-center">
                        <ArrowUpRight className="text-red-600" />
                    </div>
                    <div>
                        <p className="font-pixel text-xs text-gray-500 mb-1">Total Sent</p>
                        <h3 className="font-pixel text-xl md:text-2xl text-red-600">{totalSent.toFixed(3)} ETH</h3>
                    </div>
                </PixelCard>
             </div>

             {/* Tabs */}
             <div className="flex border-b-4 border-black mb-6">
                <button 
                    onClick={() => setActiveTab('received')}
                    className={`px-6 py-3 font-pixel text-xs transition-colors ${activeTab === 'received' ? 'bg-pixel-red text-white' : 'bg-transparent hover:bg-gray-100'}`}
                >
                    Received ({history.claimed.length})
                </button>
                <button 
                    onClick={() => setActiveTab('sent')}
                    className={`px-6 py-3 font-pixel text-xs transition-colors ${activeTab === 'sent' ? 'bg-pixel-red text-white' : 'bg-transparent hover:bg-gray-100'}`}
                >
                    Sent ({history.created.length})
                </button>
             </div>

             {/* List */}
             <div className="space-y-4">
                {activeTab === 'received' ? (
                    history.claimed.length === 0 ? (
                        <div className="text-center font-pixel text-xs text-gray-400 py-10">No records found</div>
                    ) : (
                        history.claimed.map((record, idx) => (
                            <PixelCard key={idx} className="flex justify-between items-center !p-4">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-pixel-yellow border-2 border-black flex items-center justify-center">
                                        <Coins size={20} />
                                    </div>
                                    <div>
                                        <p className="font-pixel text-xs mb-1">Packet #{record.packetId}</p>
                                        <p className="font-pixel text-[10px] text-gray-500">{new Date(record.claimedAt).toLocaleDateString()}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="font-pixel text-sm text-green-600">+{record.amount.toFixed(4)} ETH</p>
                                    <PixelBadge color="bg-green-500">Success</PixelBadge>
                                </div>
                            </PixelCard>
                        ))
                    )
                ) : (
                    history.created.length === 0 ? (
                        <div className="text-center font-pixel text-xs text-gray-400 py-10">No records found</div>
                    ) : (
                        history.created.map((packet) => (
                            <PixelCard key={packet.id} className="flex justify-between items-center !p-4">
                                <div className="flex items-center gap-4">
                                     <div className="w-10 h-10 bg-gray-200 border-2 border-black flex items-center justify-center">
                                        <ArrowUpRight size={20} />
                                    </div>
                                    <div>
                                        <p className="font-pixel text-xs mb-1">{packet.message || 'Red Packet'}</p>
                                        <p className="font-pixel text-[10px] text-gray-500">
                                            {packet.remainingQuantity}/{packet.totalQuantity} left · {packet.expiresAt < Date.now() ? 'Expired' : 'Active'}
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="font-pixel text-sm text-red-600">-{packet.totalAmount.toFixed(3)} {packet.tokenSymbol}</p>
                                    <PixelBadge color={packet.remainingQuantity === 0 ? 'bg-gray-400' : 'bg-blue-500'}>
                                        {packet.remainingQuantity === 0 ? 'Finished' : 'Active'}
                                    </PixelBadge>
                                </div>
                            </PixelCard>
                        ))
                    )
                )}
             </div>
        </div>
    );
};

export default Dashboard;