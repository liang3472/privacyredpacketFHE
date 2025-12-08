# 隐私红包dApp

[English Documentation](README.md)

隐私红包dApp是一款基于区块链的隐私保护红包应用，利用全同态加密技术确保红包密码和金额分配的完全隐私性。

## 项目简介

### 核心特性
- 🔒 **绝对隐私保护**：红包密码和随机金额在链上加密存储，永不泄露
- 🌐 **去中心化运作**：不依赖任何中心化服务器，抗审查
- 🎲 **灵活红包类型**：支持随机红包（拼手气）和平均分配红包
- 🔐 **安全可靠**：基于密码学保障资金安全

### 功能特点
- 创建两种类型的红包：随机红包和平均红包
- 密码保护领取机制，确保只有知道密码的用户才能领取
- 支持ETH和ERC20代币
- 可设置过期时间和领取条件
- 完整的红包管理和统计功能

---

## 本地运行

**前置要求：** Node.js

1. 安装依赖：
   ```bash
   npm install
   ```

2. 在 [.env.local](.env.local) 中设置 `GEMINI_API_KEY` 为你的 Gemini API 密钥：
   ```
   GEMINI_API_KEY=your_api_key_here
   ```

3. 运行应用：
   ```bash
   npm run dev
   ```

在 AI Studio 中查看应用：https://ai.studio/apps/temp/3

## 智能合约部署 (Hardhat) - Sepolia

1. 安装开发工具（已包含在 package.json 中）：
   ```bash
   npm install
   ```

2. 创建 `.env` 文件，包含以下内容：
   ```env
   SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/<key>
   PRIVATE_KEY=0x<your_private_key>
   ETHERSCAN_API_KEY=<optional_for_verification>
   ```

3. 编译合约：
   ```bash
   npm run hardhat compile
   ```

4. 部署到 Sepolia 测试网：
   ```bash
   npm run deploy:sepolia
   ```

5. 部署地址将打印在终端中。调用 `claim` 时使用与 `keccak256(utf8Bytes(password))` 哈希相同的密码。

## 配置合约地址（前端）

- 中心配置位于 `config/addresses.ts`。当前 Sepolia 合约地址为 `0x9D3bc69774f8A652B0983f88f742604477Ecd2Ee`。
- 可以通过环境变量在构建/运行时覆盖：
  - `VITE_CONTRACT_ADDRESS=<address>`
  - `VITE_TOKEN_ADDRESS=<address>`

