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
    IEpochManage internal epochManage;
    IMetaDefenderGlobals internal metaDefenderGlobals;

    bool public initialized = false;
    address public judger;
    address public official;
    address public protocol;
    uint public TEAM_RESERVE_RATE = 5e16;
    uint public FEE_RATE = 5e16;
    uint public MAX_COVERAGE_PERCENTAGE = 2e16;
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

        // functional contracts.
        IEpochManage _epochManage,
        IMetaDefenderGlobals _metaDefenderGlobals,

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

        globalInfo.exchangeRate = SafeDecimalMath.UNIT;

        mockRiskReserve = _mockRiskReserve;
        liquidityCertificate = _liquidityCertificate;
        liquidityMedal = _liquidityMedal;
        policy = _policy;
        epochManage = _epochManage;
        metaDefenderGlobals = _metaDefenderGlobals;

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
     * @dev get the usable capital of the pool
     */
    function getUsableCapital() public view override returns (uint) {
        uint uc = capital.freeCapital>= globalInfo.totalCoverage? capital.freeCapital.sub(globalInfo.totalCoverage): 0;
        if ( uc == 0) {
            revert InsufficientUsableCapital();
        }
        return uc;
    }

    /**
     * @dev get the fee rate of the pool
     * @param coverage is the coverage to be secured
     */
    function estimateFee(uint coverage) external view override returns (uint) {
        uint uc = getUsableCapital();
        // we don't revert if the coverage is too large, so we need to remind the user of that in the frontend.
        return globalInfo.fee.multiplyDecimal(uc).divideDecimal(uc.sub(coverage));
    }

    /**
     * @dev buy Cover
     * @param coverage is the coverage to be secured
     */
    function buyCover(address beneficiary, uint coverage, uint duration) external override {
        IMetaDefenderGlobals.GlobalInfo memory globalInfo = metaDefenderGlobals.getMetaDefenderGlobals();
        if (coverage > globalInfo.lastEpochUsableCapital.multiplyDecimal(MAX_COVERAGE_PERCENTAGE)) {
            revert CoverageTooLarge(coverage, globalInfo.lastEpochUsableCapital.multiplyDecimal(MAX_COVERAGE_PERCENTAGE));
        }
        uint fee = metaDefenderGlobals.calculateFee(coverage);
        uint coverFee = coverage.multiplyDecimal(fee);
        uint deposit = coverFee.multiplyDecimal(FEE_RATE);
        uint totalPay = coverFee.add(deposit);
        aUSD.transferFrom(msg.sender, address(this), totalPay);

        uint256 reward4Team = coverFee.multiplyDecimal(TEAM_RESERVE_RATE);
        uint256 deltaRPS = (coverFee.sub(reward4Team)).divideDecimal(liquidityCertificate.totalValidCertificateLiquidity());
        uint256 deltaSPS = coverage.divideDecimal(liquidityCertificate.totalValidCertificateLiquidity());

        metaDefenderGlobals.updateGlobalsBuyCover(coverage, deltaRPS, deltaSPS, reward4Team);

        // mint a new policy NFT
        uint policyId = policy.mint(
            beneficiary,
            coverage,
            deposit,
            block.timestamp,
            block.timestamp.add(COVER_TIME),
            deltaSPS
        );

        emit NewPolicyMinted(policyId);
    }

    /**
     * @dev provider enters and provide the capitals
     * @param amount the amount of ausd to be provided
     */
    function certificateProviderEntrance(address beneficiary, uint amount) external override {
        IMetaDefenderGlobals.GlobalInfo memory globalInfo = metaDefenderGlobals.getMetaDefenderGlobals();
        aUSD.transferFrom(msg.sender, address(this), amount);
        metaDefenderGlobals.updateGlobalsCertificateProviderEntrance(amount);
        uint liquidity = amount.divideDecimal(globalInfo.exchangeRate);
        providerCount = liquidityCertificate.mint(
            beneficiary,
            liquidity,
            liquidity.multiplyDecimal(globalInfo.lastEpochAccRPS),
            liquidity.multiplyDecimal(globalInfo.lastEpochAccSPS),
            epochManage.getCurrentEpoch()
        );
        emit ProviderEntered(providerCount);
    }


    /**
     * @dev providerExit retrieve the rewards for the providers in the pool
     * @param certificateId the certificateId
     */
    function certificateProviderExit(uint certificateId) external override reentrancyGuard {
        ILiquidityCertificate.CertificateInfo memory certificateInfo = liquidityCertificate.getCertificateInfo(certificateId);
        ILiquidityCertificate.CertificateInfoCurrent memory certificateInfoCurrent = getCertificateCurrentInfo(certificateId);
        IMetaDefenderGlobals.GlobalInfo memory globalInfo = metaDefenderGlobals.getMetaDefenderGlobals();

        (uint deltaRPS, uint rewards) = getDeltaRPS(certificateId);
        metaDefenderGlobals.updateGlobalsCertificateProviderExit(certificateInfoCurrent.amount, certificateInfoCurrent.frozen);

        // now we will burn the liquidity certificate and mint a new medal for the provider
        address beneficiary = liquidityCertificate.belongsTo(certificateId);
        liquidityCertificate.burn(msg.sender, certificateId);

        medalCount = liquidityMedal.mint(
            beneficiary,
            certificateId,
            certificateInfo.epoch,
            epochManage.getCurrentEpoch(),
            certificateInfoCurrent.liquidity,
            certificateInfo.debtSPS
        );

        // transfer
        aUSD.transfer(msg.sender, certificateInfoCurrent.withdrawal.add(rewards));
        emit ProviderExit(msg.sender);
    }

    function getCertificateCurrentInfo(uint certificateId) internal view returns (ILiquidityCertificate.CertificateInfoCurrent memory) {
        ILiquidityCertificate.CertificateInfo memory certificateInfo = liquidityCertificate.getCertificateInfo(certificateId);
        IMetaDefenderGlobals.GlobalInfo memory globalInfo = metaDefenderGlobals.getMetaDefenderGlobals();
        IEpochManage.EpochInfo memory epochInfo = epochManage.getEpochInfo();

        uint amount = certificateInfo.liquidity.multiplyDecimal(globalInfo.exchangeRate);
        uint shadow = certificateInfo.liquidity.multiplyDecimal(globalInfo.lastEpochAccSPS.add(epochInfo.SPSInSettling));
        uint withdrawal = amount > shadow ? amount.sub(shadow) : 0;
        uint frozen = amount.sub(withdrawal);
        uint liquidity = frozen.divideDecimal(globalInfo.exchangeRate);
        return ILiquidityCertificate.CertificateInfoCurrent({
            amount: amount,
            frozen: frozen,
            withdrawal: withdrawal,
            shadow: shadow,
            liquidity: liquidity
        });
    }


    /**
     * @dev getDeltaRPS calculates the rewards for the provider
     * @param certificateId the certificateId
     */
    function getDeltaRPS(uint certificateId) public view override returns (uint, uint) {
        ILiquidityCertificate.CertificateInfo memory certificateInfo = liquidityCertificate.getCertificateInfo(certificateId);
        IMetaDefenderGlobals.GlobalInfo memory globalInfo = metaDefenderGlobals.getMetaDefenderGlobals();
        uint deltaRPS = globalInfo.lastEpochAccRPS > certificateInfo.debtRPS ? globalInfo.lastEpochAccRPS.sub(certificateInfo.debtRPS) : 0;
        uint rewards = certificateInfo.liquidity.multiplyDecimal(deltaRPS);
        return(deltaRPS,rewards);
    }

    /**
     * @dev getDeltaSPS calculates the rewards for the provider
     * @param medalId The medalId.
     */
    function getDebtSPS(uint medalId) public view override returns (uint, uint) {
        ILiquidityMedal.MedalInfo memory medalInfo = liquidityMedal.getMedalInfo(medalId);
        IMetaDefenderGlobals.GlobalInfo memory globalInfo = metaDefenderGlobals.getMetaDefenderGlobals();
        IEpochManage.EpochInfo memory epochInfo = epochManage.getEpochInfo();
        uint debtSPS = globalInfo.lastEpochAccSPS.sub(epochInfo.SPSInBuying);
        uint withdrawal = medalInfo.liquidity.multiplyDecimal(medalInfo.debtSPS.sub(debtSPS));
        return(debtSPS, withdrawal);
    }

    /**
     * @dev claimRewards retrieve the rewards for the providers in the pool
     * @param certificateId the certificateId
     */
    function claimRewards(uint certificateId) external override reentrancyGuard {
        if (msg.sender != (liquidityCertificate.belongsTo(certificateId))) {
            revert InsufficientPrivilege();
        }
        (uint deltaRPS, uint rewards) = getDeltaRPS(certificateId);
        liquidityCertificate.updateCertificateDebtRPS(certificateId, deltaRPS);
        aUSD.transfer(msg.sender, rewards);
    }

    /**
     * @dev claimRewards retrieve the rewards for the providers in the pool
     * @param medalId The medalId.
     */
    function withdrawAfterExit(uint medalId) external override reentrancyGuard {
        if (msg.sender != (liquidityMedal.belongsTo(medalId))) {
            revert InsufficientPrivilege();
        }
        (uint debtSPS, uint withdrawal) = getDebtSPS(medalId);
        liquidityMedal.updateMedalDebtSPS(medalId, debtSPS);
        aUSD.transfer(msg.sender, withdrawal);
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
        uint uc = getUsableCapital();
        globalInfo.fee = globalInfo.fee.multiplyDecimal(uc.sub(policyInfo.coverage)).divideDecimal(uc);
        if (globalInfo.fee <= globalInfo.minimumFee) {
            globalInfo.fee = globalInfo.minimumFee;
        }
        aUSD.transfer(_caller, policyInfo.deposit);
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
