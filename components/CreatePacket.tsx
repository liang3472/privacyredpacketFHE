import React, { useState } from 'react';
import { PixelCard, PixelInput, PixelButton } from './ui/PixelComponents';
import { PacketType, UserWallet } from '../types';
import { Lock, Shuffle, Users } from 'lucide-react';
import { createPacket } from '../services/mockService';

interface CreatePacketProps {
  wallet: UserWallet;
  onCreated: () => void;
}

const CreatePacket: React.FC<CreatePacketProps> = ({ wallet, onCreated }) => {
  const [type, setType] = useState<PacketType>(PacketType.RANDOM);
  const [totalAmount, setTotalAmount] = useState('');
  const [quantity, setQuantity] = useState('');
  const [expiresInHours, setExpiresInHours] = useState('24');
  const [message, setMessage] = useState('Best Wishes!');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wallet.isConnected) {
        alert("Please connect wallet first!");
        return;
    }
    if (password.length < 6 || password.length > 16) {
        setError('Password must be 6-16 characters.');
        return;
    }
    if (Number(quantity) <= 0 || Number(totalAmount) <= 0) {
        setError('Amount and quantity must be greater than 0.');
        return;
    }
    setError('');
    setLoading(true);
    
    // Simulate API call
    try {
        await createPacket({
            type,
            tokenSymbol: 'ETH',
            totalAmount: parseFloat(totalAmount),
            totalQuantity: parseInt(quantity),
            expiresAt: Date.now() + parseInt(expiresInHours) * 60 * 60 * 1000,
            message,
            creator: wallet.address,
            isEncrypted: true,
            password,
        });
        alert("Red Packet Created Successfully!");
        onCreated();
    } catch (error) {
        console.error(error);
        alert("Failed to create packet");
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="text-center mb-8">
        <h1 className="font-pixel text-2xl md:text-3xl mb-4 text-pixel-darkRed">Create Red Packet</h1>
        <p className="font-pixel text-xs text-gray-500">Encrypted on-chain. Private & Secure.</p>
      </div>

      <PixelCard className="mb-6">
        {/* Type Selector */}
        <div className="flex gap-4 mb-8">
          <button
            type="button"
            onClick={() => setType(PacketType.RANDOM)}
            className={`flex-1 p-4 border-4 border-black text-center transition-all ${
              type === PacketType.RANDOM ? 'bg-pixel-red text-white shadow-pixel' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            <Shuffle className="mx-auto mb-2" size={24} />
            <div className="font-pixel text-xs">Lucky</div>
          </button>
          <button
            type="button"
            onClick={() => setType(PacketType.AVERAGE)}
            className={`flex-1 p-4 border-4 border-black text-center transition-all ${
              type === PacketType.AVERAGE ? 'bg-pixel-red text-white shadow-pixel' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            <Users className="mx-auto mb-2" size={24} />
            <div className="font-pixel text-xs">Normal</div>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <PixelInput
            label="Total Amount (ETH)"
            type="number"
            placeholder="0.0"
            step="0.001"
            value={totalAmount}
            onChange={(e) => setTotalAmount(e.target.value)}
            required
          />

          <PixelInput
            label="Quantity (Packets)"
            type="number"
            placeholder="10"
            min="1"
            max="100"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
          />

          <div className="relative">
            <PixelInput
                label="Secret Password"
                type="text"
                placeholder="Set a claim password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
            />
            <div className="absolute right-4 top-10 text-gray-400">
                <Lock size={16} />
            </div>
            <p className="text-[10px] font-pixel text-gray-400 mt-1">
                * Password will be encrypted using FHE. 6-16 characters.
            </p>
          </div>

          <PixelInput
            label="Expire After (hours)"
            type="number"
            min="1"
            max="720"
            value={expiresInHours}
            onChange={(e) => setExpiresInHours(e.target.value)}
            required
          />

          <PixelInput
            label="Blessing Message"
            type="text"
            placeholder="Best Wishes!"
            maxLength={50}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />

          {error && (
            <p className="text-red-500 font-pixel text-[10px] -mt-2">{error}</p>
          )}

          <div className="pt-4 border-t-4 border-dashed border-gray-300 mt-6 space-y-2">
            <div className="flex justify-between font-pixel text-sm">
                <span>Total Cost</span>
                <span className="text-pixel-red font-bold">{totalAmount || '0'} ETH</span>
            </div>
            <div className="flex justify-between font-pixel text-[10px] text-gray-500">
                <span>Type</span>
                <span>{type === PacketType.RANDOM ? 'Lucky (random amounts)' : 'Normal (average split)'}</span>
            </div>
            <div className="flex justify-between font-pixel text-[10px] text-gray-500">
                <span>Expires in</span>
                <span>{expiresInHours}h</span>
            </div>
            <PixelButton 
                type="submit" 
                className="w-full text-center flex justify-center py-4"
                isLoading={loading}
            >
                Generate Packet
            </PixelButton>
          </div>
        </form>
      </PixelCard>
    </div>
  );
};

export default CreatePacket;