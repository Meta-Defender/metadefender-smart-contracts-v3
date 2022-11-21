// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.9;

// Libraries
import "./Lib/SafeDecimalMath.sol";

// Inherited
import "./interfaces/IEpochManage.sol";
import "./interfaces/ILiquidityCertificate.sol";
import "./LiquidityCertificate.sol";
import "./MetaDefenderGlobals.sol";

/// @title Epoch
/// @notice Contains functions for managing epoch processes and relevant calculations
contract EpochManage is IEpochManage {

    using SafeMath for uint;
    using SafeDecimalMath for uint;

    address public override metaDefender;
    uint256 public override currentEpochIndex;
    uint256 public override epochLength;
    bool public initialized = false;

    LiquidityCertificate internal liquidityCertificate;
    MetaDefenderGlobals internal metaDefenderGlobals;
    mapping(uint256 => EpochInfo) internal _epochInfo;

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
     * @param enteredEpoch the time when the policy is generated.
     */
    function updateCrossShadow(uint SPS, uint enteredEpoch) external override {
        uint i = 0;
        while (epochLength.sub(i) > enteredEpoch) {
            uint previousEpoch = epochLength.sub(i);
            _epochInfo[previousEpoch].crossSPS= _epochInfo[previousEpoch].crossSPS.add(SPS);
            i++;
        }
    }

    function getEpochInfo(uint epochIndex) external view override returns (EpochInfo memory) {
        return _epochInfo[epochIndex];
    }

    function getCurrentEpochInfo() external view override returns(EpochInfo memory) {
        return _epochInfo[epochLength];
    }

    function getCurrentEpochIndex() external view override returns(uint) {
        return epochLength;
    }

    function getCurrentEpoch() public view override returns (uint) {
        return (block.timestamp.sub(block.timestamp % 1 days)).div(1 days);
    }

    function checkAndCreateNewEpoch() external override {
        uint cei = getCurrentEpoch();
        if (cei != _epochInfo[epochLength].epochId) {
            epochLength = epochLength.add(1);
            _epochInfo[epochLength].epochId = cei;
            metaDefenderGlobals.newEpochCreated(epochLength);
            liquidityCertificate.newEpochCreated();
        }
    }
}
