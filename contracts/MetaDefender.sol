//SPDX-License-Identifier: ISC
pragma solidity ^0.8.9;

import "hardhat/console.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "./storage/PolicyHolderStorage.sol";
import "./storage/ProviderStorage.sol";
import "./interfaces/IMetaDefender.sol";
import "./interfaces/IRiskReserve.sol";
import "./Lib/SafeDecimalMath.sol";
import "./interfaces/ILiquidityToken.sol";
import "./interfaces/IMetaDefenderGlobals.sol";
import "./storage/marketInfoStorage.sol";
import "./storage/ProviderStorage.sol";

contract MetaDefender is IMetaDefender, ReentrancyGuard, PolicyStorage, ProviderStorage, Ownable, marketInfoStorage {
    using SafeMath for uint;
    using SafeDecimalMath for uint;

    IERC20 internal aUSD;
    ILiquidityToken internal saUSD;
    IRiskReserve internal riskReserve;
    IMetaDefenderGlobals internal metaDefenderGlobals;
    bool public initialized = false;
    address public judger;
    address public official;
    address public marketAddress;
    uint public TEAM_RESERVE_RATE = 5e16;
    uint public FEE_RATE = 5e16;
    uint public MAX_COVERAGE_PERCENTAGE = 2e17;
    uint public COVER_TIME = 90 days;

    Liquidity public override liquidity;

    /// @dev Counter for reentrancy guard.
    uint internal counter = 1;

    // validMiningProxy
    mapping(address => bool) internal validMiningProxy;

    constructor() {}

    // the Pool have three functions;
    // 1. save the money for coverage
    // 2. receive the money of the policyholder
    // 3. keep the money for funds which have not been withdrawn yet

    /**
     * @dev Initialize the contract.
     *
     * @param _aUSD the IERC20 instance of AcalaUSD
     * @param _judger the address of judger
     * @param _official the address of official
     * @param _riskReserve the address of risk reserve pool
     */
    function init(
        IERC20 _aUSD,
        ILiquidityToken _saUSD,
        address _judger,
        address _official,
        // the contractAddress wanna to be insured.
        address _marketAddress,
        address _riskReserve,
        IMetaDefenderGlobals _IMetaDefenderGlobals
    ) external {
        if (initialized) {
            revert ContractAlreadyInitialized();
        }
        aUSD = _aUSD;
        saUSD = _saUSD;
        judger = _judger;
        official = _official;
        marketAddress = _marketAddress;
        riskReserve = IRiskReserve(_riskReserve);
        metaDefenderGlobals = _IMetaDefenderGlobals;
        marketInfos[marketAddress].exchangeRate = SafeDecimalMath.UNIT;
        initialized = true;
    }

    /**
     * @dev transfer judger to another address
     * @param _judger is the origin judger of the pool
     */
    function transferJudger(address _judger) external {
        if (msg.sender != judger) {
            revert InsufficientPrivilege();
        }
        judger = _judger;
    }

    /**
     * @dev transfer official to another address
     * @param _official is the origin official of the pool
     */
    function transferOfficial(address _official) external {
        if (msg.sender != official) {
            revert InsufficientPrivilege();
        }
        official = _official;
    }

    /**
     * @dev claim team rewards
     */
    function teamClaiming() external {
        if (msg.sender != official) {
            revert InsufficientPrivilege();
        }
        aUSD.transfer(official, marketInfos[marketAddress].claimableTeamReward);
        marketInfos[marketAddress].claimableTeamReward = 0;
    }

    /**
     * @dev validate the mining route
     * @param _proxy is the proxy address
     * @param _isValid is the mining route is valid or not
     */
    function validMiningProxyManage(address _proxy, bool _isValid) external onlyOwner {
        validMiningProxy[_proxy] = _isValid;
    }

    /**
     * @dev get the usable capital of the pool
     */
    function getUsableCapital() public view override returns (uint) {
        uint a = marketInfos[marketAddress].totalCoverage;
        return
            liquidity.aUSDTotalLiquidity >= marketInfos[marketAddress].totalCoverage
                ? liquidity.aUSDTotalLiquidity.sub(marketInfos[marketAddress].totalCoverage)
                : 0;
    }

    function getLiquidity() public view override returns (Liquidity memory) {
        return liquidity;
    }

    /**
     * @dev get the fee rate of the pool
     */
    function getFee() public view returns (uint) {
        uint UsableCapital = getUsableCapital();
        if (UsableCapital == 0) {
            revert InsufficientUsableCapital();
        }
        return marketInfos[marketAddress].kLast.divideDecimal(UsableCapital);
    }

    /**
     * @dev buy Cover
     * @param _coverage is the coverage to be secured
     */
    function buyCover(uint _coverage) external override {
        uint UsableCapital = getUsableCapital();
        if (UsableCapital == 0) {
            revert InsufficientUsableCapital();
        }
        if (_coverage > UsableCapital.multiplyDecimal(MAX_COVERAGE_PERCENTAGE)) {
            revert CoverageTooLarge(_coverage, UsableCapital.multiplyDecimal(MAX_COVERAGE_PERCENTAGE));
        }
        uint fee = getFee();
        uint coverFee = _coverage.multiplyDecimal(fee);
        uint deposit = coverFee.multiplyDecimal(FEE_RATE);
        uint totalPay = coverFee.add(deposit);

        aUSD.transferFrom(msg.sender, address(this), totalPay);

        marketInfos[marketAddress].totalCoverage = marketInfos[marketAddress].totalCoverage.add(_coverage);

        uint deltaAccSPS = _coverage.divideDecimal(saUSD.totalSupply());

        marketInfos[marketAddress].accSPS = marketInfos[marketAddress].accSPS.add(deltaAccSPS);

        uint rewardForTeam = coverFee.multiplyDecimal(TEAM_RESERVE_RATE);
        marketInfos[marketAddress].claimableTeamReward = marketInfos[marketAddress].claimableTeamReward.add(
            rewardForTeam
        );
        uint rewardForProviders = coverFee.sub(rewardForTeam);
        uint deltaAccRPS = rewardForProviders.divideDecimal(saUSD.totalSupply());
        marketInfos[marketAddress].accRPS = marketInfos[marketAddress].accRPS.add(deltaAccRPS);

        // record this policy
        policyInfo memory newPolicy = policyInfo({
            id: policyCount,
            beneficiary: msg.sender,
            coverage: _coverage,
            deposit: deposit,
            startTime: block.timestamp,
            effectiveUntil: block.timestamp.add(COVER_TIME),
            latestProviderIndex: providerCount.sub(1),
            deltaAccSPS: deltaAccSPS,
            isClaimed: false,
            inClaimApplying: false,
            isCancelled: false
        });
        policies.push(newPolicy);

        // record this policy to the very policyholder
        userPolicies[msg.sender].push(policyCount);
        policyCount++;
        emit CoverBought(newPolicy);
    }

    /**
     * @dev provider enters and provide the capitals
     * @param _amount the amount of ausd to be provided
     */
    function providerEntrance(uint _amount) public {
        // An address will only to be act as a provider only once
        providerInfo storage provider = providerInfos[msg.sender];
        if (provider.participationTime != 0) {
            revert ProviderDetected(address(msg.sender));
        }

        aUSD.transferFrom(msg.sender, address(this), _amount);
        providerInfo memory newProvider = providerInfo({
            index: providerCount,
            participationTime: block.timestamp,
            saUSDAmount: _amount.divideDecimal(marketInfos[marketAddress].exchangeRate),
            RDebt: _amount.divideDecimal(marketInfos[marketAddress].exchangeRate).multiplyDecimal(
                marketInfos[marketAddress].accRPS
            ),
            SDebt: _amount.divideDecimal(marketInfos[marketAddress].exchangeRate).multiplyDecimal(
                marketInfos[marketAddress].accSPS
            ),
            accSPS: 0,
            shadow: 0,
            isActive: true
        });

        providerInfos[msg.sender] = newProvider;
        saUSD.mint(msg.sender, newProvider.saUSDAmount);

        uint pre = getUsableCapital();
        liquidity.aUSDTotalLiquidity = liquidity.aUSDTotalLiquidity.add(_amount);
        uint cur = getUsableCapital();
        _updateKLastByProvider(pre, cur);
        providerCount++;

        emit ProviderEntered(newProvider);
    }

    /**
     * @dev updateKLast by provider: when a new provider comes in, the fee will stay same while the k will become larger.
     * @param _preUsableCapital is the previous usable capital
     * @param _currentUsableCapital is the current usable capital
     */
    function _updateKLastByProvider(uint _preUsableCapital, uint _currentUsableCapital) internal {
        uint initialFee = metaDefenderGlobals.initialFee(address(aUSD));
        // TODO: if providerCount will equal to zero?
        if (providerCount == 0) {
            marketInfos[marketAddress].kLast = initialFee.multiplyDecimal(_currentUsableCapital);
        } else {
            uint fee = marketInfos[marketAddress].kLast.divideDecimal(_preUsableCapital);
            marketInfos[marketAddress].kLast = fee.multiplyDecimal(_currentUsableCapital);
        }
    }

    /**
     * @dev getRewards calculates the rewards for the provider
     * @param _provider the provider address
     */
    function getRewards(address _provider) public view override returns (uint) {
        providerInfo storage provider = providerInfos[_provider];
        if (provider.index != 0 && provider.isActive) {
            revert ProviderNotExistOrActive(_provider);
        }
        return
            provider.saUSDAmount.multiplyDecimal(marketInfos[marketAddress].accRPS) > (provider.RDebt)
                ? provider.saUSDAmount.multiplyDecimal(marketInfos[marketAddress].accRPS).sub(provider.RDebt)
                : 0;
    }

    /**
     * @dev claimRewards retrieve the rewards for the providers in the pool
     *
     */
    function claimRewards() external override reentrancyGuard {
        providerInfo storage provider = providerInfos[msg.sender];
        uint reward = getRewards(msg.sender);
        provider.RDebt = provider.saUSDAmount.multiplyDecimal(marketInfos[marketAddress].accRPS);
        aUSD.transfer(msg.sender, reward);
    }

    /**
     * @dev providerExit retrieve the rewards for the providers in the pool
     *
     */
    function providerExit() external override reentrancyGuard {
        providerInfo storage provider = providerInfos[msg.sender];
        if (provider.participationTime == 0 || (!provider.isActive)) {
            revert ProviderNotExistOrActive(msg.sender);
        }

        (uint withdrawal, uint shadow) = getWithdrawalAndShadow(msg.sender);
        uint reward = provider.saUSDAmount.multiplyDecimal(marketInfos[marketAddress].accRPS).sub(provider.RDebt);

        // create historicalInfos for this provider
        _registerHistoricalProvider(provider, shadow);

        // update the liquidity
        uint pre = getUsableCapital();
        liquidity.aUSDTotalLiquidity = liquidity.aUSDTotalLiquidity.sub(
            provider.saUSDAmount.multiplyDecimal(marketInfos[marketAddress].exchangeRate)
        );
        liquidity.aUSDLockedLiquidity = liquidity.aUSDLockedLiquidity.add(shadow);
        uint cur = getUsableCapital();
        _updateKLastByProvider(pre, cur);

        saUSD.burn(msg.sender, provider.saUSDAmount);
        provider.saUSDAmount = 0;
        provider.RDebt = 0;

        aUSD.transfer(msg.sender, withdrawal.add(reward));
        emit ProviderExit(msg.sender);
    }

    /**
     * @dev build the historicalInfos for this provider
     * @param _provider the provider info
     * @param _shadow the shadow of the user
     */
    function _registerHistoricalProvider(providerInfo storage _provider, uint _shadow) internal {
        _provider.shadow = _shadow.divideDecimal(marketInfos[marketAddress].exchangeRate);
        _provider.accSPS = marketInfos[marketAddress].accSPS;
        _provider.isActive = false;
    }

    /**
     * @dev get the unfrozen capital for the provider
     * @param _provider the provider address
     */
    function getWithdrawalAndShadow(address _provider) public view override returns (uint, uint) {
        providerInfo storage provider = providerInfos[_provider];
        uint shadow = _getShadow(provider);
        uint withdrawal = provider.saUSDAmount.multiplyDecimal(marketInfos[marketAddress].exchangeRate) >= shadow
            ? provider.saUSDAmount.multiplyDecimal(marketInfos[marketAddress].exchangeRate) - shadow
            : 0;
        return (withdrawal, shadow);
    }

    /**
     * @dev get the shadow of a certain provider
     * @param _provider the provider address
     */
    function _getShadow(providerInfo storage _provider) internal view returns (uint) {
        return
            _provider.index > marketInfos[marketAddress].latestUnfrozenIndex
                ? _provider.saUSDAmount.multiplyDecimal(marketInfos[marketAddress].accSPS).sub(_provider.SDebt)
                : _provider.saUSDAmount.multiplyDecimal(
                    marketInfos[marketAddress].accSPS.sub(marketInfos[marketAddress].accSPSDown)
                );
    }

    /**
     * @dev getWithdrawAndShadowHistorical calculate the unfrozen capital of a certain provider
     * @param _provider the historical provider address
     */
    function getWithdrawalAndShadowHistorical(address _provider) public view override returns (uint, uint) {
        providerInfo storage providerInfo = providerInfos[_provider];
        if (providerInfo.participationTime == 0 || providerInfo.isActive) {
            revert ProviderNotStale(providerInfo.index);
        }
        uint shadow = _getShadowHistorical(providerInfo);
        uint withdrawal = providerInfo.shadow.multiplyDecimal(marketInfos[marketAddress].exchangeRate) > shadow
            ? providerInfo.shadow.multiplyDecimal(marketInfos[marketAddress].exchangeRate).sub(shadow)
            : 0;
        return (shadow, withdrawal);
    }

    /**
     * @dev _getShadowHistoricalProvider calculate the historical shadow of a certain provider
     * @param _providerInfo the providerInfo
     */
    function _getShadowHistorical(providerInfo storage _providerInfo) internal view returns (uint) {
        if (_providerInfo.participationTime == 0 || _providerInfo.isActive) {
            revert ProviderNotStale(_providerInfo.index);
        }
        if (_providerInfo.index > marketInfos[marketAddress].latestUnfrozenIndex) {
            return _providerInfo.saUSDAmount.multiplyDecimal(_providerInfo.accSPS).sub(_providerInfo.SDebt);
        } else {
            return
                _providerInfo.accSPS >= marketInfos[marketAddress].accSPSDown
                    ? _providerInfo.saUSDAmount.multiplyDecimal(
                        _providerInfo.accSPS.sub(marketInfos[marketAddress].accSPSDown)
                    )
                    : 0;
        }
    }

    /**
     * @dev historical provider withdraw the unfrozen capital
     */
    function historicalProviderWithdraw() external override reentrancyGuard {
        providerInfo storage providerInfo = providerInfos[msg.sender];
        if (providerInfo.index == 0 || providerInfo.isActive) {
            revert ProviderNotStale(providerInfo.index);
        }
        (uint withdrawal, uint shadow) = getWithdrawalAndShadowHistorical(msg.sender);
        aUSD.transfer(msg.sender, withdrawal);

        // liquidity.aUSDLockedLiquidity = liquidity.aUSDLockedLiquidity.sub(withdrawal);
        // totalLiquidity = totalLiquidity - withdrawal;
        liquidity.aUSDLockedLiquidity = liquidity.aUSDLockedLiquidity.sub(withdrawal);
        providerInfo.shadow = shadow.divideDecimal(marketInfos[marketAddress].exchangeRate);
    }

    /**
     * @dev cancel the policy by a policy id
     */
    function cancelPolicy(uint _id) external override {
        policyInfo storage policy = policies[_id];
        if (policy.isCancelled) {
            revert PolicyAlreadyCancelled(_id);
        }
        if (_id == 0) {
            _executeCancel(policy);
        } else {
            if (!policy.isCancelled) {
                revert PreviousPolicyNotCancelled(_id);
            }
            _executeCancel(policy);
        }

        emit PolicyCancelled(_id);
    }

    /**
     * @dev execute cancelling the policy
     *
     * @param policy the policy to be cancelled
     */
    function _executeCancel(policyInfo storage policy) internal {
        if (policy.effectiveUntil > block.timestamp || policy.inClaimApplying == true) {
            revert PolicyCanNotBeCancelled(policy.id);
        }
        // in one day we only allow the policyholder to cancel the policy;
        if (block.timestamp.sub(policy.effectiveUntil) <= 86400) {
            if (msg.sender == policy.beneficiary) {
                _doPolicyCancel(policy, msg.sender);
            } else {
                revert PolicyCanOnlyCancelledByHolder(policy.id);
            }
        } else {
            _doPolicyCancel(policy, msg.sender);
        }
    }

    /**
     * @dev cancel the policy
     *
     * @param _policy the policy to be cancelled
     * @param _caller the caller address
     */
    function _doPolicyCancel(policyInfo storage _policy, address _caller) internal {
        marketInfos[marketAddress].totalCoverage = marketInfos[marketAddress].totalCoverage.sub(_policy.coverage);
        marketInfos[marketAddress].accSPSDown = marketInfos[marketAddress].accSPSDown.add(_policy.deltaAccSPS);
        _policy.isCancelled = true;
        marketInfos[marketAddress].latestUnfrozenIndex = _policy.latestProviderIndex;
        _updateKLastByCancel(marketInfos[marketAddress].totalCoverage);
        aUSD.transfer(_caller, _policy.deposit);
    }

    /**
     * @dev update klast by cancelling the policy
     *
     * @param _totalCoverage the total coverage of the policies
     */
    function _updateKLastByCancel(uint _totalCoverage) internal {
        if (liquidity.aUSDTotalLiquidity <= _totalCoverage) {
            revert InsufficientLiquidity(liquidity.aUSDTotalLiquidity);
        }
        // minimum klast is minimumFee * (availableLiquidity - totalCoverage);
        if (
            marketInfos[marketAddress].kLast <
            metaDefenderGlobals.minimumFee(address(aUSD)).multiplyDecimal(
                liquidity.aUSDTotalLiquidity.sub(_totalCoverage)
            )
        ) {
            marketInfos[marketAddress].kLast = metaDefenderGlobals.minimumFee(address(aUSD)).multiplyDecimal(
                liquidity.aUSDTotalLiquidity.sub(_totalCoverage)
            );
        }
    }

    /**
     * @dev the process the policy holder applies for.
     *
     * @param _id the policy id
     */
    function policyClaimApply(uint _id) external override {
        policyInfo storage policy = policies[_id];
        if (policy.startTime == 0) {
            revert InvalidPolicy(_id);
        }
        if (block.timestamp > policy.effectiveUntil) {
            revert PolicyAlreadyStale(_id);
        }
        if (msg.sender != policy.beneficiary) {
            revert SenderNotBeneficiary(msg.sender, policy.beneficiary);
        }
        if (policy.isClaimed == true) {
            revert PolicyAlreadyClaimed(_id);
        }
        if (policy.inClaimApplying == true) {
            revert ClaimUnderProcessing(_id);
        }
        if (policy.isCancelled == true) {
            revert PolicyAlreadyCancelled(_id);
        }
        policy.inClaimApplying = true;
    }

    /**
     * @dev the refusal of the policy apply.
     *
     * @param id the policy id
     */
    function refuseApply(uint id) external override {
        if (msg.sender != judger) {
            revert InsufficientPrivilege();
        }
        policyInfo storage policy = policies[id];
        policy.inClaimApplying = false;
    }

    /**
     * @dev the approval of the policy apply.
     *
     * @param _id the policy id
     */
    function approveApply(uint _id) external override {
        if (msg.sender != judger) {
            revert InsufficientPrivilege();
        }
        policyInfo storage policy = policies[_id];
        if (policy.inClaimApplying == false) {
            revert ClaimNotUnderProcessing(_id);
        }
        policy.inClaimApplying = false;
        policy.isClaimed = true;

        if (aUSD.balanceOf(address(riskReserve)) >= policy.coverage) {
            aUSD.transferFrom(address(riskReserve), policy.beneficiary, policy.coverage);
        } else {
            aUSD.transferFrom(address(riskReserve), policy.beneficiary, aUSD.balanceOf(address(riskReserve)));
            uint exceeded = policy.coverage.sub(aUSD.balanceOf(address(riskReserve)));
            _exceededPay(policy.beneficiary, exceeded);
        }
    }

    /**
     * @dev the process if the risk reserve is not enough to pay the policy holder. In this case we will use capital pool.
     *
     * @param to the policy beneficiary address
     * @param exceeded the exceeded amount of aUSD
     */
    function _exceededPay(address to, uint exceeded) internal {
        uint totalLiquidity = liquidity.aUSDTotalLiquidity.add(liquidity.aUSDLockedLiquidity);

        // update exchangeRate
        marketInfos[marketAddress].exchangeRate = marketInfos[marketAddress].exchangeRate.multiplyDecimal(
            SafeDecimalMath.UNIT.sub(exceeded.divideDecimal(totalLiquidity))
        );
        marketInfos[marketAddress].exchangeRate = marketInfos[marketAddress].exchangeRate.multiplyDecimal(
            SafeDecimalMath.UNIT.sub(exceeded.divideDecimal(totalLiquidity))
        );

        // update liquidity
        liquidity.aUSDTotalLiquidity = liquidity.aUSDTotalLiquidity.multiplyDecimal(
            SafeDecimalMath.UNIT.sub(exceeded.divideDecimal(totalLiquidity))
        );
        liquidity.aUSDLockedLiquidity = liquidity.aUSDLockedLiquidity.multiplyDecimal(
            SafeDecimalMath.UNIT.sub(exceeded.divideDecimal(totalLiquidity))
        );

        aUSD.transfer(to, exceeded);
    }

    /**
     * @dev mine with available capital.
     *
     * @param _to the proxy address
     * @param _amount the amount of ausd to be used for mining.
     */
    function mine(uint _amount, address _to) external override {
        if (msg.sender != judger) {
            revert InsufficientPrivilege();
        }
        if (validMiningProxy[_to] == false) {
            revert InvalidMiningProxy(_to);
        }
        aUSD.transfer(_to, _amount);
    }

    modifier reentrancyGuard() virtual {
        counter = counter.add(1);
        // counter adds 1 to the existing 1 so becomes 2
        uint guard = counter;
        // assigns 2 to the "guard" variable
        _;
        if (guard != counter) {
            revert ReentrancyGuardDetected();
        }
    }

    /**
     * @dev Emitted when the provider entered.
     */
    event ProviderEntered(providerInfo provider);

    /**
     * @dev Emitted when the user bought the cover.
     */
    event CoverBought(policyInfo policy);

    /**
     * @dev Emitted when the user bought the cover.
     */
    event ProviderExit(address providerAddress);

    /**
     * @dev Emitted when the user bought the cover.
     */
    event PolicyCancelled(uint id);

    /**
     * @notice errors
     */

    error ContractAlreadyInitialized();
    error InsufficientPrivilege();
    error InsufficientUsableCapital();
    error InsufficientLiquidity(uint id);
    error CoverageTooLarge(uint maxCoverage, uint coverage);
    error ProviderDetected(address providerAddress);
    error ProviderNotExistOrActive(address providerAddress);
    error ProviderNotStale(uint id);
    error PolicyAlreadyCancelled(uint id);
    error PreviousPolicyNotCancelled(uint id);
    error PolicyCanNotBeCancelled(uint id);
    error PolicyCanOnlyCancelledByHolder(uint id);
    error InvalidPolicy(uint id);
    error PolicyAlreadyStale(uint id);
    error SenderNotBeneficiary(address sender, address beneficiary);
    error PolicyAlreadyClaimed(uint id);
    error ClaimUnderProcessing(uint id);
    error ClaimNotUnderProcessing(uint id);
    error InvalidMiningProxy(address proxy);
    error ReentrancyGuardDetected();
}
