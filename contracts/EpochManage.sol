// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.9;

// Libraries
import "./Lib/SafeDecimalMath.sol";

// Inherited
import "./interfaces/IEpochManage.sol";
import "./interfaces/IMetaDefender.sol";
import "./interfaces/ILiquidityCertificate.sol";
import "./LiquidityCertificate.sol";
import "./MetaDefenderGlobals.sol";

/// @title Epoch
/// @notice Contains functions for managing epoch processes and relevant calculations
contract EpochManage is IEpochManage {

    using SafeMath for uint;
    using SafeDecimalMath for uint;

    address public override metaDefender;
    uint64 public override currentEpochIndex;
    bool public initialized = false;

    LiquidityCertificate internal liquidityCertificate;
    MetaDefenderGlobals internal metaDefenderGlobals;
    mapping(uint64 => EpochInfo) internal _epochInfo;

    /**
     * @dev Initialize the contract.
     * @param _metaDefender MetaDefender address.
     * @param _liquidityCertificate LiquidityCertificateProtocol address.
     */
    function init(address _metaDefender, LiquidityCertificate _liquidityCertificate, MetaDefenderGlobals _metaDefenderGlobals) external {
        require(!initialized, "already initialized");
        require(_metaDefender != address(0), "liquidityPool cannot be 0 address");
        metaDefender = _metaDefender;
        metaDefenderGlobals = _metaDefenderGlobals;
        liquidityCertificate = _liquidityCertificate;
        initialized = true;
    }

    /**
     * @dev update the SPS when settle happens. This helps to calculate how much money one can get when he/she exits in providing liquidity.
                    -------tick1-----tick2-----tick3-----tick4-----tick5-----
                    --------------|------policy with SPS--------|(update here)
                    ---------0-------SPS------ SPS-------SPS-------0---------
     * @param SPS shadow per share.
     * @param enteredEpochIndex the time when the policy is generated.
     */
    function updateCrossShadow(uint SPS, uint64 enteredEpochIndex) external override {
        uint i = 1;
        while (currentEpochIndex.sub(i) > enteredEpochIndex) {
            uint previousEpochIndex = currentEpochIndex.sub(i);
            _epochInfo[previousEpochIndex].crossSPS= _epochInfo[previousEpochIndex].crossSPS.add(SPS);
            i++;
        }
    }

    function getEpochInfo(uint epochIndex) external view override returns (EpochInfo memory) {
        return _epochInfo[epochIndex];
    }

    function getCurrentEpochInfo() external view override returns(EpochInfo memory) {
        return _epochInfo[currentEpochIndex];
    }

    function getCurrentEpoch() public view override returns (uint) {
        return (block.timestamp.sub(block.timestamp % 1 days)).div(1 days);
    }

    function checkAndCreateNewEpoch() external override {
        uint cei = getCurrentEpoch();
        IMetaDefender.GlobalInfo memory globalInfo = metaDefender.getGlobalInfo();
        if (cei != _epochInfo[currentEpochIndex].epochId) {
            currentEpochIndex = currentEpochIndex.add(1);
            _epochInfo[currentEpochIndex].epochId = cei;
            _epochInfo[currentEpochIndex].accRPS = globalInfo.accRPS;
            _epochInfo[currentEpochIndex].accSPS = globalInfo.accSPS;
        }
    }
}
