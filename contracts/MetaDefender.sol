//SPDX-License-Identifier: ISC
pragma solidity ^0.8.9;

// openzeppelin contracts
import '@openzeppelin/contracts/utils/math/SafeMath.sol';
import '@openzeppelin/contracts/security/ReentrancyGuard.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import "@openzeppelin/contracts/access/Ownable.sol";

// interfaces
import './interfaces/ILiquidityCertificate.sol';
import './interfaces/IPolicy.sol';
import './interfaces/IEpochManage.sol';
import './interfaces/IAmericanBinaryOptions.sol';
import './interfaces/IMetaDefender.sol';

// Libs
import './Lib/SafeDecimalMath.sol';

contract MetaDefender is
    IMetaDefender,
    ReentrancyGuard,
    Ownable
{
    using SafeMath for uint256;
    using SafeMath for uint64;
    using SafeDecimalMath for uint256;

    GlobalInfo public globalInfo;

    IERC20 internal aUSD;
    // validMiningProxy, no need for aseed option
    //mapping(address => bool) public validMiningProxy;

    // interfaces
    ILiquidityCertificate internal liquidityCertificate;
    IPolicy internal policy;
    IEpochManage public epochManage;
    IAmericanBinaryOptions internal americanBinaryOptions;

    bool private initialized;
    address public judger;
    address public official;
    address public protocol;
    uint256 public teamReserveRate;
    uint256 public constant FEE_RATE = 5e16;
    uint256 public constant DURATION = 25;
    uint256 public constant FEE = 0;
    uint256 public constant MAX_COVERAGE_PERCENTAGE = 2e17;
    uint256 public constant WITHDRAWAL_FEE_RATE = 3e15;
    uint256 public constant BUFFER = 3;
    int256 public constant FREE_RATE = 6e16;
    uint256 public constant BASE_POINT = 1e16;

    // index the providers
    uint256 public providerCount;
    // index the providers who exit the market
    uint256 public medalCount;

    //only for aseed option
    uint256 public totalCoverage;

    bool private manuallyChecked = false;

    constructor() {}

    // the Pool have three functions;
    // 1. save the money for coverage
    // 2. receive the money of the policyholder
    // 3. keep the money for funds which have not been withdrawn yet

    /**
     * @dev Initialize the contract.
     *
     * @param _aUSD the IERC20 instance of AcalaUSD
     * @param _official the address of official
     * @param _epochManage the address of epoch manage contract
     */
    function init(
        // basic information
        IERC20 _aUSD,
        address _official,
        // NFT LPs and policy NFT
        ILiquidityCertificate _liquidityCertificate,
        IPolicy _policy,
        // calculation
        IAmericanBinaryOptions _americanBinaryOptions,
        // functional contracts.
        IEpochManage _epochManage,
        // params
        uint256 _initialRisk,
        uint256 _teamReserveRate,
        uint256 _standardRisk,
        uint256 _strikeRate,
        uint256 _baseRate
    ) external {
        require(!initialized, 'Contract already initialized');
        aUSD = _aUSD;
        official = _official;
        liquidityCertificate = _liquidityCertificate;
        policy = _policy;
        epochManage = _epochManage;
        americanBinaryOptions = _americanBinaryOptions;
        globalInfo.risk = _initialRisk;
        globalInfo.standardRisk = _standardRisk;
        globalInfo.strikeRate = _strikeRate;
        globalInfo.baseRate = _baseRate;
        teamReserveRate = _teamReserveRate;
        initialized = true;
    }

    function getGlobalInfo()
        external
        view
        override
        returns (GlobalInfo memory)
    {
        return globalInfo;
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
        emit officialChanged(official);
    }

    /**
     * @dev claim team rewards
     */
    function teamClaim() external override {
        if (msg.sender != official) {
            revert InsufficientPrivilege();
        }
        aUSD.transfer(official, globalInfo.reward4Team);
        globalInfo.reward4Team = 0;
        emit teamClaimed();
    }

    /**
     * @dev updateStandardRisk
     * @param standardRisk the latest standardRisk
     */
    function updateStandardRisk(uint256 standardRisk) external override {
        if (msg.sender != official) {
            revert InsufficientPrivilege();
        }
        globalInfo.standardRisk = standardRisk;
        emit standardRiskUpdated(standardRisk);
    }

    /**
     * @dev buy Cover
     * @param beneficiary is the address to can claim the coverage.
     * @param coverage is the coverage to be secured.
     */
    function buyPolicy(
        address beneficiary,
        uint256 coverage
    ) external override nonReentrant checkNewEpoch {
        if (epochManage.daysAboveStrikePrice() >= 7) {
            revert priceStrike();
        }

        if (epochManage.isWithdrawDay()) {
            revert WithdrawDay();
        }
        if (coverage > 100 * globalInfo.standardRisk) {
            revert CoverageTooLarge(coverage);
        }
        //total coverage should be lower than total liquidity
        if (
            totalCoverage.add(coverage) >
            liquidityCertificate.totalValidCertificateLiquidity()
        ) {
            revert totalCoverageExceed();
        }
        //update total coverage
        totalCoverage = totalCoverage.add(coverage);

        globalInfo.risk = globalInfo.risk.add(
            coverage.divideDecimal(globalInfo.standardRisk).multiplyDecimal(
                BASE_POINT
            )
        );
        int256 premium = americanBinaryOptions.americanBinaryOptionPrices(
            DURATION * 1 days,
            globalInfo.risk,
            1000e18,
            uint(1000e18).multiplyDecimal(globalInfo.strikeRate),
            FREE_RATE
        );
        if (premium < 0) {
            premium = 0;
        }
        // 15% base rate
        uint256 basePayment = coverage.mul(globalInfo.baseRate).div(1000);
        uint256 totalPayment = uint256(premium).multiplyDecimal(coverage).add(
            basePayment
        );
        // team reward. mocked in 5e16.
        uint256 reward4Team = totalPayment.multiplyDecimal(teamReserveRate);

        globalInfo.reward4Team = globalInfo.reward4Team.add(reward4Team);
        // fee = 10e18 which is 10 usdt.
        // the user will pay premium + reward4Team + fee
        aUSD.transferFrom(
            msg.sender,
            address(this),
            totalPayment.add(FEE).add(reward4Team)
        );

        // update globals
        uint256 deltaRPS = totalPayment.divideDecimal(
            liquidityCertificate.totalValidCertificateLiquidity()
        );
        uint256 deltaSPS = coverage.divideDecimal(
            liquidityCertificate.totalValidCertificateLiquidity()
        );

        globalInfo.accSPS = globalInfo.accSPS.add(deltaSPS);
        globalInfo.accRPS = globalInfo.accRPS.add(deltaRPS);

        // mint a new policy NFT
        uint256 policyId = policy.mint(
            beneficiary,
            coverage,
            FEE,
            epochManage.currentEpochIndex(),
            DURATION,
            deltaSPS,
            globalInfo.standardRisk,
            block.timestamp
        );
        emit NewPolicyMinted(policyId);
    }

    /**
     * @dev provider enters and provide the capitals
     * @param amount the amount of ausd to be provided
     */
    function certificateProviderEntrance(
        uint256 amount
    ) external override nonReentrant checkNewEpoch {
        // certificate entrance only available in first 10 days
        // as the liquidity entered at day N will only be useful at day N+1
        // so forbid liquidity to enter after the 9th day
        uint currentEpoch = epochManage.getCurrentEpoch();
        uint startEpoch = (
            epochManage.startTime().sub(epochManage.startTime() % 1 days)
        ).div(1 days);
        if ((currentEpoch > startEpoch) && currentEpoch.sub(startEpoch) >= 9) {
            revert optionTradeDurationPassed();
        }
        aUSD.transferFrom(msg.sender, address(this), amount);
        providerCount = liquidityCertificate.mint(
            epochManage.currentEpochIndex(),
            amount
        );
        emit ProviderEntered(providerCount);
    }

    /**
     * @dev providerExit retrieve the rewards for the providers in the pool
     * @param certificateId the certificateId
     */
    function certificateProviderExit(
        uint256 certificateId
    ) external override nonReentrant {
        if (!epochManage.isWithdrawDay()) {
            revert NotWithdrawDay();
        }
        if (msg.sender != liquidityCertificate.belongsTo(certificateId)) {
            revert InsufficientPrivilege();
        }
        ILiquidityCertificate.CertificateInfo
            memory certificateInfo = liquidityCertificate.getCertificateInfo(
                certificateId
            );
        if (certificateInfo.isValid == false) {
            revert InsufficientPrivilege();
        }

        uint64 currentEpochIndex = epochManage.currentEpochIndex();
        (uint256 SPSLocked, uint256 withdrawal) = getSPSLockedByCertificateId(
            certificateId
        );

        liquidityCertificate.decreaseLiquidity(certificateId);
        liquidityCertificate.updateSPSLocked(certificateId, SPSLocked);
        uint256 rewards = getRewards(certificateId, true);
        liquidityCertificate.expire(certificateId, currentEpochIndex);

        uint256 fee = withdrawal.multiplyDecimal(WITHDRAWAL_FEE_RATE);
        globalInfo.reward4Team = globalInfo.reward4Team.add(fee);
        if (withdrawal.add(rewards) > 0) {
            // update the epochIndex
            uint64 previousEpochIndex = epochManage.currentEpochIndex() - 1;
            liquidityCertificate.updateRewardDebtEpochIndex(
                certificateId,
                previousEpochIndex
            );
            aUSD.transfer(msg.sender, withdrawal.add(rewards).sub(fee));
        }
        emit ProviderExit(msg.sender);
    }

    /**
     * @dev getSPSLockedByCertificateId calculates the rewards locked in the certificateId
     * @param certificateId the certificateId
     */
    function getSPSLockedByCertificateId(
        uint256 certificateId
    ) public view override returns (uint256, uint256) {
        // lockedSPS = (accSPSLeft - accSPSProvide) - (withdrawEpoch.crossSPS - provideEpoch.crossSPS) - enteredEpoch.crossSPSClaimed
        // = (accSPSLeft - crossAccSPSLeft) - (accSPSProvide - crossAccSPSProvide)
        ILiquidityCertificate.CertificateInfo
            memory certificateInfo = liquidityCertificate.getCertificateInfo(
                certificateId
            );
        IEpochManage.EpochInfo memory epochInfoEntered = epochManage
            .getEpochInfo(certificateInfo.enteredEpochIndex);
        IEpochManage.EpochInfo memory epochInfoExit = epochManage.getEpochInfo(
            certificateInfo.exitedEpochIndex
        );
        IEpochManage.EpochInfo memory epochInfoCurrent = epochManage
            .getCurrentEpochInfo();
        uint256 SPSLocked = certificateInfo.exitedEpochIndex == 0
            ? epochInfoCurrent
                .accSPS
                .add(epochInfoEntered.crossSPS)
                .sub(epochInfoCurrent.crossSPS)
                .sub(epochInfoEntered.accSPS)
            : epochInfoExit
                .accSPS
                .add(epochInfoEntered.crossSPS)
                .sub(epochInfoExit.crossSPS)
                .sub(epochInfoEntered.accSPS);

        //if it is sure the options would never be able to exercise
        //which means 30 days passed by less than 7 days above strike price in epoch manage
        //make spslocked to 0 directly
        if (
            block.timestamp >=
            epochManage.startTime() + epochManage.contractPeriod() &&
            epochManage.daysAboveStrikePrice() < 7
        ) {
            SPSLocked = 0;
        }

        uint256 withdrawal = certificateInfo.exitedEpochIndex == 0
            ? certificateInfo.liquidity.multiplyDecimal(
                SafeDecimalMath.UNIT >= SPSLocked
                    ? SafeDecimalMath.UNIT.sub(SPSLocked)
                    : 0
            )
            : certificateInfo.liquidity.multiplyDecimal(
                calculationForMedal(certificateInfo.SPSLocked, SPSLocked)
            );
        return (SPSLocked, withdrawal);
    }

    function calculationForMedal(
        uint256 certificateInfoSPSLocked,
        uint256 SPSLocked
    ) internal pure returns (uint256) {
        if (SPSLocked >= SafeDecimalMath.UNIT) {
            return 0;
        } else {
            if (certificateInfoSPSLocked >= SafeDecimalMath.UNIT) {
                return SafeDecimalMath.UNIT.sub(SPSLocked);
            } else {
                return certificateInfoSPSLocked.sub(SPSLocked);
            }
        }
    }

    /**
     * @dev getRewards calculates the rewards for the provider
     * @param certificateId the certificateId
     */
    function getRewards(
        uint256 certificateId,
        bool isExit
    ) public view override returns (uint256) {
        ILiquidityCertificate.CertificateInfo
            memory certificateInfo = liquidityCertificate.getCertificateInfo(
                certificateId
            );
        if (
            certificateInfo.enteredEpochIndex == epochManage.currentEpochIndex()
        ) {
            return 0;
        }
        if (!isExit && certificateInfo.isValid == false) {
            return 0;
        }

        IEpochManage.EpochInfo memory epochInfoUntil = epochManage.getEpochInfo(
            epochManage.currentEpochIndex() - (isExit == true ? 0 : 1)
        );
        IEpochManage.EpochInfo memory epochInfoRewardDebt = epochManage
            .getEpochInfo(certificateInfo.rewardDebtEpochIndex);
        uint256 rewards = certificateInfo.liquidity.multiplyDecimal(
            epochInfoUntil.accRPS.sub(epochInfoRewardDebt.accRPS)
        );
        return rewards;
    }

    /**
     * @dev claimRewards retrieve the rewards for the providers in the pool
     * @param certificateId the certificateId
     */
    function claimRewards(
        uint256 certificateId
    ) external override nonReentrant checkNewEpoch {
        if (msg.sender != (liquidityCertificate.belongsTo(certificateId))) {
            revert InsufficientPrivilege();
        }
        uint256 rewards = getRewards(certificateId, false);
        if (rewards > 0) {
            uint64 previousEpochIndex = epochManage.currentEpochIndex() - 1;
            liquidityCertificate.updateRewardDebtEpochIndex(
                certificateId,
                previousEpochIndex
            );
            aUSD.transfer(msg.sender, rewards);
        } else {
            revert NoRewards();
        }
    }

    /**
     * @dev withdrawAfterExit retrieve the rewards for the providers in the pool
     * @param certificateId The medalId.
     */
    function withdrawAfterExit(
        uint256 certificateId
    ) external override nonReentrant {
        ILiquidityCertificate.CertificateInfo
            memory certificateInfo = liquidityCertificate.getCertificateInfo(
                certificateId
            );
        if (msg.sender != (liquidityCertificate.belongsTo(certificateId))) {
            revert InsufficientPrivilege();
        }
        if (certificateInfo.exitedEpochIndex == 0) {
            revert CertificateNotExit();
        }
        (uint256 SPSLocked, uint256 withdrawal) = getSPSLockedByCertificateId(
            certificateId
        );
        liquidityCertificate.updateSPSLocked(certificateId, SPSLocked);
        uint256 fee = withdrawal.multiplyDecimal(WITHDRAWAL_FEE_RATE);
        globalInfo.reward4Team = globalInfo.reward4Team.add(fee);
        aUSD.transfer(msg.sender, withdrawal.sub(fee));
    }

    /**
     * @dev the process the policy holder applies for.
     *
     * @param policyId the policy id
     */
    function policyClaimApply(uint256 policyId) external override {
        if (epochManage.daysAboveStrikePrice() < 7) {
            revert exerciseNotAvailable();
        }
        IPolicy.PolicyInfo memory policyInfo = policy.getPolicyInfo(policyId);
        if (policyInfo.isClaimed == true) {
            revert PolicyAlreadyClaimed(policyId);
        }
        if (policyInfo.isSettled == true) {
            revert PolicyAlreadySettled(policyId);
        }
        if (policyInfo.beneficiary != msg.sender) {
            revert SenderNotBeneficiary(policyInfo.beneficiary, msg.sender);
        }
        claimPolicy(policyId);
        aUSD.transfer(policyInfo.beneficiary, policyInfo.coverage);
        policy.changeStatusIsClaimed(policyId, true);
    }

    /**
     * @dev claim the policy
     *
     * @param policyId the policy id
     */
    function claimPolicy(uint256 policyId) internal {
        IPolicy.PolicyInfo memory policyInfo = policy.getPolicyInfo(policyId);
        if (policy.isClaimAvailable(policyId)) {
            epochManage.updateCrossShadow(
                policyInfo.SPS,
                policyInfo.enteredEpochIndex,
                true
            );
            aUSD.transfer(policyInfo.beneficiary, policyInfo.fee);
            emit PolicyClaimed(policyId);
        } else {
            revert NotClaimAvailable();
        }
    }

    /**
     * @dev manually check the new epoch at day 11(the eleven day 8:00 GMT +8)
     */
    function epochCheck() external override checkNewEpoch {
        require(msg.sender == official && !manuallyChecked);
        require(
            block.timestamp >
                epochManage.startTime() + epochManage.optionTradeDuration()
        );
        manuallyChecked = true;
        epochManage.checkAndCreateNewEpochAndUpdateAccRPSAccSPS();
    }

    modifier checkNewEpoch() virtual {
        if (!manuallyChecked) {
            epochManage.checkAndCreateNewEpochAndUpdateLiquidity();
        }
        _;
        if (!manuallyChecked) {
            epochManage.checkAndCreateNewEpochAndUpdateAccRPSAccSPS();
        }
    }

    /**
     * @dev Emitted when the provider entered.
     */
    event ProviderEntered(uint256 provider);

    /**
     * @dev Emitted when the user bought the cover.
     */
    event NewPolicyMinted(uint256 policyId);

    /**
     * @dev Emitted when the user bought the cover.
     */
    event ProviderExit(address providerAddress);

    /**
     * @dev Emitted when the user bought the cover.
     */
    event PolicyCancelled(uint256 id);

    /**
     * @dev Claimed when the user bought the cover.
     */
    event PolicyClaimed(uint256 id);

    /**
     * @dev Emitted when the official changed.
     */
    event officialChanged(address official);

    /**
     * @dev Emitted when the team has claimed their rewards.
     */
    event teamClaimed();

    /**
     * @dev Emitted when the standard risk has been updated.
     */
    event standardRiskUpdated(uint256 standardRisk);

    /**
     * @notice errors
     */

    error NotWithdrawDay();
    error WithdrawDay();
    error InsufficientPrivilege();
    error InsufficientUsableCapital();
    error InsufficientLiquidity(uint256 id);
    error CoverageTooLarge(uint256 coverage);
    error ProviderDetected(address providerAddress);
    error ProviderNotExist(uint256 _certificateId);
    error ProviderNotStale(uint256 id);
    error PolicyAlreadyCancelled(uint256 id);
    error PreviousPolicyNotCancelled(uint256 id);
    error PolicyCanNotBeCancelled(uint256 id);
    error PolicyCanOnlyCancelledByHolder(uint256 id);
    error InvalidPolicy(uint256 id);
    error PolicyAlreadyStale(uint256 id);
    error SenderNotBeneficiary(address sender, address beneficiary);
    error PolicyAlreadyClaimed(uint256 id);
    error PolicyAlreadySettled(uint256 id);
    error ClaimUnderProcessing(uint256 id);
    error ClaimNotUnderProcessing(uint256 id);
    error InvalidMiningProxy(address proxy);
    error InvalidAddress(address addr);
    error CertificateNotSignalWithdraw();
    error CertificateNotExit();
    error CertificateExit();
    error NoRewards();
    error NotClaimAvailable();
    error ShouldNotDelete();
    error optionTradeDurationPassed();
    error exerciseNotAvailable();
    error invalidAseedOptionPeriod();
    error priceStrike();
    error totalCoverageExceed();
}
