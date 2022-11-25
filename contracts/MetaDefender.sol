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
import "./interfaces/IEpochManage.sol";
import "./interfaces/IMetaDefenderGlobals.sol";

import "./Lib/SafeDecimalMath.sol";
import "./interfaces/IEpochManage.sol";
import "./interfaces/IEpochManage.sol";
import "./interfaces/ICalculatePremium.sol";

contract MetaDefender is IMetaDefender, ReentrancyGuard, Ownable {
    using SafeMath for uint;
    using SafeDecimalMath for uint;

    GlobalInfo internal globalInfo;

    IERC20 internal aUSD;
    // validMiningProxy
    mapping(address => bool) public validMiningProxy;

    // interfaces
    ILiquidityCertificate internal liquidityCertificate;
    ILiquidityMedal internal liquidityMedal;
    IPolicy internal policy;
    IMockRiskReserve internal mockRiskReserve;
    IEpochManage internal epochManage;
    IMetaDefenderGlobals internal metaDefenderGlobals;
    ICalculatePremium internal calculatePremium;

    bool public initialized = false;
    address public judger;
    address public official;
    address public protocol;
    uint public constant TEAM_RESERVE_RATE = 5e16;
    uint public constant FEE_RATE = 5e16;
    uint public constant MAX_COVERAGE_PERCENTAGE = 2e16;
    uint public constant BUFFER = 3;
    uint public constant STANDARD_RISK = 2e18;

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
     * @param _mockRiskReserve the address of risk reserve pool
     * @param _epochManage the address of epoch manage contract
     */
    function init(
        // basic information
        IERC20 _aUSD,
        address _judger,
        address _official,

        // riskReserve
        IMockRiskReserve _mockRiskReserve,

        // NFT LPs and policy NFT
        ILiquidityCertificate _liquidityCertificate,
        ILiquidityMedal _liquidityMedal,
        IPolicy _policy,

        // calculation
        ICalculatePremium _calculatePremium,

        // functional contracts.
        IEpochManage _epochManage,
        IMetaDefenderGlobals _metaDefenderGlobals
    ) external {
        if (initialized) {
            revert ContractAlreadyInitialized();
        }
        aUSD = _aUSD;
        judger = _judger;
        official = _official;

        mockRiskReserve = _mockRiskReserve;
        liquidityCertificate = _liquidityCertificate;
        liquidityMedal = _liquidityMedal;
        policy = _policy;
        epochManage = _epochManage;
        metaDefenderGlobals = _metaDefenderGlobals;
        calculatePremium =_calculatePremium;

        initialized = true;
    }

    function getGlobalInfo() external view override returns (GlobalInfo memory) {
        return globalInfo;
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
        IMetaDefenderGlobals.GlobalInfo memory globalInfo = metaDefenderGlobals.getGlobalInfo();
        aUSD.transfer(official, globalInfo.reward4Team);
        metaDefenderGlobals.teamClaim();
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
     * @dev buy Cover
     * @param beneficiary is the address to can claim the coverage.
     * @param coverage is the coverage to be secured.
     * @param duration is the time (in epoch) the policy lasts.
     */
    function buyPolicy(address beneficiary, uint coverage, uint duration) external override nonReentrant checkNewEpoch(){
        if (coverage > liquidityCertificate.totalValidCertificateLiquidity().sub(globalInfo.accSPS).multiplyDecimal(MAX_COVERAGE_PERCENTAGE)) {
            // TODO: how to decide the max coverage;
            revert CoverageTooLarge(coverage);
        }
        globalInfo.risk = globalInfo.risk.add(coverage.divideDecimal(STANDARD_RISK));
        uint premium = calculatePremium(coverage, duration, globalInfo.risk);
        // team reward.
        uint reward4Team = premium.multiplyDecimal(TEAM_RESERVE_RATE);
        globalInfo.reward4Team = globalInfo.reward4Team.add(reward4Team);
        // fee can be retrieved when settle.
        uint fee = premium.multiplyDecimal(FEE_RATE);
        aUSD.transferFrom(msg.sender, address(this), premium.add(fee).add(reward4Team));

        // update globals
        uint deltaRPS = premium.divideDecimal(liquidityCertificate.totalValidCertificateLiquidity());
        uint deltaSPS = coverage.divideDecimal(liquidityCertificate.totalValidCertificateLiquidity());

        globalInfo.accSPS = globalInfo.accSPS.add(deltaSPS);
        globalInfo.accRPS = globalInfo.accRPS.add(deltaRPS);

        // update tick epoch.
        uint currentEpochIndex = epochManage.getCurrentEpochIndex();

        // mint a new policy NFT
        uint policyId = policy.mint(
            beneficiary,
            coverage,
            fee,
            currentEpochIndex,
            duration,
            deltaSPS
        );

        emit NewPolicyMinted(policyId);
    }

    /**
     * @dev provider enters and provide the capitals
     * @param amount the amount of ausd to be provided
     */
    function certificateProviderEntrance(address beneficiary, uint amount) external override reentrancyGuard checkNewEpoch(){
        IMetaDefenderGlobals.GlobalInfo memory globalInfo = metaDefenderGlobals.getGlobalInfo();
        aUSD.transferFrom(msg.sender, address(this), amount);
        providerCount = liquidityCertificate.mint(
            beneficiary,
            epochManage.epochLength(),
            amount
        );
        emit ProviderEntered(providerCount);
    }


    /**
     * @dev providerExit retrieve the rewards for the providers in the pool
     * @param certificateId the certificateId
     */
    function certificateProviderExit(uint certificateId) external override reentrancyGuard checkNewEpoch(){
        ILiquidityCertificate.CertificateInfo memory certificateInfo = liquidityCertificate.getCertificateInfo(certificateId);
        // how much SPS still be captured in the certificateId.
        uint SPSCaptured = getSPSLockedByCertificateId(certificateId);
        (, uint rewards) = getRewards(certificateId);
        address beneficiary = liquidityCertificate.belongsTo(certificateId);
        liquidityCertificate.expire(msg.sender, certificateId);

        uint withdrawal = exchangeRate > SPSCaptured ? certificateInfo.liquidity.multiplyDecimal(exchangeRate.sub(SPSCaptured)) : 0;
        // transfer
        if (withdrawal.add(rewards) > 0) {
            aUSD.transfer(beneficiary, withdrawal.add(rewards));
        }
        emit ProviderExit(msg.sender);
    }

    function getSPSLockedByCertificateId(uint certificateId) internal view returns(uint) {
        // lockedSPS = accSPSLeft - accSPSProvide + provideEpoch.crossSPS - withdrawEpoch.crossSPS
        ILiquidityCertificate.CertificateInfo memory certificateInfo = liquidityCertificate.getCertificateInfo(certificateId);
        IEpochManage.EpochInfo memory epochInfoEntered = epochManage.getEpochInfo(certificateInfo.getEpochInfo(certificateInfo.enteredEpochIndex));
        IEpochManage.EpochInfo memory epochInfoExit = epochManage.getEpochInfo(certificateInfo.getEpochInfo(certificateInfo.exitedEpochIndex));
        return epochInfoExit.accSPS.sub(epochInfoEntered.accSPS).add(epochInfoEntered.crossSPS).sub(epochInfoExit.crossSPS);
    }


    /**
     * @dev getRewards calculates the rewards for the provider
     * @param certificateId the certificateId
     */
    function getRewards(uint certificateId) public view override returns (uint) {
        ILiquidityCertificate.CertificateInfo memory certificateInfo = liquidityCertificate.getCertificateInfo(certificateId);
        IMetaDefenderGlobals.GlobalInfo memory globalInfo = metaDefenderGlobals.getGlobalInfo();
        IMetaDefenderGlobals.GlobalInfoCache memory globalInfoCache = metaDefenderGlobals.getGlobalInfoCache();
        IEpochManage.EpochInfo memory epochInfoCurrent = epochManage.getEpochInfo(globalInfo.currentEpochIndex);
        IEpochManage.EpochInfo memory epochInfoEntered = epochManage.getEpochInfo(certificateInfo.enteredEpochIndex);
        uint rewards = certificateInfo.liquidity.multiplyDecimal(epochInfoCurrent.accRPS.sub(epochInfoEntered.accRPS));
        return rewards;
    }

    /**
     * @dev getWithdrawal calculates the how much can be withdrawn after exit.
     * @param certificateId The certificateId.
     */
    function getWithdrawal(uint certificateId) public view override returns (uint, uint) {
        ILiquidityCertificate.CertificateInfo memory certificateInfo = liquidityCertificate.getCertificateInfo(certificateId);
        uint SPSLocked = getSPSLockedByCertificateId(certificateId);
        uint withdrawal = certificateInfo.liquidity.multiplyDecimal(certificateInfo.SPSLocked.sub(SPSLocked));
        return (SPSLocked, withdrawal);
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
        uint64 currentEpochIndex = epochManage.currentEpochIndex();
        liquidityCertificate.updateRewardDebtEpochIndex(certificateId, currentEpochIndex);
        aUSD.transfer(msg.sender, rewards);
    }

    /**
     * @dev withdrawAfterExit retrieve the rewards for the providers in the pool
     * @param certificateId The medalId.
     */
    function withdrawAfterExit(uint certificateId) external override reentrancyGuard {
        if (msg.sender != (liquidityMedal.belongsTo(certificateId))) {
            revert InsufficientPrivilege();
        }
        (uint SPSLocked, uint withdrawal) = getWithdrawal(certificateId);
        liquidityCertificate.updateSPSLocked(certificateId, SPSLocked);
        aUSD.transfer(msg.sender, withdrawal);
    }

    /**
     * @dev settle the policy by a policy id
     * @param policyId the Id of policy.
     */
    function settlePolicy(uint policyId) external override checkNewEpoch(){
        IPolicy.PolicyInfo memory policyInfo = policy.getPolicyInfo(policyId);
        if (policy.isCancelAvailable(policyId)) {
            IEpochManage.EpochInfo memory epochInfo = epochManage.getEpochInfo(policyInfo.enteredEpochIndex);
            epochManage.getCurrentEpochInfo().epochId.sub(epochInfo.epochId) <= 5 ? executeSettle(policyId,true):executeSettle(policyId,false);
        }
        emit PolicyCancelled(policyId);
    }

    /**
     * @dev settle the policy
     *
     * @param policyId the id of policy to be settle.
     * @param isPolicyHolder is the policyHolder himself to settle the policy;
     */
    function executeSettle(uint policyId, bool isPolicyHolder) internal {
        IPolicy.PolicyInfo memory policyInfo = policy.getPolicyInfo(policyId);
        policy.changeStatusIsSettled(policyId, true);
        // now we will change the fee
        metaDefenderGlobals.calculateFee(policyInfo.coverage, false);
        metaDefenderGlobals.settlePolicy(policyInfo.coverage,policyInfo.SPS,policyInfo.enteredEpochIndex);
        if (isPolicyHolder) {
            aUSD.transfer(policyInfo.beneficiary, policyInfo.deposit);
        } else {
            aUSD.transfer(msg.sender, policyInfo.deposit);
        }
    }

    /**
     * @dev the process the policy holder applies for.
     *
     * @param policyId the policy id
     */
    function policyClaimApply(uint policyId) external override checkNewEpoch() {
        IPolicy.PolicyInfo memory policyInfo = policy.getPolicyInfo(policyId);
        IEpochManage.EpochInfo memory enteredEpochInfo = epochManage.getEpochInfo(policyInfo.enteredEpochIndex);
        IEpochManage.EpochInfo memory currentEpochInfo = epochManage.getCurrentEpochInfo();
        if (currentEpochInfo.epochId > enteredEpochInfo.epochId.add(policyInfo.duration).add(BUFFER)) {
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

        metaDefenderGlobals.approveApply(policyInfo.coverage);

        if (aUSD.balanceOf(address(mockRiskReserve)) >= policyInfo.coverage) {
            mockRiskReserve.payTo(policyInfo.beneficiary, policyInfo.coverage);
        } else {
            // we will pay as more as we can.
            uint remains = aUSD.balanceOf(address(mockRiskReserve));
            mockRiskReserve.payTo(policyInfo.beneficiary,remains);
            _exceededPay(policyInfo.beneficiary, policyInfo.coverage.sub(remains));
        }
    }

    /**
     * @dev the process if the risk reserve is not enough to pay the policy holder. In this case we will use capital pool.
     *
     * @param to the policy beneficiary address
     * @param excess the exceeded amount of aUSD
     */
    function _exceededPay(address to, uint excess) internal {
        metaDefenderGlobals.excessPayment(excess);
        aUSD.transfer(to, excess);
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

    modifier checkNewEpoch() virtual {
        epochManage.checkAndCreateNewEpoch();
        _;
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
    error CoverageTooLarge(uint coverage);
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
