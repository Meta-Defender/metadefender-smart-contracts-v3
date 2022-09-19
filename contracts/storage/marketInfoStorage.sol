// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

abstract contract marketInfoStorage {
    struct marketInfo {
        uint accRPS;
        uint accSPS;
        uint accSPSDown;
        uint totalCoverage;
        uint kLast;
        uint claimableTeamReward;
        uint latestUnfrozenIndex;
        uint exchangeRate;
    }

    mapping(address => marketInfo) public marketInfos;
}
