export enum PacketType {
  RANDOM = 'RANDOM',
  AVERAGE = 'AVERAGE',
}

export interface RedPacket {
  id: string;
  creator: string;
  type: PacketType;
  tokenSymbol: string;
  totalAmount: number;
  remainingAmount: number;
  totalQuantity: number;
  remainingQuantity: number;
  createdAt: number;
  expiresAt: number;
  message: string;
  isEncrypted: boolean; // Simulating FHE state
}

export interface ClaimRecord {
  packetId: string;
  claimer: string;
  amount: number;
  claimedAt: number;
}

export interface UserWallet {
  address: string;
  balance: number;
  isConnected: boolean;
  needsNetworkSwitch?: boolean;
  chainId?: number;
  connectionType?: 'metamask' | 'walletconnect';
}