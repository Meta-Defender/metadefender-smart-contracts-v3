//SPDX-License-Identifier: ISC
pragma solidity ^0.8.9;

// test contracts
import 'hardhat/console.sol';

// openzeppelin contracts
import '@openzeppelin/contracts/utils/math/SafeMath.sol';
import '@openzeppelin/contracts/security/ReentrancyGuard.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol';

// interfaces
import './interfaces/IMockRiskReserve.sol';
import './interfaces/ILiquidityCertificate.sol';
import './interfaces/IPolicy.sol';
import './interfaces/IEpochManage.sol';
import './interfaces/IAmericanBinaryOptions.sol';
import './interfaces/IMetaDefender.sol';

// Libs
import './Lib/SafeDecimalMath.sol';

contract MetaDefender is
    IMetaDefender,
    ReentrancyGuardUpgradeable,
    OwnableUpgradeable
{
    using SafeMath for uint256;
    using SafeMath for uint64;
    using SafeDecimalMath for uint256;

    GlobalInfo internal globalInfo;

    IERC20 internal aUSD;
    // validMiningProxy, no need for aseed option
    //mapping(address => bool) public validMiningProxy;

    // interfaces
    ILiquidityCertificate internal liquidityCertificate;
    IPolicy internal policy;
    IMockRiskReserve internal mockRiskReserve;
    IEpochManage internal epochManage;
    IAmericanBinaryOptions internal americanBinaryOptions;

    bool private initialized;
    address public judger;
    address public official;
    address public protocol;
    uint256 public teamReserveRate;
    uint256 public constant FEE_RATE = 5e16;
    uint256 public constant FEE = 10e18;
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
        IPolicy _policy,
        // calculation
        IAmericanBinaryOptions _americanBinaryOptions,
        // functional contracts.
        IEpochManage _epochManage,
        // params
        uint256 _initialRisk,
        uint256 _teamReserveRate,
        uint256 _standardRisk
    ) external initializer {
        aUSD = _aUSD;
        judger = _judger;
        official = _official;
        mockRiskReserve = _mockRiskReserve;
        liquidityCertificate = _liquidityCertificate;
        policy = _policy;
        epochManage = _epochManage;
        americanBinaryOptions = _americanBinaryOptions;
        globalInfo.risk = _initialRisk;
        globalInfo.standardRisk = _standardRisk;
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
        aUSD.transfer(official, globalInfo.reward4Team);
        globalInfo.reward4Team = 0;
    }

    /**
     * @dev validate the mining route
     * @param proxy is the proxy address
     * @param isValid is the mining route is valid or not
     */
    // no need for aseed option
    // function validMiningProxyManage(
    //     address proxy,
    //     bool isValid
    // ) external override {
    //     if (msg.sender != official) {
    //         revert InsufficientPrivilege();
    //     }
    //     validMiningProxy[proxy] = isValid;
    // }

    /**
     * @dev updateStandardRisk
     * @param standardRisk the latest standardRisk
     */
    function updateStandardRisk(uint256 standardRisk) external override {
        if (msg.sender != official) {
            revert InsufficientPrivilege();
        }
        globalInfo.standardRisk = standardRisk;
    }

    /**
     * @dev buy Cover
     * @param beneficiary is the address to can claim the coverage.
     * @param coverage is the coverage to be secured.
     * @param duration is the time (in epoch) the policy lasts.
     */
    function buyPolicy(
        address beneficiary,
        uint256 coverage,
        uint256 duration
    ) external override nonReentrant checkNewEpoch {
        //only for aseed options. 30 days fixed
        if(duration != 30){
            revert invalidAseedOptionPeriod();
        }
        if(epochManage.daysAboveStrikePrice()>=7){
            revert priceStiked();// if already striked,no purchase
        }

        if (epochManage.isWithdrawDay()) {
            revert WithdrawDay(); //including 10days after start time in epoch manage
        }
        if (coverage > 100 * globalInfo.standardRisk) {
            revert CoverageTooLarge(coverage);
        }
        //total coverage should be lower than total liquidity
        if(totalCoverage.add(coverage)>liquidityCertificate.totalValidCertificateLiquidity()){
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
            duration * 1 days,
            globalInfo.risk,
            1000e18,
            1500e18,
            FREE_RATE
        );
        if (premium < 0) {
            premium = 0;
        }
        //15% base rate
        uint256 basePayment = coverage.mul(15).div(100);
        uint256 totalPayment = uint256(premium).multiplyDecimal(coverage).add(basePayment);
        // team reward. mocked in 5e16.
        uint256 reward4Team = totalPayment.multiplyDecimal(teamReserveRate);

        globalInfo.reward4Team = globalInfo.reward4Team.add(reward4Team);
        // fee = 10e18 which is 10 usdt.
        // the user will pay premium + reward4Team + fee
        aUSD.transferFrom(
            msg.sender,
            address(this),
            totalPayment.add(FEE).add(
                reward4Team
            )
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
            duration,
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
     //in aseed option only the first 9 days allow liquidity entrance
    function certificateProviderEntrance(
        uint256 amount
    ) external override nonReentrant checkNewEpoch {
        // certificate entrance only available in first 10 days
        // as the liquidity entered at day N will only be useful at day N+1
        // so forbid liquidity to enter after the 9th day
        uint currentEpoch = epochManage.getCurrentEpoch();
        uint startEpoch = (epochManage.startTime().sub(epochManage.startTime() % 1 days)).div(1 days);
        if(currentEpoch.sub(startEpoch) >= 9){
            revert optionTradeableDurationPassed();
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
     //liquidity exit is only allowed after the first 10 days
     //suppose, if someone calls this function just after the 10th day 24:00
     //which is before official mannually check, an "exit" might be at the same epoch with a "buy"
     //but no more "buy" can be called after the 10th day ends, so no incresement in accsps,thus no trouble brought to medals
     //modifier check new epoch deleted.
    function certificateProviderExit(
        uint256 certificateId,
        bool isForce
    ) external override nonReentrant  {
        if (!epochManage.isWithdrawDay()){
            revert NotWithdrawDay();
        }
        if (isForce) {
            if (msg.sender != judger) {
                revert InsufficientPrivilege();
            }
            (uint256 realLiquidity, ) = getRealAndLostLiquidityByCertificateId(
                certificateId
            );
            if (realLiquidity > 0) {
                revert ShouldNotDelete();
            }
        } else {
            if (msg.sender != liquidityCertificate.belongsTo(certificateId)) {
                revert InsufficientPrivilege();
            }
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

        liquidityCertificate.decreaseLiquidity(certificateId, isForce);
        liquidityCertificate.updateSPSLocked(certificateId, SPSLocked);
        uint256 rewards = getRewards(certificateId, true);
        liquidityCertificate.expire(certificateId, currentEpochIndex, isForce);
        // transfer
        if (isForce) {
            if (rewards > 0) {
                aUSD.transfer(
                    liquidityCertificate.belongsTo(certificateId),
                    rewards
                );
            }
        } else {
            uint256 fee = withdrawal.multiplyDecimal(WITHDRAWAL_FEE_RATE);
            globalInfo.reward4Team = globalInfo.reward4Team.add(fee);
            if (withdrawal.add(rewards) > 0) {
                aUSD.transfer(msg.sender, withdrawal.add(rewards).sub(fee));
            }
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
        if(block.timestamp >= epochManage.startTime() + epochManage.contractPeriod() && epochManage.daysAboveStrikePrice()<7){
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
     * @dev getRealAndLostLiquidityByCertificateId calculates the real/lost liquidity by the certificateId
     * @param certificateId the certificateId
     */
    function getRealAndLostLiquidityByCertificateId(
        uint256 certificateId
    ) public view override returns (uint256, uint256) {
        ILiquidityCertificate.CertificateInfo
            memory certificateInfo = liquidityCertificate.getCertificateInfo(
                certificateId
            );
        if (certificateInfo.isValid == false) {
            revert CertificateExit();
        }
        IEpochManage.EpochInfo memory epochInfoEntered = epochManage
            .getEpochInfo(certificateInfo.enteredEpochIndex);
        uint256 multForCertificate = SafeDecimalMath.UNIT.add(
            epochInfoEntered.accRealSPSComp
        ) >= globalInfo.accRealSPS
            ? SafeDecimalMath.UNIT.add(epochInfoEntered.accRealSPSComp).sub(
                globalInfo.accRealSPS
            )
            : 0;
        uint256 realLiquidity = certificateInfo.liquidity.multiplyDecimal(
            multForCertificate
        );
        uint256 lostLiquidity = certificateInfo.liquidity.sub(realLiquidity);
        return (realLiquidity, lostLiquidity);
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
     //modifier check new epoch deleted
    function withdrawAfterExit(
        uint256 certificateId
    ) external override nonReentrant  {
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
     * @dev settle the policy by a policy id
     * @param policyId the Id of policy.
     */
     // in asseed option, no need to settle policy
     // if ended with unstrike,every policy becomes useless,thus every LC can be withdrawn completely
     // at that time just set all shadow to 0
     // if ended with strike, which means "claim", of course no settle
    // function settlePolicy(uint256 policyId) external override checkNewEpoch {
    //     IPolicy.PolicyInfo memory policyInfo = policy.getPolicyInfo(policyId);
    //     if (policy.isSettleAvailable(policyId)) {
    //         policy.changeStatusIsSettled(policyId, true);
    //         epochManage.updateCrossShadow(
    //             policyInfo.SPS,
    //             policyInfo.enteredEpochIndex,
    //             false
    //         );
    //         // change the SPS.
    //         globalInfo.accSPS = globalInfo.accSPS.sub(policyInfo.SPS);
    //         // reduce the risk.
    //         globalInfo.risk = globalInfo.risk.sub(
    //             policyInfo
    //                 .coverage
    //                 .divideDecimal(policyInfo.standardRisk)
    //                 .multiplyDecimal(BASE_POINT)
    //         );
    //         if (
    //             policyInfo.timestamp.add(policyInfo.duration * 1 days).add(
    //                 BUFFER * 1 days
    //             ) >= block.timestamp
    //         ) {
    //             // to make sure the policyHolder himself settle.
    //             require(
    //                 msg.sender == policyInfo.beneficiary,
    //                 'Only policy holder can settle the policy in 3 days'
    //             );
    //             aUSD.transfer(policyInfo.beneficiary, policyInfo.fee);
    //         } else {
    //             aUSD.transfer(msg.sender, policyInfo.fee);
    //         }
    //     }
    //     emit PolicyCancelled(policyId);
    // }

    /**
     * @dev claim the policy by a policy id
     * @param policyId the Id of policy.
     * @param isReserve whether the reserve is enough to pay the claim.
     */
     // as no reserve in aseed option now, the seconde param is always false now
     // so a rewritten version added below
    function claimPolicy(
        uint256 policyId,
        bool isReserve
    ) internal  {
        IPolicy.PolicyInfo memory policyInfo = policy.getPolicyInfo(policyId);
        if (policy.isClaimAvailable(policyId)) {
            policy.changeStatusIsSettled(policyId, true);

            if (isReserve) {
                epochManage.updateCrossShadow(
                    policyInfo.SPS,
                    policyInfo.enteredEpochIndex,
                    false
                );
                // we will change the SPS.
                globalInfo.accSPS = globalInfo.accSPS.sub(policyInfo.SPS);
                // in claiming, we will not reduce the risk exposure.
            } else {
                globalInfo.accRealSPS = globalInfo.accRealSPS.add(
                    policyInfo.SPS
                );
                epochManage.updateCrossShadow(
                    policyInfo.SPS,
                    policyInfo.enteredEpochIndex,
                    true
                );
            }

            aUSD.transfer(policyInfo.beneficiary, policyInfo.fee);
            emit PolicyClaimed(policyId);
        } else {
            revert NotClaimAvailable();
        }
    }

    function claimPolicy(
        uint256 policyId
    ) internal {
        IPolicy.PolicyInfo memory policyInfo = policy.getPolicyInfo(policyId);
        if (policy.isClaimAvailable(policyId)) {
            policy.changeStatusIsSettled(policyId, true);

                globalInfo.accRealSPS = globalInfo.accRealSPS.add(
                    policyInfo.SPS
                );
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
     * @dev the process the policy holder applies for.
     *
     * @param policyId the policy id
     */
     //modifier check epoch deleted since this is only callable after 10 days
    function policyClaimApply(
        uint256 policyId
    ) external override  {
        // only for aseed option
        if(epochManage.daysAboveStrikePrice()<7){
            revert NotExerciseable();
        }
        //else，option exercise allowed

        IPolicy.PolicyInfo memory policyInfo = policy.getPolicyInfo(policyId);
        IEpochManage.EpochInfo memory enteredEpochInfo = epochManage
            .getEpochInfo(policyInfo.enteredEpochIndex);
        IEpochManage.EpochInfo memory currentEpochInfo = epochManage
            .getCurrentEpochInfo();

        // in aseed option, once striked, exerciseable at any time
        // if (
        //     currentEpochInfo.epochId >
        //     enteredEpochInfo.epochId.add(policyInfo.duration).add(BUFFER)
        // ) {
        //     revert PolicyAlreadyStale(policyId);
        // }

        if (policyInfo.isClaimed == true) {
            revert PolicyAlreadyClaimed(policyId);
        }
        if (policyInfo.isSettled == true) { // kept although settle is not used in aseed option
            revert PolicyAlreadySettled(policyId);
        }
        if (policyInfo.beneficiary != msg.sender) {
            revert SenderNotBeneficiary(policyInfo.beneficiary, msg.sender);
        }
        if (policyInfo.isClaimApplying == true) { // kept although claimable or not is decided while apply
            revert ClaimUnderProcessing(policyId);
        }
        policy.changeStatusIsClaimApplying(policyId, true);
        
        //migrated from appove apply function for immediate exercise
        //claimPolicy(policyId, false);
        claimPolicy(policyId);
        aUSD.transfer(policyInfo.beneficiary, policyInfo.coverage);
        policy.changeStatusIsClaimed(policyId, true);
    }

    /**
     * @dev the refusal of the policy apply.
     *
     * @param policyId the policy id
     */
     // no official refuse in aseed option
    // function refuseApply(uint256 policyId) external override {
    //     if (msg.sender != judger) {
    //         revert InsufficientPrivilege();
    //     }
    //     IPolicy.PolicyInfo memory policyInfo = policy.getPolicyInfo(policyId);
    //     if (policyInfo.isClaimApplying == false) {
    //         revert ClaimNotUnderProcessing(policyId);
    //     }
    //     policy.changeStatusIsClaimApplying(policyId, false);
    // }

    /**
     * @dev the approval of the policy apply.
     *
     * @param policyId the policy id
     */
     //no official approve in aseed option,some inner feature moved to claim apply function
    // function approveApply(uint256 policyId) external override {
    //     if (msg.sender != judger) {
    //         revert InsufficientPrivilege();
    //     }
    //     IPolicy.PolicyInfo memory policyInfo = policy.getPolicyInfo(policyId);
    //     if (policyInfo.isClaimApplying == false) {
    //         revert ClaimNotUnderProcessing(policyId);
    //     }
    //     if (aUSD.balanceOf(address(mockRiskReserve)) >= policyInfo.coverage) {
    //         claimPolicy(policyId, true);
    //         mockRiskReserve.payTo(policyInfo.beneficiary, policyInfo.coverage);
    //     } else {
    //         // we will pay as more as we can.
    //         claimPolicy(policyId, false);
    //         aUSD.transfer(policyInfo.beneficiary, policyInfo.coverage);
    //     }
    //     policy.changeStatusIsClaimApplying(policyId, false);
    //     policy.changeStatusIsClaimed(policyId, true);
    // }

    /**
     * @dev mine with available capital.
     *
     * @param _to the proxy address
     * @param _amount the amount of ausd to be used for mining.
     */
     // no mine function in aseed option currently
    // function mine(uint256 _amount, address _to) external override {
    //     if (msg.sender != judger) {
    //         revert InsufficientPrivilege();
    //     }
    //     if (_to == address(0)) {
    //         revert InvalidAddress(_to);
    //     }
    //     if (validMiningProxy[_to] == false) {
    //         revert InvalidMiningProxy(_to);
    //     }
    //     aUSD.transfer(_to, _amount);
    // }

    // reward earned at day 10 would be checkable at day 11
    // so official address manually call this function to "execute" day 11
    // only callable once
    function epochCheck() external override checkNewEpoch {
        require(msg.sender == official && !manuallyChecked);
        require(block.timestamp > epochManage.startTime()+epochManage.optionTradeableDuration());
        manuallyChecked = true;
    }

    modifier checkNewEpoch() virtual {
        if(!manuallyChecked){
            epochManage.checkAndCreateNewEpochAndUpdateLiquidity();
            }
        _;
        if(!manuallyChecked){
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
    error optionTradeableDurationPassed();
    error NotExerciseable();
    error invalidAseedOptionPeriod();
    error priceStiked();
    error totalCoverageExceed();
}
