// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.9;


import "hardhat/console.sol";

import "./Lib/SafeDecimalMath.sol";
import "./interfaces/IMetaDefenderGlobals.sol";
import "./interfaces/IEpochManage.sol";

contract MetaDefenderGlobals is IMetaDefenderGlobals {

    using SafeMath for uint;
    using SafeDecimalMath for uint;

    bool public initialized = false;
    address public official;

    IEpochManage internal epochManage;

    GlobalInfoCache internal _globalInfoCache;
    GlobalInfo internal _globalInfo;

    /**
     * @dev Initialize the contract.
     * @param _official the address of official
     * @param _currentFee the currentFee at the begin of the protocol.
     * @param _minimumFee the minimumFee in buying the cover.
     */
    function init(
        address _official,
        uint _currentFee,
        uint _minimumFee,
        IEpochManage _epochManage,
        uint _initialExchangeRate
    ) external {
        if (initialized) {
            revert ContractAlreadyInitialized();
        }
        official = _official;
        epochManage = _epochManage;
        _globalInfo.currentFee = _currentFee;
        _globalInfo.minimumFee = _minimumFee;
        _globalInfo.exchangeRate = _initialExchangeRate;
        initialized = true;
    }

    function getGlobalInfo() external view override returns(GlobalInfo memory) {
        return _globalInfo;
    }

    function getGlobalInfoCache() external view override returns(GlobalInfoCache memory) {
        return _globalInfoCache;
    }

    /**
     * @dev update the minimumFee
     * @param _minimumFee is the new minimum fee
     */
    function updateMinimumFee(uint _minimumFee) external override {
        if (msg.sender != official) {
            revert InsufficientPrivilege();
        }
        _globalInfo.minimumFee = _minimumFee;
    }

    /**
     * @dev estimateFee get the fee one will pay for the coverage he/she covers.
     * @param coverage The amount of money one wants to cover.
     */
    function estimateFee(uint coverage) external view override returns (uint) {
        return _globalInfo.currentFee.multiplyDecimal(_globalInfo.usableCapital).divideDecimal(_globalInfo.usableCapital.sub(coverage));
    }

    /**
     * @dev calculateFee get the fee one will pay for the coverage he/she covers.
     * @param coverage The amount of money one wants to cover.
     * @param isBuy The flag if the user is buying(true)/cancelling(false) the policy.
     */
    function calculateFee(uint coverage, bool isBuy) external override returns (uint) {
        if (isBuy == true) {
            _globalInfo.currentFee = _globalInfo.currentFee.multiplyDecimal(_globalInfo.usableCapital).divideDecimal(_globalInfo.usableCapital.sub(coverage));
            _globalInfo.usableCapital = _globalInfo.usableCapital.sub(coverage);
        } else {
            uint fee = _globalInfo.currentFee.multiplyDecimal(_globalInfo.usableCapital).divideDecimal(_globalInfo.usableCapital.add(coverage));
            _globalInfo.usableCapital = _globalInfo.usableCapital.add(_globalInfo.usableCapital);
            if (fee <= _globalInfo.minimumFee) {
                _globalInfo.currentFee = _globalInfo.minimumFee;
            } else {
                _globalInfo.currentFee = fee;
            }
        }
        return _globalInfo.currentFee;
    }

    /**
     * @dev certificateProviderEntrance add pending free capital to globals when one provide the capital to the pool.
     * @param amount The amount of money one wants to provide for the pool.
     */
    function certificateProviderEntrance(uint amount) external override checkNewEpoch() {
        _globalInfoCache.provideCapital = _globalInfoCache.provideCapital.add(amount);
    }

    /**
     * @dev certificateProviderExit add pending retrieved capital to globals and add frozen capital to frozen when someone exit from the pool.
     * @param withdrawal The amount of money one wants to withdraw from the pool.
     * @param frozen The amount of money one still locked in the pool.
     */
    function certificateProviderExit(uint withdrawal, uint frozen) external override checkNewEpoch() {
        _globalInfoCache.retrieveCapital = _globalInfoCache.retrieveCapital.add(withdrawal);
        _globalInfoCache.frozenCapital = _globalInfoCache.frozenCapital.add(frozen);
    }

    /**
     * @dev buyPolicy. totalCoverage will change instantly, while pending accSPS, accRPS and reward4Team will change in the next epoch.
     * @param deltaSPS = deltaTotalCoverage / totalLiquidity.
     * @param deltaRPS = reward4LPs / totalLiquidity.
     * @param reward4Team reward4Team
     */
    function buyPolicy(uint deltaRPS, uint deltaSPS, uint reward4Team) external override checkNewEpoch() {
        _globalInfo.accRPS = _globalInfo.accRPS.add(deltaRPS);
        _globalInfo.accSPS = _globalInfo.accSPS.add(deltaSPS);
        _globalInfo.reward4Team = _globalInfo.reward4Team.add(reward4Team);
    }

    /**
     * @dev teamClaim. Change the team claim reward to zero when the team decides to withdraw.
     */
    function teamClaim() external override {
        _globalInfo.reward4Team = 0;
    }

    /**
     * @dev settlePolicy. settlePolicy will change usableCapital instantly and it will reduce update the accSPS in the next epoch.
     * @param totalCoverage The amount of money one wants to free.
     * @param deltaSPS = The shadow locked in the policy
     */
    function settlePolicy(uint deltaSPS, uint enteredEpochIndex) external override checkNewEpoch() {
        _globalInfo.accSPS = _globalInfo.accSPS.sub(deltaSPS);
        epochManage.updateCrossShadow(deltaSPS, enteredEpochIndex);
    }

    /**
     * @dev approveApply. change the usableCapital and FreeCapital
     * @param totalCoverage. The amount of coverage which user buys for.
     */
    function approveApply(uint deltaSPS) external override checkNewEpoch() {
        _globalInfo.accSPS = _globalInfo.accSPS.sub(deltaSPS);
    }


    /**
     * @dev excessPayment. Record how much money are lost during the approve.
     * @param excess. The amount of money which exceeds what the risk reserve.
     */
    function excessPayment(uint excess) external override checkNewEpoch() {
        uint totalCapital = _globalInfo.freeCapital.add(_globalInfo.frozenCapital);
        _globalInfoCache.lossCapitalInFree = _globalInfoCache.lossCapitalInFree.add(excess.multiplyDecimal(_globalInfo.freeCapital).divideDecimal(totalCapital));
        _globalInfoCache.lossCapitalInFrozen = _globalInfoCache.lossCapitalInFrozen.add(excess.multiplyDecimal(_globalInfo.frozenCapital).divideDecimal(totalCapital));
    }

    modifier checkNewEpoch() virtual {
        epochManage.checkAndCreateNewEpoch();
        _;
    }

    /**
     * @dev newEpochCreated. update the latest param to _globalInfo, reset all the cache.
     * @param epochIndex. the epochIndex.
     */
    function newEpochCreated(uint256 epochIndex) external override {
        // add and remove pendingFreeCapital and pendingRetrieveCapital;
        if (_globalInfo.usableCapital.add(_globalInfoCache.provideCapital) > _globalInfoCache.retrieveCapital) {
            _globalInfo.usableCapital = _globalInfo.usableCapital.add(_globalInfoCache.provideCapital).sub(_globalInfoCache.retrieveCapital);
        } else {
            _globalInfo.usableCapital = 0;
        }
        // update the exchangeRate: exchangeRate = exchangeRate * ((frozenCapital + freeCapital) - (freeLoss + frozenLoss)) / (freeCapital + frozenCapital);
        // exclude the first epoch
        if (epochIndex > 2) {
            _globalInfo.exchangeRate = _globalInfo.exchangeRate.sub((_globalInfoCache.lossCapitalInFree.add(_globalInfoCache.lossCapitalInFrozen)).divideDecimal(_globalInfo.freeCapital.add(_globalInfo.frozenCapital)));
        } else {
            _globalInfo.exchangeRate = SafeDecimalMath.UNIT;
        }

        // update the free capital and frozen capital
        if (_globalInfo.freeCapital.add(_globalInfoCache.provideCapital) > _globalInfoCache.retrieveCapital.add(_globalInfoCache.lossCapitalInFree)) {
            _globalInfo.freeCapital = _globalInfo.freeCapital.add(_globalInfoCache.provideCapital).sub(_globalInfoCache.retrieveCapital).sub(_globalInfoCache.lossCapitalInFree);
        } else {
            _globalInfo.freeCapital = 0;
        }
        _globalInfo.frozenCapital = _globalInfo.frozenCapital.add(_globalInfoCache.frozenCapital).sub(_globalInfoCache.lossCapitalInFrozen);

        _globalInfoCache.provideCapital = 0;
        _globalInfoCache.retrieveCapital = 0;
        _globalInfoCache.frozenCapital = 0;

        _globalInfoCache.lossCapitalInFree = 0;
        _globalInfoCache.lossCapitalInFrozen = 0;

        _globalInfo.accRPS = _globalInfoCache.accRPS;
        _globalInfoCache.accSPS = _globalInfoCache.accSPS;
    }

    error ContractAlreadyInitialized();
    error InsufficientPrivilege();
}
