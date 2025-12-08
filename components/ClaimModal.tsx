import React, { useState } from 'react';
import { PixelCard, PixelInput, PixelButton } from './ui/PixelComponents';
import { RedPacket } from '../types';
import { claimPacket } from '../services/mockService';
import { X, Gift } from 'lucide-react';

interface ClaimModalProps {
  packet: RedPacket;
  userAddress: string;
  onClose: () => void;
  onSuccess: () => void;
}

const ClaimModal: React.FC<ClaimModalProps> = ({ packet, userAddress, onClose, onSuccess }) => {
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'decrypting' | 'success' | 'error'>('idle');
  const [resultAmount, setResultAmount] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [cooldownMs, setCooldownMs] = useState<number>(0);
  const [attemptsLeft, setAttemptsLeft] = useState<number>(5);

  const isExpired = Date.now() > packet.expiresAt;
  const isFinished = packet.remainingQuantity <= 0;

  const handleClaim = async () => {
    if (!password) return;
    setStatus('decrypting');
    setErrorMsg('');

    try {
        const res = await claimPacket(packet.id, userAddress, password);
        if (res.success) {
            setResultAmount(res.amount);
            setStatus('success');
            setTimeout(onSuccess, 3000); // Wait a bit then refresh
        } else {
            setStatus('error');
            setErrorMsg(res.message || 'Claim failed');
            if (res.cooldown) setCooldownMs(res.cooldown);
            if (typeof res.remainingAttempts === 'number') setAttemptsLeft(res.remainingAttempts);
        }
    } catch (e) {
        setStatus('error');
        setErrorMsg('Network error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="max-w-md w-full relative">
        <button 
            onClick={onClose}
            className="absolute -top-4 -right-4 bg-white border-4 border-black p-2 hover:bg-red-100 z-10 shadow-pixel"
        >
            <X size={20} />
        </button>

        <PixelCard className="text-center pt-10">
            <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-24 h-24 bg-pixel-red border-4 border-black rounded-full flex items-center justify-center shadow-pixel">
                <Gift size={40} className="text-white" />
            </div>

            <h2 className="font-pixel text-lg mb-2 mt-4">{packet.creator.slice(0,6)}'s Packet</h2>
            <p className="font-pixel text-xs text-gray-500 mb-2">"{packet.message}"</p>
            <p className="font-pixel text-[10px] text-gray-400 mb-6">
                {packet.remainingQuantity}/{packet.totalQuantity} left · {isExpired ? 'Expired' : 'Expires soon'}
            </p>

            {status === 'success' ? (
                 <div className="py-8 animate-bounce">
                    <p className="font-pixel text-sm text-gray-500 mb-2">You received</p>
                    <div className="font-pixel text-3xl text-pixel-red font-bold mb-2">
                        {resultAmount?.toFixed(4)} {packet.tokenSymbol}
                    </div>
                    <p className="text-xs text-green-600">Transferred to wallet</p>
                 </div>
            ) : (
                <>
                    <div className="bg-yellow-50 border-2 border-dashed border-yellow-500 p-3 mb-6">
                        <p className="font-pixel text-[10px] text-yellow-800">
                             🔒 This packet is protected by Homomorphic Encryption.
                             Verification happens on-chain without revealing the password.
                        </p>
                    </div>

                    <PixelInput 
                        placeholder="Enter Password"
                        type="password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        className="text-center"
                    />
                    
                    {status === 'error' && (
                        <p className="font-pixel text-xs text-red-500 mb-4">{errorMsg}</p>
                    )}
                    {cooldownMs > 0 && (
                        <p className="font-pixel text-[10px] text-yellow-700 mb-2">
                            Too many attempts. Wait {Math.ceil(cooldownMs / 1000)}s. Attempts left: {attemptsLeft}
                        </p>
                    )}
                    {status !== 'error' && attemptsLeft < 5 && cooldownMs === 0 && (
                        <p className="font-pixel text-[10px] text-gray-500 mb-2">
                            Attempts left: {attemptsLeft}
                        </p>
                    )}

                    <PixelButton 
                        onClick={handleClaim} 
                        className="w-full"
                        isLoading={status === 'decrypting'}
                        disabled={!password || isExpired || isFinished || cooldownMs > 0}
                    >
                        {isExpired ? 'EXPIRED' : isFinished ? 'FINISHED' : status === 'decrypting' ? 'VERIFYING ZK PROOF...' : 'OPEN PACKET'}
                    </PixelButton>
                </>
            )}
        </PixelCard>
      </div>
    </div>
  );
};

export default ClaimModal;