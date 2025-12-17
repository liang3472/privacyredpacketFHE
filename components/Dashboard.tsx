import React, { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import { RedPacket, ClaimRecord, UserWallet } from '../types';
import { getUserHistory, getPackets, refundExpiredPacket } from '../services/blockchainService';
import { PixelCard, PixelBadge, PixelButton } from './ui/PixelComponents';
import { Coins, ArrowUpRight, ArrowDownLeft, Copy, Check, Wallet } from 'lucide-react';

interface DashboardProps {
    wallet: UserWallet;
    provider: ethers.BrowserProvider | null;
}

const Dashboard: React.FC<DashboardProps> = ({ wallet, provider }) => {
    const [history, setHistory] = useState<{ created: RedPacket[], claimed: ClaimRecord[] }>({ created: [], claimed: [] });
    const [activeTab, setActiveTab] = useState<'received' | 'sent'>('received');
    const [allPackets, setAllPackets] = useState<RedPacket[]>([]);
    const [copiedPacketId, setCopiedPacketId] = useState<string | null>(null);
    const [refundingPacketId, setRefundingPacketId] = useState<string | null>(null);

    useEffect(() => {
        if (wallet.isConnected && provider) {
            getUserHistory(wallet.address, provider).then(setHistory);
            getPackets(provider).then(setAllPackets).catch(console.error);
        }
    }, [wallet, provider]);

    const copyShareLink = async (packetId: string) => {
        const shareLink = `${window.location.origin}${window.location.pathname}?packetId=${packetId}`;
        try {
            await navigator.clipboard.writeText(shareLink);
            setCopiedPacketId(packetId);
            setTimeout(() => setCopiedPacketId(null), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = shareLink;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            setCopiedPacketId(packetId);
            setTimeout(() => setCopiedPacketId(null), 2000);
        }
    };

    const handleRefund = async (packetId: string) => {
        if (!provider || !wallet.isConnected) {
            alert('Please connect your wallet first');
            return;
        }

        if (wallet.needsNetworkSwitch) {
            alert('Please switch to Sepolia testnet first');
            return;
        }

        if (!confirm('Are you sure you want to refund the remaining balance from this expired packet?')) {
            return;
        }

        setRefundingPacketId(packetId);
        try {
            const signer = await provider.getSigner();
            const result = await refundExpiredPacket(packetId, provider, signer);
            
            if (result.success) {
                alert(`Successfully refunded ${result.amount?.toFixed(4) || '0'} ETH!`);
                // Refresh the packet list
                if (provider) {
                    getUserHistory(wallet.address, provider).then(setHistory);
                    getPackets(provider).then(setAllPackets).catch(console.error);
                }
            } else {
                alert(`Refund failed: ${result.message || 'Unknown error'}`);
            }
        } catch (error: any) {
            console.error('Refund error:', error);
            alert(`Refund failed: ${error.message || 'Unknown error'}`);
        } finally {
            setRefundingPacketId(null);
        }
    };

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

    // Filter out expired and fully claimed packets from sent tab
    const filteredCreated = history.created.filter((packet) => {
        const isExpired = packet.expiresAt < Date.now();
        const isFullyClaimed = packet.remainingQuantity === 0;
        // Hide packets that are both expired and fully claimed
        return !(isExpired && isFullyClaimed);
    });

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
                    Sent ({filteredCreated.length})
                </button>
             </div>

             {/* List */}
             <div className="space-y-4">
                {activeTab === 'received' ? (
                    history.claimed.length === 0 ? (
                        <div className="text-center font-pixel text-xs text-gray-400 py-10">No records found</div>
                    ) : (
                        history.claimed.map((record, idx) => {
                            const packet = allPackets.find(p => p.id === record.packetId);
                            const hasRemaining = packet && packet.remainingQuantity > 0 && packet.expiresAt > Date.now();
                            return (
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
                                    <div className="flex items-center gap-3">
                                        <div className="text-right">
                                            <p className="font-pixel text-sm text-green-600">+{record.amount.toFixed(4)} ETH</p>
                                            <PixelBadge color="bg-green-500">Success</PixelBadge>
                                        </div>
                                        {hasRemaining && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    copyShareLink(record.packetId);
                                                }}
                                                className="w-8 h-8 border-2 border-black bg-pixel-yellow hover:bg-pixel-darkYellow transition-colors flex items-center justify-center"
                                                title="Copy share link"
                                            >
                                                {copiedPacketId === record.packetId ? (
                                                    <Check size={16} className="text-black" />
                                                ) : (
                                                    <Copy size={16} className="text-black" />
                                                )}
                                            </button>
                                        )}
                                    </div>
                                </PixelCard>
                            );
                        })
                    )
                ) : (
                    filteredCreated.length === 0 ? (
                        <div className="text-center font-pixel text-xs text-gray-400 py-10">No records found</div>
                    ) : (
                        filteredCreated.map((packet) => {
                            const hasRemaining = packet.remainingQuantity > 0 && packet.expiresAt > Date.now();
                            const isExpired = packet.expiresAt < Date.now();
                            const canRefund = isExpired && packet.remainingAmount > 0 && !packet.refunded && packet.creator.toLowerCase() === wallet.address.toLowerCase();
                            return (
                                <PixelCard key={packet.id} className="flex justify-between items-center !p-4">
                                    <div className="flex items-center gap-4">
                                         <div className="w-10 h-10 bg-gray-200 border-2 border-black flex items-center justify-center">
                                            <ArrowUpRight size={20} />
                                        </div>
                                        <div>
                                            <p className="font-pixel text-xs mb-1">{packet.message || 'Red Packet'}</p>
                                            <p className="font-pixel text-[10px] text-gray-500">
                                                {packet.remainingQuantity}/{packet.totalQuantity} left · {isExpired ? 'Expired' : 'Active'}
                                                {packet.refunded && ' · Refunded'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <div className="text-right flex-1">
                                            <p className="font-pixel text-sm text-red-600">-{packet.totalAmount.toFixed(3)} {packet.tokenSymbol}</p>
                                            {canRefund && (
                                                <p className="font-pixel text-[10px] text-orange-600 mb-1.5">
                                                    {packet.remainingAmount.toFixed(4)} ETH available
                                                </p>
                                            )}
                                        </div>
                                        <div className="flex flex-col items-end gap-2">
                                            <PixelBadge color={packet.remainingQuantity === 0 ? 'bg-gray-400' : isExpired ? 'bg-orange-500' : 'bg-blue-500'}>
                                                {packet.remainingQuantity === 0 ? 'Finished' : isExpired ? 'Expired' : 'Active'}
                                            </PixelBadge>
                                            {canRefund && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleRefund(packet.id);
                                                    }}
                                                    disabled={refundingPacketId === packet.id}
                                                    className="px-3 py-1.5 border-2 border-black bg-pixel-yellow hover:bg-pixel-darkYellow active:translate-x-[1px] active:translate-y-[1px] active:shadow-none disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-pixel-sm flex items-center gap-1.5 font-pixel text-[10px] text-black whitespace-nowrap"
                                                    title="Refund remaining balance"
                                                >
                                                    {refundingPacketId === packet.id ? (
                                                        <>
                                                            <div className="w-2.5 h-2.5 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                                                            <span>Processing...</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Wallet size={11} />
                                                            <span>Refund</span>
                                                        </>
                                                    )}
                                                </button>
                                            )}
                                            {hasRemaining && !canRefund && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        copyShareLink(packet.id);
                                                    }}
                                                    className="w-8 h-8 border-2 border-black bg-pixel-yellow hover:bg-pixel-darkYellow transition-colors flex items-center justify-center"
                                                    title="Copy share link"
                                                >
                                                    {copiedPacketId === packet.id ? (
                                                        <Check size={16} className="text-black" />
                                                    ) : (
                                                        <Copy size={16} className="text-black" />
                                                    )}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </PixelCard>
                            );
                        })
                    )
                )}
             </div>
        </div>
    );
};

export default Dashboard;