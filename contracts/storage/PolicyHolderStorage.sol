// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

abstract contract PolicyStorage {
    struct policyInfo {
        uint id;
        address beneficiary;
        uint coverage;
        uint deposit;
        uint startTime;
        uint effectiveUntil;
        uint latestProviderIndex;
        uint deltaAccSPS;
        bool isClaimed;
        bool inClaimApplying;
        bool isCancelled;
    }

    policyInfo[] public policies;

    mapping(address => uint[]) public userPolicies;

    uint public policyCount;
}
