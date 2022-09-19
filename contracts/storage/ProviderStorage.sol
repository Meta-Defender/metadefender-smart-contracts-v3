// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

abstract contract ProviderStorage {
    struct providerInfo {
        uint index;
        uint participationTime;
        uint saUSDAmount;
        uint RDebt;
        uint SDebt;
        uint accSPS;
        uint shadow;
        bool isActive;
    }

    // a mapping from user to his provider info
    mapping(address => providerInfo) public providerInfos;

    mapping(address => bool) public usedToBeProvider;

    uint public providerCount;
}
