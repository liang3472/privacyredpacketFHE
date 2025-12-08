# Privacy Red Packet dApp

[中文文档 / Chinese Documentation](README.zh.md)

Privacy Red Packet dApp is a blockchain-based privacy-preserving red packet application that uses fully homomorphic encryption technology to ensure complete privacy of red packet passwords and amount distribution.

## Project Overview

### Core Features
- 🔒 **Absolute Privacy Protection**: Red packet passwords and random amounts are encrypted and stored on-chain, never leaked
- 🌐 **Decentralized Operation**: No reliance on centralized servers, censorship-resistant
- 🎲 **Flexible Red Packet Types**: Supports random red packets (lucky draw) and evenly distributed red packets
- 🔐 **Secure and Reliable**: Cryptography-based fund security

### Features
- Create two types of red packets: random and evenly distributed
- Password-protected claiming mechanism ensures only users with the correct password can claim
- Supports ETH and ERC20 tokens
- Configurable expiration time and claiming conditions
- Complete red packet management and statistics

---

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key:
   ```
   GEMINI_API_KEY=your_api_key_here
   ```

3. Run the app:
   ```bash
   npm run dev
   ```

View your app in AI Studio: https://ai.studio/apps/temp/3

## Smart Contract Deployment (Hardhat) - Sepolia

1. Install dev tooling (already included in package.json):
   ```bash
   npm install
   ```

2. Create `.env` with:
   ```env
   SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/<key>
   PRIVATE_KEY=0x<your_private_key>
   ETHERSCAN_API_KEY=<optional_for_verification>
   ```

3. Compile contracts:
   ```bash
   npm run hardhat compile
   ```

4. Deploy to Sepolia:
   ```bash
   npm run deploy:sepolia
   ```

5. The deployed address will be printed in the terminal. Use the same password you hashed with `keccak256(utf8Bytes(password))` when calling `claim`.

## Configure Contract Addresses (Frontend)

- Central config lives in `config/addresses.ts`. The current Sepolia contract is `0x9D3bc69774f8A652B0983f88f742604477Ecd2Ee`.
- You can override at build/run time with environment variables:
  - `VITE_CONTRACT_ADDRESS=<address>`
  - `VITE_TOKEN_ADDRESS=<address>`
