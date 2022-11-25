//SPDX-License-Identifier: ISC
pragma solidity 0.8.9;

interface IMetaDefenderGlobals {

    // caches are temps to store params for an epoch.
    struct GlobalInfoCache {
        // updates when lp provides and withdraws.
        // when the lp provides, provideCapital += amount, when the lp leaves, retrieveCapital += liquidity * η; frozenCapital += frozen;
        uint provideCapital;
        uint retrieveCapital;
        uint frozenCapital;


        // updates when a new policy is generated/ a policy is settled.
        uint accRPS;
        uint accSPS;

        // updates when a policy is claimed and the reserve is not enough.
        uint lossCapitalInFree;
        uint lossCapitalInFrozen;
    }

    struct GlobalInfo {
        // will change instantly.
        uint usableCapital;
        uint reward4Team;
        uint totalCapital;

        // lastEpoch
        uint accRPS;
        uint accSPS;
        uint freeCapital;
        uint frozenCapital;

        // fees
        uint currentFee;
        uint minimumFee;

        // η
        uint exchangeRate;
    }

    function getGlobalInfoCache() external view returns(GlobalInfoCache memory);

    function getGlobalInfo() external view returns(GlobalInfo memory);

    function calculateFee(uint256 coverage, bool isBuy) external returns(uint);

    function estimateFee(uint256 coverage) external view returns (uint);

    function certificateProviderEntrance(uint256 amount) external;

    function certificateProviderExit(uint256 amount, uint256 frozen) external;

    function buyPolicy(uint256 totalCoverage, uint256 deltaRPS, uint256 deltaSPS, uint256 reward4Team) external;

    function settlePolicy(uint256 totalCoverage, uint256 deltaSPS, uint256 enteredEpochIndex) external;

    function approveApply(uint256 totalCoverage) external;

    function teamClaim() external;

    function updateMinimumFee(uint _minimumFee) external;

    function excessPayment(uint256 excess) external;

    function newEpochCreated(uint256 epochIndex) external;
}
