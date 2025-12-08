<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/temp/3

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Smart Contract (Hardhat) - Sepolia

1. Install dev tooling (already included in package.json):
   `npm install`
2. Create `.env` with:
   ```
   SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/<key>
   PRIVATE_KEY=0x<your_private_key>
   ETHERSCAN_API_KEY=<optional_for_verification>
   ```
3. Compile contracts:
   `npm run hardhat compile`
4. Deploy to Sepolia:
   `npm run deploy:sepolia`
5. The deployed address will be printed in the terminal. Use the same password you hashed with `keccak256(utf8Bytes(password))` when calling `claim`.

## Configure contract addresses (frontend)

- Central config lives in `config/addresses.ts`. The current Sepolia contract is `0x7719E1E6C925F9f4a94aB9A8c90A7c2422aEFE86`.
- You can override at build/run time with environment variables:
  - `VITE_CONTRACT_ADDRESS=<address>`
  - `VITE_TOKEN_ADDRESS=<address>`
