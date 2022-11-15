// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.9;


import "./Lib/SafeDecimalMath.sol";
import "./interfaces/IMetaDefenderGlobals.sol";


contract MetaDefenderGlobals is IMetaDefenderGlobals {

    using SafeMath for uint;
    using SafeDecimalMath for uint;

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


    function getMetaDefenderGlobals() external view override returns (GlobalInfo memory) {
        return GlobalInfo(
            {
                lastEpochUsableCapital:lastEpochUsableCapital,
                lastEpochAccRPS: lastEpochAccRPS,
                lastEpochAccSPS: lastEpochAccSPS,
                lastEpochAccSPSFreed: lastEpochAccSPSFreed,
                lastEpochReward4Team: lastEpochReward4Team,

                pendingFreeCapital: pendingFreeCapital,
                pendingRetrieveCapital: pendingRetrieveCapital,
                pendingFrozenCapital: pendingFrozenCapital,

                pendingTotalCoverage: pendingTotalCoverage,
                pendingDeltaAccRPS: pendingDeltaAccRPS,
                pendingDeltaAccSPS: pendingDeltaAccSPS,
                pendingDeltaAccSPSFreed: pendingDeltaAccSPSFreed,
                pendingReward4Team: pendingReward4Team,

                currentFee: currentFee,
                minimumFee: minimumFee,

                exchangeRate: exchangeRate
            });
    }

    /**
     * @dev calculateFee get the fee one will pay for the coverage he/she covers.
     * @param coverage The amount of money one wants to cover.
     */
    function calculateFee(uint256 coverage) external override returns (uint) {
        uint updatedLastEpochUsableCapital = lastEpochUsableCapital.sub(coverage);
        currentFee = currentFee.multiplyDecimal(lastEpochUsableCapital).divideDecimal(updatedLastEpochUsableCapital);
        lastEpochUsableCapital = updatedLastEpochUsableCapital;
        return currentFee;
    }

    /**
     * @dev updateGlobalsCertificateProviderEntrance add pending free capital to globals when one provide the capital to the pool.
     * @param amount The amount of money one wants to provide for the pool.
     */
    function updateGlobalsCertificateProviderEntrance(uint256 amount) external override {
        pendingFreeCapital = pendingFreeCapital.add(amount);
    }

    function updateGlobalsCertificateProviderExit(uint256 amount, uint256 frozen) external override {
        pendingRetrieveCapital = pendingRetrieveCapital + amount;
        pendingFrozenCapital = pendingFrozenCapital + frozen;
    }

    function updateGlobalsBuyCover(uint256 deltaTotalCoverage, uint256 deltaRPS, uint256 deltaSPS, uint256 reward4Team) external override {
        pendingTotalCoverage = pendingTotalCoverage.add(deltaTotalCoverage);
        pendingDeltaAccRPS = pendingDeltaAccRPS.add(deltaRPS);
        pendingDeltaAccSPS = pendingDeltaAccSPS.add(deltaSPS);
    }

    function newEpochCreated() external override {
        // add and remove
        lastEpochUsableCapital = lastEpochUsableCapital.add(pendingFreeCapital).sub(pendingRetrieveCapital);
        lastEpochAccSPS = lastEpochAccSPS.add(pendingDeltaAccSPS).sub(pendingDeltaAccSPSFreed);
        lastEpochAccRPS = lastEpochAccRPS.add(pendingDeltaAccRPS);
        lastEpochReward4Team = lastEpochReward4Team.add(pendingReward4Team);

        pendingDeltaAccRPS = 0;
        pendingDeltaAccSPS = 0;
        pendingTotalCoverage = 0;
        pendingReward4Team = 0;

        pendingFreeCapital = 0;
        pendingRetrieveCapital = 0;
        pendingFrozenCapital = 0;
    }
}
