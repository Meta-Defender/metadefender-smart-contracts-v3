//SPDX-License-Identifier: ISC
pragma solidity ^0.8.9;

// test contracts
import "hardhat/console.sol";

// openzeppelin contracts
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

// interfaces
import "./interfaces/IMetaDefender.sol";
import "./interfaces/IMockRiskReserve.sol";
import "./interfaces/ILiquidityCertificate.sol";
import "./interfaces/ILiquidityMedal.sol";
import "./interfaces/IPolicy.sol";

import "./Lib/SafeDecimalMath.sol";

contract MetaDefender is IMetaDefender, ReentrancyGuard, Ownable {
    using SafeMath for uint;
    using SafeDecimalMath for uint;

    IERC20 internal aUSD;
    // capital storage
    Capital public capital;
    // global params
    GlobalInfo public globalInfo;
    // validMiningProxy
    mapping(address => bool) public validMiningProxy;

    // interfaces
    ILiquidityCertificate internal liquidityCertificate;
    ILiquidityMedal internal liquidityMedal;
    IPolicy internal policy;
    IMockRiskReserve internal mockRiskReserve;

    bool public initialized = false;
    address public judger;
    address public official;
    address public protocol;
    uint public TEAM_RESERVE_RATE = 5e16;
    uint public FEE_RATE = 5e16;
    uint public MAX_COVERAGE_PERCENTAGE = 2e17;
    uint public COVER_TIME = 90 days;
    // index the providers
    uint public providerCount;
    // index the providers who exit the market
    uint public medalCount;

    /// @dev Counter for reentrancy guard.
    uint internal counter = 1;

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
     * @param _protocol the address of protocol
     * @param _mockRiskReserve the address of risk reserve pool
     */
    function init(
        // basic information
        IERC20 _aUSD,
        address _judger,
        address _official,
        // the contractAddress wanna to be insured.
        address _protocol,

        // riskReserve
        IMockRiskReserve _mockRiskReserve,

        // NFT LPs and policy NFT
        ILiquidityCertificate _liquidityCertificate,
        ILiquidityMedal _liquidityMedal,
        IPolicy _policy,

        // initialFee and minimum Fee
        uint initialFee,
        uint minimumFee
    ) external {
        if (initialized) {
            revert ContractAlreadyInitialized();
        }
        aUSD = _aUSD;
        judger = _judger;
        official = _official;

        protocol = _protocol;
        globalInfo.exchangeRate = SafeDecimalMath.UNIT;

        mockRiskReserve = _mockRiskReserve;
        liquidityCertificate = _liquidityCertificate;
        liquidityMedal = _liquidityMedal;
        policy = _policy;

        globalInfo.fee = initialFee;
        globalInfo.minimumFee = minimumFee;

        initialized = true;
    }

    /**
     * @dev transfer judger to another address
     * @param _judger is the origin judger of the pool
     */
    function transferJudger(address _judger) external override {
        if (msg.sender != judger) {
            revert InsufficientPrivilege();
        }
        judger = _judger;
    }

    /**
     * @dev transfer official to another address
     * @param _official is the origin official of the pool
     */
    function transferOfficial(address _official) external override {
        if (msg.sender != official) {
            revert InsufficientPrivilege();
        }
        official = _official;
    }

    /**
     * @dev claim team rewards
     */
    function teamClaim() external override {
        if (msg.sender != official) {
            revert InsufficientPrivilege();
        }
        aUSD.transfer(official, globalInfo.claimableTeamReward);
        globalInfo.claimableTeamReward = 0;
    }

    /**
     * @dev validate the mining route
     * @param proxy is the proxy address
     * @param isValid is the mining route is valid or not
     */
    function validMiningProxyManage(address proxy, bool isValid) external override {
        if (msg.sender != official) {
            revert InsufficientPrivilege();
        }
        validMiningProxy[proxy] = isValid;
    }

    /**
     * @dev update the minimumFee
     * @param minimumFee is the new minimum fee
     */
    function updateMinimumFee(uint minimumFee) external override {
        if (msg.sender != official) {
            revert InsufficientPrivilege();
        }
        globalInfo.minimumFee = minimumFee;
    }

    /**
     * @dev get the fee rate of the pool
     */
    function getFeeAndUsableCapital() public view returns (uint,uint) {
        uint UsableCapital = capital.freeCapital>= globalInfo.totalCoverage? capital.freeCapital.sub(globalInfo.totalCoverage): 0;
        if (UsableCapital == 0) {
            revert InsufficientUsableCapital();
        }
        return (globalInfo.kLast.divideDecimal(UsableCapital), UsableCapital);
    }

    /**
     * @dev buy Cover
     * @param coverage is the coverage to be secured
     */
    function buyCover(uint coverage) external override {
        (uint fee, uint uc) = getFeeAndUsableCapital();
        if (coverage > uc.multiplyDecimal(MAX_COVERAGE_PERCENTAGE)) {
            revert CoverageTooLarge(coverage, uc.multiplyDecimal(MAX_COVERAGE_PERCENTAGE));
        }
        uint coverFee = coverage.multiplyDecimal(fee);
        uint deposit = coverFee.multiplyDecimal(FEE_RATE);
        uint totalPay = coverFee.add(deposit);

        aUSD.transferFrom(msg.sender, address(this), totalPay);
        globalInfo.totalCoverage = globalInfo.totalCoverage.add(coverage);
        uint shadowImpact = coverage.divideDecimal(liquidityCertificate.totalCertificateLiquidity());
        globalInfo.shadowPerShare = globalInfo.shadowPerShare.add(shadowImpact);

        uint rewardForTeam = coverFee.multiplyDecimal(TEAM_RESERVE_RATE);
        globalInfo.claimableTeamReward = globalInfo.claimableTeamReward.add(rewardForTeam);
        uint rewardForProviders = coverFee.sub(rewardForTeam);
        uint rewardImpact = rewardForProviders.divideDecimal(liquidityCertificate.totalCertificateLiquidity());
        globalInfo.rewardPerShare = globalInfo.rewardPerShare.add(rewardImpact);

        // mint a new policy NFT
        uint policyId = policy.mint(
            msg.sender,
            coverage,
            deposit,
            block.timestamp,
            block.timestamp.add(COVER_TIME),
            shadowImpact
        );

        emit NewPolicyMinted(policyId);
    }

    /**
     * @dev provider enters and provide the capitals
     * @param amount the amount of ausd to be provided
     */
    function providerEntrance(address beneficiary, uint amount) external override {
        // An address will only to be act as a provider only once
        aUSD.transferFrom(msg.sender, address(this), amount);
        uint liquidity = amount.divideDecimal(globalInfo.exchangeRate);
        // we have to add total capital in this pool.
        capital.freeCapital = capital.freeCapital.add(amount);
        providerCount = liquidityCertificate.mint(
        beneficiary,
        liquidity,
        liquidity.multiplyDecimal(globalInfo.rewardPerShare),
        liquidity.multiplyDecimal(globalInfo.shadowPerShare));
        _updateKLastByProvider();
        emit ProviderEntered(providerCount);
    }

    /**
     * @dev updateKLast by provider: when a new provider comes in, the fee will stay same while the k will become larger.
     */
    function _updateKLastByProvider() internal {
        (, uint uc) = getFeeAndUsableCapital();
        globalInfo.kLast = globalInfo.fee.multiplyDecimal(uc);
    }

    /**
     * @dev getRewards calculates the rewards for the provider
     * @param certificateId the certificateId
     */
    function getRewards(uint certificateId) public view override returns (uint) {
        ILiquidityCertificate.CertificateInfo memory certificateInfo = liquidityCertificate.getCertificateInfo(certificateId);
        return
            certificateInfo.liquidity.multiplyDecimal(globalInfo.rewardPerShare) > (certificateInfo.rewardDebt)
                ? certificateInfo.liquidity.multiplyDecimal(globalInfo.rewardPerShare).sub(certificateInfo.rewardDebt)
                : 0;
    }

    /**
     * @dev claimRewards retrieve the rewards for the providers in the pool
     * @param certificateId the certificateId
     */
    function claimRewards(uint certificateId) external override reentrancyGuard {
        if (msg.sender != (liquidityCertificate.belongsTo(certificateId))) {
            revert InsufficientPrivilege();
        }
        uint rewards = getRewards(certificateId);
        liquidityCertificate.addRewardDebt(certificateId, rewards);
        aUSD.transfer(msg.sender, rewards);
    }

    /**
     * @dev providerExit retrieve the rewards for the providers in the pool
     * @param certificateId the certificateId
     */
    function certificateProviderExit(uint certificateId) external override reentrancyGuard {
        ILiquidityCertificate.CertificateInfo memory certificateInfo = liquidityCertificate.getCertificateInfo(certificateId);
        (uint withdrawal, ) = getWithdrawalAndShadowByCertificate(certificateId);
        uint rewards = getRewards(certificateId);
        uint reserve = certificateInfo.liquidity.multiplyDecimal(globalInfo.exchangeRate).sub(withdrawal);

        // update the freeCapital;
        capital.freeCapital = capital.freeCapital.sub(certificateInfo.liquidity.multiplyDecimal(globalInfo.exchangeRate));
        // update the frozenCapital;
        capital.frozenCapital = capital.frozenCapital.add(certificateInfo.liquidity.multiplyDecimal(globalInfo.exchangeRate)).sub(withdrawal);

        // now we will burn the liquidity certificate and mint a new medal for the provider
        address beneficiary = liquidityCertificate.belongsTo(certificateId);
        liquidityCertificate.burn(msg.sender, certificateId);

        medalCount = liquidityMedal.mint(
            beneficiary,
            certificateInfo.enteredAt,
            certificateInfo.liquidity,
            reserve,
            certificateInfo.shadowDebt,
            certificateInfo.liquidity.multiplyDecimal(globalInfo.shadowPerShare)
        );
        aUSD.transfer(msg.sender, withdrawal.add(rewards));
        _updateKLastByProvider();
        emit ProviderExit(msg.sender);
    }


    /**
     * @dev get the unfrozen capital for the provider
     * @param certificateId the certificateId
     */
    function getWithdrawalAndShadowByCertificate(uint certificateId) public view override returns (uint, uint) {
        ILiquidityCertificate.CertificateInfo memory certificateInfo = liquidityCertificate.getCertificateInfo(certificateId);
        uint shadow = certificateInfo.enteredAt > globalInfo.currentFreedTs
        ? certificateInfo.liquidity.multiplyDecimal(globalInfo.shadowPerShare).sub(certificateInfo.shadowDebt)
        : certificateInfo.liquidity.multiplyDecimal(globalInfo.shadowPerShare.sub(globalInfo.shadowFreedPerShare));
        uint withdrawal = certificateInfo.liquidity.multiplyDecimal(globalInfo.exchangeRate) > shadow
            ? certificateInfo.liquidity.multiplyDecimal(globalInfo.exchangeRate).sub(shadow)
            : 0;
        return (withdrawal, shadow);
    }

    /**
     * @dev medal/historical provider withdraw the unfrozen capital
     * @param medalId the medalId
     */
    function medalProviderWithdraw(uint medalId) external override reentrancyGuard {
        if (msg.sender != (liquidityMedal.belongsTo(medalId))) {
            revert InsufficientPrivilege();
        }
        (uint withdrawal, uint shadow) = getWithdrawalAndShadowByMedal(medalId);
        if (withdrawal > 0) {
            aUSD.transfer(msg.sender, withdrawal);
            capital.frozenCapital = capital.frozenCapital.sub(withdrawal);
        }
        liquidityMedal.updateReserve(medalId, shadow.divideDecimal(globalInfo.exchangeRate));
    }

    /**
     * @dev getWithdrawalAndShadowByMedal calculate the capital can be withdrawn by the medalId.
     * @param medalId the medalId
     */
    function getWithdrawalAndShadowByMedal(uint medalId) public view override returns (uint, uint) {
        ILiquidityMedal.MedalInfo memory medalInfo = liquidityMedal.getMedalInfo(medalId);
        // TODO: this function seems to be risky
        uint shadow = 0;
        if (medalInfo.enteredAt > globalInfo.currentFreedTs) {
            shadow = medalInfo.liquidity.multiplyDecimal(globalInfo.shadowPerShare).sub(medalInfo.shadowDebt);
        } else if (medalInfo.marketShadow >= globalInfo.shadowFreedPerShare) {
            shadow = medalInfo.liquidity.multiplyDecimal(globalInfo.shadowPerShare.sub(globalInfo.shadowFreedPerShare));
        } else {
            shadow = 0;
        }
        uint withdrawal = medalInfo.reserve.multiplyDecimal(globalInfo.exchangeRate) > shadow ? medalInfo.reserve.multiplyDecimal(globalInfo.exchangeRate).sub(shadow) : 0;
        return (withdrawal, shadow);
    }

    /**
     * @dev cancel the policy by a policy id
     * @param policyId the Id of policy.
     */
    function cancelPolicy(uint policyId) external override {
        IPolicy.PolicyInfo memory policyInfo = policy.getPolicyInfo(policyId);
        if (policy.isCancelAvailable(policyId)) {
            if (block.timestamp.sub(policyInfo.expiredAt) <= 86400) {
                if (msg.sender == policyInfo.beneficiary) {
                    _doPolicyCancel(policyId, msg.sender);
                } else {
                    revert PolicyCanOnlyCancelledByHolder(policyId);
                }
            } else {
                _doPolicyCancel(policyId, msg.sender);
            }
        } else {
            revert PreviousPolicyNotCancelled(policyId);
        }
        emit PolicyCancelled(policyId);
    }

    /**
     * @dev cancel the policy
     *
     * @param _policyId the id of policy to be cancelled
     * @param _caller the caller address
     */
    function _doPolicyCancel(uint _policyId, address _caller) internal {
        IPolicy.PolicyInfo memory policyInfo = policy.getPolicyInfo(_policyId);
        globalInfo.totalCoverage = globalInfo.totalCoverage.sub(policyInfo.coverage);
        globalInfo.shadowFreedPerShare = globalInfo.shadowFreedPerShare.add(policyInfo.shadowImpact);
        // use a function to update policy's isCancelled status
        policy.changeStatusIsCancelled(_policyId,true);
        globalInfo.currentFreedTs = policyInfo.enteredAt;
        _updateKLastByCancel(globalInfo.totalCoverage);
        aUSD.transfer(_caller, policyInfo.deposit);
    }

    /**
     * @dev update klast by cancelling the policy
     *
     * @param _totalCoverage the total coverage of the policies
     */
    function _updateKLastByCancel(uint _totalCoverage) internal {
        if (capital.freeCapital < _totalCoverage) {
            revert InsufficientLiquidity(capital.freeCapital);
        }
        // minimum klast is minimumFee * (availableLiquidity - totalCoverage);
        if (
            globalInfo.kLast <
            globalInfo.minimumFee.multiplyDecimal(
                capital.freeCapital.sub(_totalCoverage)
            )
        ) {
            globalInfo.kLast = globalInfo.minimumFee.multiplyDecimal(
                capital.freeCapital.sub(_totalCoverage)
            );
        }
    }

    /**
     * @dev the process the policy holder applies for.
     *
     * @param policyId the policy id
     */
    function policyClaimApply(uint policyId) external override {
        IPolicy.PolicyInfo memory policyInfo = policy.getPolicyInfo(policyId);
        if (block.timestamp > policyInfo.expiredAt) {
            revert PolicyAlreadyStale(policyId);
        }
        if (policyInfo.isClaimed == true) {
            revert PolicyAlreadyClaimed(policyId);
        }
        if (policyInfo.beneficiary != msg.sender) {
            revert SenderNotBeneficiary(policyInfo.beneficiary, msg.sender);
        }
        if (policyInfo.isClaimApplying == true) {
            revert ClaimUnderProcessing(policyId);
        }
        policy.changeStatusIsClaimApplying(policyId, true);
    }

    /**
     * @dev the refusal of the policy apply.
     *
     * @param policyId the policy id
     */
    function refuseApply(uint policyId) external override {
        if (msg.sender != judger) {
            revert InsufficientPrivilege();
        }
        IPolicy.PolicyInfo memory policyInfo = policy.getPolicyInfo(policyId);
        if (policyInfo.isClaimApplying == false) {
            revert ClaimNotUnderProcessing(policyId);
        }
        policy.changeStatusIsClaimApplying(policyId, false);
    }

    /**
     * @dev the approval of the policy apply.
     *
     * @param policyId the policy id
     */
    function approveApply(uint policyId) external override {
        if (msg.sender != judger) {
            revert InsufficientPrivilege();
        }
        IPolicy.PolicyInfo memory policyInfo = policy.getPolicyInfo(policyId);
        if (policyInfo.isClaimApplying == false) {
            revert ClaimNotUnderProcessing(policyId);
        }
        policy.changeStatusIsClaimApplying(policyId, false);
        policy.changeStatusIsClaimed(policyId, true);

        if (aUSD.balanceOf(address(mockRiskReserve)) >= policyInfo.coverage) {
            mockRiskReserve.payTo(policyInfo.beneficiary, policyInfo.coverage);
        } else {
            // we will pay as more as we can.
            uint remains = aUSD.balanceOf(address(mockRiskReserve));
            mockRiskReserve.payTo(policyInfo.beneficiary,remains);
            uint exceeded = policyInfo.coverage.sub(remains);
            _exceededPay(policyInfo.beneficiary, exceeded);
        }
    }

    /**
     * @dev the process if the risk reserve is not enough to pay the policy holder. In this case we will use capital pool.
     *
     * @param to the policy beneficiary address
     * @param exceeded the exceeded amount of aUSD
     */
    function _exceededPay(address to, uint exceeded) internal {
        uint total = capital.freeCapital.add(capital.frozenCapital);
        // update exchangeRate
        globalInfo.exchangeRate = globalInfo.exchangeRate.multiplyDecimal(
            SafeDecimalMath.UNIT.sub(exceeded.divideDecimal(total))
        );

        // update liquidity
        capital.freeCapital=capital.freeCapital.multiplyDecimal(
            SafeDecimalMath.UNIT.sub(exceeded.divideDecimal(total))
        );
        capital.frozenCapital=capital.frozenCapital.multiplyDecimal(
            SafeDecimalMath.UNIT.sub(exceeded.divideDecimal(total))
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
        if (_to == address(0)) {
            revert InvalidAddress(_to);
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
    event ProviderEntered(uint provider);

    /**
     * @dev Emitted when the user bought the cover.
     */
    event NewPolicyMinted(uint policyId);

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
    error ProviderNotExist(uint _certificateId);
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
    error InvalidAddress(address addr);
}
