// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.9;

// Libraries
import "./Lib/SafeDecimalMath.sol";

// Inherited
import "./interfaces/IEpochManage.sol";
import "./interfaces/ILiquidityCertificate.sol";
import "./LiquidityCertificate.sol";

/// @title Epoch
/// @notice Contains functions for managing epoch processes and relevant calculations
contract EpochManage is IEpochManage {

    using SafeMath for uint;
    using SafeDecimalMath for uint;

    address public override metaDefender;
    uint256 public override currentEpoch;

    LiquidityCertificate internal liquidityCertificate;
    mapping(uint256 => EpochInfo) internal _epochInfo;

    bool public initialized = false;


    /**
     * @dev Initialize the contract.
     * @param _metaDefender MetaDefender address.
     * @param _liquidityCertificate LiquidityCertificateProtocol address.
     */
    function init(address _metaDefender, LiquidityCertificate _liquidityCertificate) external {
        require(!initialized, "already initialized");
        require(_metaDefender != address(0), "liquidityPool cannot be 0 address");
        metaDefender = _metaDefender;
        liquidityCertificate = _liquidityCertificate;
        initialized = true;
    }

    /**
     * @dev update the SPS when settle happens. This helps to calculate how much money one can get when he/she exits in providing liquidity.
                    -------tick1-----tick2-----tick3-----tick4-----tick5-----
                    --------------|------policy with SPS--------|(update here)
                    ---------0-------SPS------ SPS-------SPS-------0---------
     * @param SPS shadow per share.
     * @param duration the time from current to the policy expires.
     */
    function updateSPSInSettling(uint SPS, uint duration) external override {
        uint currentEpoch = getCurrentEpoch();
        for (uint i=1; i<= duration; i++) {
            _epochInfo[currentEpoch.add(i)].SPSInSettling = _epochInfo[currentEpoch.add(i)].SPSInSettling + SPS;
        }
    }

    /**
     * @dev update the SPS when buying happens. This helps to calculate how much one can get from he/she exits in providing liquidity.
                    -------tick1-----tick2-----tick3-----tick4-----tick5-----
                    -------------|(update here)----policy with SPS|----------
                    ---------0-------SPS------ SPS-------SPS-----------------
     * @param SPS shadow per share.
     * @param enteredAt the time when the policy is generated.
     */
    function updateSPSInBuying(uint SPS, uint enteredAt) external override {
        // enteredAt is a epoch;
        uint256 startEpochNumber = (enteredAt.sub(enteredAt % 1 days)).div(1 days);
        uint currentEpoch = getCurrentEpoch();
        uint i = 0;
        while (currentEpoch.sub(i) > enteredAt) {
            _epochInfo[currentEpoch.sub(i)].SPSInBuying = _epochInfo[currentEpoch.sub(i)].SPSInBuying.add(SPS);
            i++;
        }
    }

    function getEpochInfo() external view override returns (EpochInfo memory) {
        uint currentEpoch = getCurrentEpoch();
        return _epochInfo[currentEpoch];
    }

    function getCurrentEpoch() public view override returns (uint) {
        return (block.timestamp.sub(block.timestamp % 1 days)).div(1 days);
    }

    function isNewEpoch() external override returns (bool) {
        uint ce = getCurrentEpoch();
        if (ce != currentEpoch) {
            currentEpoch = ce;
            return true;
        } else {
            return false;
        }
    }
}
