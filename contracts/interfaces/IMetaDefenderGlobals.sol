//SPDX-License-Identifier: ISC
pragma solidity 0.8.9;

interface IMetaDefenderGlobals {

    struct GlobalInfo {
        uint256 lastEpochUsableCapital;
        uint256 lastEpochAccRPS;
        uint256 lastEpochAccSPS;
        uint256 lastEpochAccSPSFreed;
        uint256 lastEpochReward4Team;

        uint256 pendingFreeCapital;
        uint256 pendingRetrieveCapital;
        uint256 pendingFrozenCapital;

        uint256 pendingTotalCoverage;
        uint256 pendingDeltaAccRPS;
        uint256 pendingDeltaAccSPS;
        uint256 pendingDeltaAccSPSFreed;
        uint256 pendingReward4Team;

        // fees
        uint256 currentFee;
        uint256 minimumFee;

        // η
        uint256 exchangeRate;
    }

    function calculateFee(uint256 coverage) external returns(uint);

    function updateGlobalsCertificateProviderEntrance(uint256 amount) external;

    function updateGlobalsCertificateProviderExit(uint256 amount, uint256 frozen) external;

    function updateGlobalsBuyCover(uint256 pendingDeltaTotalCoverage, uint256 pendingDeltaRPS, uint256 pendingDeltaSPS, uint256 pendingReward4Team) external;

    function getMetaDefenderGlobals() external view returns(GlobalInfo memory);

    function newEpochCreated() external;
}
