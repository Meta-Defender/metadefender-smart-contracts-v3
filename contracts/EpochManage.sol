// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.9;

// Libraries
import './Lib/SafeDecimalMath.sol';

// Inherited
import './interfaces/IEpochManage.sol';
import './interfaces/IMetaDefender.sol';
import './interfaces/ILiquidityCertificate.sol';
import './interfaces/IPolicy.sol';
import './interfaces/IOracle.sol';
import './interfaces/IDEX.sol';

// oz
import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';

/// @title Epoch
/// @notice Contains functions for managing epoch processes and relevant calculations

// while dealing with aseed option trading, more features suggested to be added onto epoch manager
// off-chain oracle feed asseed price into epoch manage,
// together with the time passed or the current epoch index, we decide weither to allow option exercise or not
// only the first 10days allow user to buy or underwrite,but as the reward
contract EpochManage is IEpochManage, Initializable {
    using SafeMath for uint256;
    using SafeMath for uint64;
    using SafeDecimalMath for uint256;

    uint64 public override currentEpochIndex;
    bool public initialized;

    bool internal strikePriceSettled;

    //current option start time. one option for one month,
    //buy policy and underwrite is available during the first 10 days
    //withdraw can be executed on withdraw day or days after the first 10 days
    uint public startTime;
    uint256 public constant override optionTradeDuration = 10 * 86400;
    uint public contractPeriod = 30 * 86400;

    uint public strikePrice;
    address public oracleOperator;
    uint public daysAboveStrikePrice;
    mapping(uint => bool) public isAboveStrike;

    address internal aca = address(0x0000000000000000000100000000000000000000);
    address internal aseed =
        address(0x0000000000000000000100000000000000000001);

    ILiquidityCertificate internal liquidityCertificate;
    IPolicy internal policy;
    IMetaDefender internal metaDefender;
    IOracle internal oracle;
    IDEX internal dex;
    mapping(uint64 => EpochInfo) internal _epochInfo;

    /**
     * @dev Initialize the contract.
     * @param _metaDefender MetaDefender address.
     * @param _liquidityCertificate LiquidityCertificateProtocol address.
     */
    function init(
        IMetaDefender _metaDefender,
        ILiquidityCertificate _liquidityCertificate,
        IPolicy _policy,
        IOracle _oracle,
        IDEX _dex,
        address _oracleOperator
    ) external initializer {
        require(
            address(_metaDefender) != address(0),
            'liquidityPool cannot be 0 address'
        );
        metaDefender = _metaDefender;
        liquidityCertificate = _liquidityCertificate;
        policy = _policy;
        oracle = _oracle;
        dex = _dex;
        startTime = block.timestamp; //init start time
        initialized = true;
        oracleOperator = _oracleOperator;
    }

    /**
     * @dev feed the price of aseed every epoch
     */
    function feedPrice() external {
        require(msg.sender == oracleOperator && isWithdrawDay()); //start hosting price change after the first 10 days
        if (daysAboveStrikePrice >= 8) {
            return;
        }
        if (getAseedPrice() >= strikePrice) {
            if (isAboveStrike[getCurrentEpoch()] == true) {
                return;
            } else {
                isAboveStrike[getCurrentEpoch()] = true;
                daysAboveStrikePrice += 1;
            }
        } else {
            isAboveStrike[getCurrentEpoch()] = false;
            daysAboveStrikePrice = 0;
        }
    }

    /**
     * @dev set the price of strike
     * @param _price the price of strike
     */
    function setStrikePrice(uint _price) external {
        require(
            msg.sender == oracleOperator &&
                strikePriceSettled == false &&
                isWithdrawDay()
        );
        strikePriceSettled = true;
        strikePrice = _price;
    }

    function getAseedPrice() public view returns (uint) {
        address[] memory path1;
        path1[0] = aseed;
        path1[1] = aca;
        address[] memory path2;
        path2[0] = aca;
        path2[1] = aseed;
        uint aseed2aca1 = dex.getSwapTargetAmount(path1, 10 ** 12);
        uint aseed2aca2 = dex.getSwapSupplyAmount(path2, 10 ** 12);
        // aseedaca =  (aseed2aca1 + aseed2aca2) / 2
        uint aseed2aca = (aseed2aca1.add(aseed2aca2)).div(2);

        uint acaPrice = oracle.getPrice(aca);
        uint aseedPrice = aseed2aca.mul(acaPrice).div(10 ** 12);
        return aseedPrice;
    }

    /**
     * @dev update the SPS when settle happens. This helps to calculate how much money one can get when he/she exits in providing liquidity.
                    -------tick1-----tick2-----tick3-----tick4-----tick5-----
                    --------------|------policy with SPS--------|(update here)
                    ---------0-------SPS------ SPS-------SPS-------0---------
     * @param SPS shadow per share.
     * @param enteredEpochIndex the time when the policy is generated.
     */
    function updateCrossShadow(
        uint256 SPS,
        uint64 enteredEpochIndex,
        bool isClaimed
    ) external override onlyMetaDefender {
        if (!isClaimed) {
            uint64 i = 1;
            while (currentEpochIndex - i >= enteredEpochIndex) {
                uint64 previousEpochIndex = currentEpochIndex - i;
                _epochInfo[previousEpochIndex].crossSPS = _epochInfo[
                    previousEpochIndex
                ].crossSPS.add(SPS);
                i++;
            }
        } else {
            uint64 i = 0;
            while (currentEpochIndex - i >= enteredEpochIndex) {
                uint64 previousEpochIndex = currentEpochIndex - i;
                _epochInfo[previousEpochIndex].accRealSPSComp = _epochInfo[
                    previousEpochIndex
                ].accRealSPSComp.add(SPS);
                i++;
            }
        }
    }

    /**
     @dev get the withdrawDay
     */
    // withdraw is allowed after 10 tradable days
    function isWithdrawDay() public view override returns (bool) {
        uint startEpoch = (startTime.sub(startTime % 1 days)).div(1 days);
        uint currentEpoch = getCurrentEpoch();
        //return currentEpoch % 7 == 0;
        return currentEpoch.sub(startEpoch) >= 10;
    }

    /**
     @dev get the next withdrawDay
     */
    // no need for next withdraw day in aseed option
    // function nextWithdrawDay() external view override returns(uint) {
    //     uint currentEpoch = getCurrentEpoch();
    //     return ((currentEpoch / 7 + 1 ) * 7).mul(1 days);
    // }

    /**
     * @dev get epochInfo by epochIndex
     * @param epochIndex the index of the epoch.
     */
    function getEpochInfo(
        uint64 epochIndex
    ) external view override returns (EpochInfo memory) {
        return _epochInfo[epochIndex];
    }

    function getCurrentEpochInfo()
        external
        view
        override
        returns (EpochInfo memory)
    {
        return _epochInfo[currentEpochIndex];
    }

    function getCurrentEpoch() public view override returns (uint256) {
        return (block.timestamp.sub(block.timestamp % 1 days)).div(1 days);
    }

    function getTimestampFromEpoch(
        uint64 epochIndex
    ) external view override returns (uint256) {
        return _epochInfo[epochIndex].epochId.mul(1 days);
    }

    function checkAndCreateNewEpochAndUpdateLiquidity()
        external
        override
        onlyMetaDefender
        returns (bool)
    {
        uint256 cei = getCurrentEpoch();
        if (cei != _epochInfo[currentEpochIndex].epochId) {
            currentEpochIndex = currentEpochIndex + 1;
            liquidityCertificate.newEpochCreated();
            _epochInfo[currentEpochIndex].epochId = cei;
            _epochInfo[currentEpochIndex].accRPS = _epochInfo[
                currentEpochIndex - 1
            ].accRPS;
            _epochInfo[currentEpochIndex].accSPS = _epochInfo[
                currentEpochIndex - 1
            ].accSPS;
            _epochInfo[currentEpochIndex].accRealSPSComp = _epochInfo[
                currentEpochIndex - 1
            ].accRealSPSComp;
            return true;
        }
        return false;
    }

    function checkAndCreateNewEpochAndUpdateAccRPSAccSPS()
        external
        override
        onlyMetaDefender
    {
        IMetaDefender.GlobalInfo memory globalInfo = metaDefender
            .getGlobalInfo();
        policy.newEpochCreated();
        _epochInfo[currentEpochIndex].accRPS = globalInfo.accRPS;
        _epochInfo[currentEpochIndex].accSPS = globalInfo.accSPS;
    }

    modifier onlyMetaDefender() virtual {
        require(msg.sender == address(metaDefender), 'Only MetaDefender');
        _;
    }
}
