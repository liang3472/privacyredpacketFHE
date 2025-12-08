// Centralized place to manage contract/token addresses per network.
// Frontend can still override via VITE_CONTRACT_ADDRESS / VITE_TOKEN_ADDRESS.

export type NetworkKey = "sepolia" | "local";

export const ADDRESSES: Record<NetworkKey, { contract: string; token: string }> = {
  local: {
    contract: "0x0000000000000000000000000000000000000000",
    token: "0x0000000000000000000000000000000000000000",
  },
  sepolia: {
    contract: "0x9D3bc69774f8A652B0983f88f742604477Ecd2Ee",
    token: "0x0000000000000000000000000000000000000000",
  },
};

export const getConfiguredAddresses = () => {
  const contract =
    (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_CONTRACT_ADDRESS) ||
    ADDRESSES.sepolia.contract;

  const token =
    (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_TOKEN_ADDRESS) ||
    ADDRESSES.sepolia.token;

  return { contract, token };
};

