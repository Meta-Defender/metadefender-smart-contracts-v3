//SPDX-License-Identifier: ISC
pragma solidity 0.8.9;

import "hardhat/console.sol";

// Libraries
import "./Lib/SafeDecimalMath.sol";

// Inherited
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "./interfaces/ILiquidityCertificate.sol";

/**
 * @title LiquidityCertificate
 * @author MetaDefender
 * @dev An ERC721 token which represents a share of the LiquidityPool.
 * It is minted when users provide, and burned when users withdraw.
 */
contract LiquidityCertificate is ILiquidityCertificate, ERC721Enumerable {
    using SafeMath for uint;
    using SafeDecimalMath for uint;

    /// @dev The minimum amount of liquidity a certificate can be minted with.
    uint public constant override MIN_LIQUIDITY = 1e18;

    uint internal nextId;
    mapping(uint => CertificateInfo) internal _certificateInfo;
    address public override metaDefender;
    address public override protocol;
    uint public override totalValidCertificateLiquidity;
    uint public override totalPendingCertificateLiquidity;
    bool internal initialized = false;

    /**
     * @param _name Token collection name
   * @param _symbol Token collection symbol
   */
    constructor(string memory _name, string memory _symbol) ERC721(_name, _symbol) {}

    /**
     * @dev Initialize the contract.
   * @param _metaDefender MetaDefender address.
   * @param _protocol Protocol address.
   */
    function init(address _metaDefender, address _protocol) external {
        require(_metaDefender != address(0), "liquidityPool cannot be 0 address");
        require(!initialized, "already initialized");
        metaDefender = _metaDefender;
        protocol = _protocol;
        initialized = true;
    }

    /**
     * @dev Returns all the certificates own by a given address.
   *
   * @param owner The owner of the certificates
   */
    function getLiquidityProviders(address owner) external view override returns (uint[] memory) {
        uint numCerts = balanceOf(owner);
        uint[] memory ids = new uint[](numCerts);

        for (uint i = 0; i < numCerts; i++) {
            ids[i] = tokenOfOwnerByIndex(owner, i);
        }
        return ids;
    }

    /**
     * @notice Returns certificate's `liquidity`.
   *
   * @param certificateId The id of the LiquidityCertificate.
   */
    function getLiquidity(uint certificateId) external view override returns (uint) {
        return _certificateInfo[certificateId].liquidity;
    }

    /**
     * @notice Returns a certificate's data.
   *
   * @param certificateId The id of the LiquidityProvider.
   */
    function getCertificateInfo(uint certificateId)
    external
    view
    override
    returns (ILiquidityCertificate.CertificateInfo memory)
    {
        require(_certificateInfo[certificateId].enteredEpochIndex != 0, "certificate does not exist");
        return _certificateInfo[certificateId];
    }

    /**
     * @dev updates the reward debt when a provider claims his/her rewards.
    *
    * @param certificateId The id of the LiquidityProvider.
    */
    function updateRewardDebtEpochIndex(uint certificateId, uint64 currentEpochIndex) external override onlyMetaDefender() {
        if (msg.sender != metaDefender) {
            revert InsufficientPrivilege();
        }
        _certificateInfo[certificateId].rewardDebtEpochIndex = currentEpochIndex;
    }

    /**
     * @dev updates the reward debt when a provider claims his/her rewards.
    *
    * @param certificateId The id of the LiquidityProvider.
    */
    function updateSignalWithdrawEpochIndex(uint certificateId, uint64 currentEpochIndex) external override onlyMetaDefender() {
        if (msg.sender != metaDefender) {
            revert InsufficientPrivilege();
        }
        _certificateInfo[certificateId].signalWithdrawalEpochIndex = currentEpochIndex;
    }


    /**
     * @dev updates the reward debt when a provider claims his/her rewards.
    *
    * @param certificateId The id of the LiquidityProvider.
    */
    function updateSPSLocked(uint certificateId, uint SPSLocked) external override {
        if (msg.sender != metaDefender) {
            revert InsufficientPrivilege();
        }
        _certificateInfo[certificateId].SPSLocked= SPSLocked;
    }

    /**
     * @dev find out which address is this certificate belongs to.
    *
    * @param certificateId The id of the LiquidityProvider.
    */
    function belongsTo(uint certificateId) external view returns (address) {
        return ownerOf(certificateId);
    }

    /**
     * @dev Mints a new certificate and transfers it to `owner`.
   *
   * @param enteredEpochIndex The epoch index in which the certificate is entered.
   * @param liquidity The liquidity certificate provides.
   */
    function mint(
        uint64 enteredEpochIndex,
        uint liquidity
    ) external override onlyMetaDefender() returns (uint) {
        if (msg.sender != metaDefender) {
            revert InsufficientPrivilege();
        }

        if (liquidity < MIN_LIQUIDITY){
            revert InsufficientLiquidity();
        }

        uint certificateId = nextId++;
        _certificateInfo[certificateId] = CertificateInfo(enteredEpochIndex, 0, enteredEpochIndex, 0, liquidity, 0, true);
        // add totalLiquidity.
        totalPendingCertificateLiquidity = totalPendingCertificateLiquidity.add(liquidity);
        _mint(tx.origin, certificateId);

        emit NewLPMinted(tx.origin,certificateId,enteredEpochIndex,liquidity,address(metaDefender));
        return certificateId;
    }

    /**
     * @notice decreaseLiquidity. decrease the liquidity when user withdraws from the pool.
   *
   * @param certificateId The id of the LiquidityCertificate.
   */
    function decreaseLiquidity(uint certificateId) external override onlyMetaDefender() {
        if (msg.sender != metaDefender) {
            revert InsufficientPrivilege();
        }
        require(_isApprovedOrOwner(tx.origin, certificateId), "attempted to expire nonexistent certificate, or not owner");
        totalValidCertificateLiquidity = totalValidCertificateLiquidity.sub(_certificateInfo[certificateId].liquidity);
        totalPendingCertificateLiquidity = totalPendingCertificateLiquidity.sub(_certificateInfo[certificateId].liquidity);
    }
    
    function decreaseLiquidityByJudger(uint certificateId) external onlyMetaDefender(){
        if (msg.sender != metaDefender) {
            revert InsufficientPrivilege();
        }
        totalValidCertificateLiquidity = totalValidCertificateLiquidity.sub(_certificateInfo[certificateId].liquidity);
        totalPendingCertificateLiquidity = totalPendingCertificateLiquidity.sub(_certificateInfo[certificateId].liquidity);
    }

    /**
     * @notice expire. LiquidityCertificate.
   *
   * @param certificateId The id of the LiquidityCertificate.
   * @param currentEpochIndex the currentEpochIndex.
   */
    function expire(uint certificateId, uint64 currentEpochIndex) external override onlyMetaDefender() {
        if (msg.sender != metaDefender) {
            revert InsufficientPrivilege();
        }
        require(_isApprovedOrOwner(tx.origin, certificateId), "attempted to expire nonexistent certificate, or not owner");
        _certificateInfo[certificateId].exitedEpochIndex = currentEpochIndex;
        _certificateInfo[certificateId].isValid = false;
        emit Expired(certificateId);
    }

    function expireByJudger(uint certificateId, uint64 currentEpochIndex) external override onlyMetaDefender() {
        if (msg.sender != metaDefender) {
            revert InsufficientPrivilege();
        }
        _certificateInfo[certificateId].exitedEpochIndex = currentEpochIndex;
        _certificateInfo[certificateId].isValid = false;
        emit Expired(certificateId);
    }

    function newEpochCreated() external override {
        // when the new epoch created
        totalValidCertificateLiquidity = totalPendingCertificateLiquidity;
    }

    modifier onlyMetaDefender virtual {
        require(msg.sender == address(metaDefender), "Only MetaDefender");
        _;
    }

    error InsufficientPrivilege();
    error InsufficientLiquidity();

    event NewLPMinted(address owner, uint certificateId, uint enteredEpochIndex, uint liquidity, address protocol);
    event Expired(uint certificateId);
}
