// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @notice Minimal privacy-focused red packet contract supporting ETH and ERC20.
/// Passwords are stored as keccak256 hashes; callers submit the password plaintext to claim.
contract PrivacyRedPacket is ReentrancyGuard {
    enum PacketType {
        Random,
        Average
    }

    struct RedPacket {
        address creator;
        PacketType packetType;
        address token;
        uint256 totalAmount;
        uint256 remainingAmount;
        uint256 totalShares;
        uint256 remainingShares;
        uint256 expiry;
        bytes encryptedPassword; // FHE encrypted password
        bytes32 passwordHash; // Keccak256 hash for verification
        string message;
        bool refunded;
        mapping(address => bool) claimed;
    }

    uint256 public nextPacketId;
    uint256 private randomNonce;

    uint256 private constant MIN_DURATION = 1 hours;
    uint256 private constant MAX_DURATION = 30 days;

    mapping(uint256 => RedPacket) private packets;

    event PacketCreated(
        uint256 indexed id,
        address indexed creator,
        uint8 packetType,
        uint256 totalQuantity,
        string message,
        uint256 expiresAt
    );
    event PacketClaimed(uint256 indexed id, address indexed claimer);
    event RedPacketRefunded(uint256 indexed packetId, uint256 amountReturned);

    error PacketExpired();
    error PacketNotExpired();
    error PacketDoesNotExist();
    error InvalidPassword();
    error AlreadyClaimed();
    error SoldOut();
    error NotCreator();
    error NothingToRefund();

    function createPacket(
        uint8 packetType,
        uint256 totalAmount,
        uint256 quantity,
        bytes calldata password,
        bytes calldata inputProof,
        string calldata message
    ) external payable nonReentrant {
        if (quantity == 0) revert SoldOut();
        require(quantity <= 100, "shares too many"); // align with product spec upper bound
        require(totalAmount > 0, "amount zero");
        require(password.length > 0, "password required");
        require(bytes(message).length <= 100, "message too long");

        // Default duration: 24 hours (can be extended later if needed)
        uint256 durationSeconds = 24 hours;
        require(durationSeconds >= MIN_DURATION && durationSeconds <= MAX_DURATION, "invalid duration");

        uint256 packetId = nextPacketId++;
        RedPacket storage packet = packets[packetId];
        packet.creator = msg.sender;
        packet.packetType = PacketType(packetType);
        packet.token = address(0); // Default to ETH
        packet.totalAmount = totalAmount;
        packet.remainingAmount = totalAmount;
        packet.totalShares = quantity;
        packet.remainingShares = quantity;
        packet.expiry = block.timestamp + durationSeconds;
        packet.encryptedPassword = password;
        // Store hash of encrypted password for verification (simplified approach)
        packet.passwordHash = keccak256(password);
        packet.message = message;

        // Only ETH supported for now (can be extended for ERC20)
        require(msg.value == totalAmount, "incorrect eth");

        emit PacketCreated(
            packetId,
            msg.sender,
            packetType,
            quantity,
            message,
            packet.expiry
        );
    }

    function claimPacket(
        uint256 packetId,
        bytes calldata password,
        bytes calldata inputProof
    ) external nonReentrant {
        RedPacket storage packet = packets[packetId];
        if (packet.creator == address(0)) revert PacketDoesNotExist();
        if (block.timestamp > packet.expiry) revert PacketExpired();
        if (packet.remainingShares == 0) revert SoldOut();
        if (packet.claimed[msg.sender]) revert AlreadyClaimed();

        // Verify password: compare hash of encrypted password
        // Note: In a full FHE implementation, this would decrypt and verify on-chain
        // For now, we use a simplified hash comparison
        if (keccak256(password) != packet.passwordHash) {
            revert InvalidPassword();
        }

        // inputProof is used for FHE verification (can be extended later)
        // For now, we just check it's not empty
        require(inputProof.length > 0, "proof required");

        uint256 amount = packet.packetType == PacketType.Random
            ? _randomAmount(packet)
            : _averageAmount(packet);

        packet.claimed[msg.sender] = true;
        packet.remainingShares -= 1;
        packet.remainingAmount -= amount;

        _payout(packet.token, msg.sender, amount);
        emit PacketClaimed(packetId, msg.sender);
    }

    function refundExpired(uint256 packetId) external nonReentrant {
        RedPacket storage packet = packets[packetId];
        if (packet.creator == address(0)) revert PacketDoesNotExist();
        if (msg.sender != packet.creator) revert NotCreator();
        if (block.timestamp <= packet.expiry) revert PacketNotExpired();
        if (packet.refunded || packet.remainingAmount == 0) revert NothingToRefund();

        uint256 amount = packet.remainingAmount;
        packet.refunded = true;
        packet.remainingAmount = 0;
        packet.remainingShares = 0;

        _payout(packet.token, msg.sender, amount);
        emit RedPacketRefunded(packetId, amount);
    }

    function getPacketStatus(uint256 packetId) external view returns (uint256 remainingQty, bool isExpired) {
        RedPacket storage packet = packets[packetId];
        if (packet.creator == address(0)) revert PacketDoesNotExist();
        remainingQty = packet.remainingShares;
        isExpired = block.timestamp > packet.expiry;
    }

    function hasClaimed(uint256 packetId, address user) external view returns (bool) {
        RedPacket storage packet = packets[packetId];
        if (packet.creator == address(0)) revert PacketDoesNotExist();
        return packet.claimed[user];
    }

    function packetSummary(
        uint256 packetId
    )
        external
        view
        returns (
            address creator,
            PacketType packetType,
            address token,
            uint256 totalAmount,
            uint256 remainingAmount,
            uint256 totalShares,
            uint256 remainingShares,
            uint256 expiry,
            bool refunded
        )
    {
        RedPacket storage packet = packets[packetId];
        if (packet.creator == address(0)) revert PacketDoesNotExist();
        creator = packet.creator;
        packetType = packet.packetType;
        token = packet.token;
        totalAmount = packet.totalAmount;
        remainingAmount = packet.remainingAmount;
        totalShares = packet.totalShares;
        remainingShares = packet.remainingShares;
        expiry = packet.expiry;
        refunded = packet.refunded;
    }

    function _randomAmount(RedPacket storage packet) private returns (uint256) {
        if (packet.remainingShares == 1) return packet.remainingAmount;

        // Ensure at least 1 unit left for every future share.
        uint256 minShare = 1;
        uint256 maxShare = packet.remainingAmount - (packet.remainingShares - 1) * minShare;

        randomNonce++;
        uint256 seed = uint256(
            keccak256(
                abi.encodePacked(
                    block.prevrandao,
                    block.timestamp,
                    msg.sender,
                    packet.remainingAmount,
                    packet.remainingShares,
                    randomNonce
                )
            )
        );

        return (seed % maxShare) + minShare;
    }

    function _averageAmount(RedPacket storage packet) private view returns (uint256) {
        if (packet.remainingShares == 1) {
            return packet.remainingAmount;
        }
        return packet.totalAmount / packet.totalShares;
    }

    function _payout(address token, address to, uint256 amount) private {
        if (token == address(0)) {
            (bool sent, ) = payable(to).call{value: amount}("");
            require(sent, "eth payout failed");
        } else {
            require(IERC20(token).transfer(to, amount), "token payout failed");
        }
    }
}

