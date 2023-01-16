//SPDX-License-Identifier: ISC
pragma solidity 0.8.9;

import 'hardhat/console.sol';

// Libraries
import './Lib/SafeDecimalMath.sol';

// Inherited
import '@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol';
import './interfaces/ILiquidityCertificate.sol';

/**
 * @title LiquidityCertificate
 * @author MetaDefender
 * @dev An ERC721 token which represents a share of the LiquidityPool.
 * It is minted when users provide, and burned when users withdraw.
 */
contract LiquidityCertificate is ILiquidityCertificate, ERC721Enumerable {
    using SafeMath for uint256;
    using SafeDecimalMath for uint256;

    /// @dev The minimum amount of liquidity a certificate can be minted with.
    uint256 public constant override MIN_LIQUIDITY = 1e18;

    uint256 internal nextId;
    mapping(uint256 => CertificateInfo) internal _certificateInfo;
    address public override metaDefender;
    address public override protocol;
    uint256 public override totalValidCertificateLiquidity;
    uint256 public override totalPendingCertificateLiquidity;
    bool internal initialized = false;

    /**
     * @param _name Token collection name
     * @param _symbol Token collection symbol
     */
    constructor(
        string memory _name,
        string memory _symbol
    ) ERC721(_name, _symbol) {}

    /**
     * @dev Initialize the contract.
     * @param _metaDefender MetaDefender address.
     * @param _protocol Protocol address.
     */
    function init(address _metaDefender, address _protocol) external {
        require(
            _metaDefender != address(0),
            'liquidityPool cannot be 0 address'
        );
        require(!initialized, 'already initialized');
        metaDefender = _metaDefender;
        protocol = _protocol;
        initialized = true;
    }

    /**
     * @dev Returns all the certificates own by a given address.
     *
     * @param owner The owner of the certificates
     */
    function getLiquidityProviders(
        address owner
    ) external view override returns (uint256[] memory) {
        uint256 numCerts = balanceOf(owner);
        uint256[] memory ids = new uint256[](numCerts);

        for (uint256 i = 0; i < numCerts; i++) {
            ids[i] = tokenOfOwnerByIndex(owner, i);
        }
        return ids;
    }

    /**
     * @notice Returns certificate's `liquidity`.
     *
     * @param certificateId The id of the LiquidityCertificate.
     */
    function getLiquidity(
        uint256 certificateId
    ) external view override returns (uint256) {
        return _certificateInfo[certificateId].liquidity;
    }

    /**
     * @notice Returns a certificate's data.
     *
     * @param certificateId The id of the LiquidityProvider.
     */
    function getCertificateInfo(
        uint256 certificateId
    )
        external
        view
        override
        returns (ILiquidityCertificate.CertificateInfo memory)
    {
        require(
            _certificateInfo[certificateId].enteredEpochIndex != 0,
            'certificate does not exist'
        );
        return _certificateInfo[certificateId];
    }

    /**
     * @dev updates the reward debt when a provider claims his/her rewards.
     *
     * @param certificateId The id of the LiquidityProvider.
     */
    function updateRewardDebtEpochIndex(
        uint256 certificateId,
        uint64 currentEpochIndex
    ) external override onlyMetaDefender {
        _certificateInfo[certificateId]
            .rewardDebtEpochIndex = currentEpochIndex;
    }

    /**
     * @dev updates the reward debt when a provider claims his/her rewards.
     *
     * @param certificateId The id of the LiquidityProvider.
     */
    function updateSPSLocked(
        uint256 certificateId,
        uint256 SPSLocked
    ) external override onlyMetaDefender {
        _certificateInfo[certificateId].SPSLocked = SPSLocked;
    }

    /**
     * @dev find out which address is this certificate belongs to.
     *
     * @param certificateId The id of the LiquidityProvider.
     */
    function belongsTo(uint256 certificateId) external view returns (address) {
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
        uint256 liquidity
    ) external override onlyMetaDefender returns (uint256) {
        if (liquidity < MIN_LIQUIDITY) {
            revert InsufficientLiquidity();
        }

        uint256 certificateId = nextId++;
        _certificateInfo[certificateId] = CertificateInfo(
            enteredEpochIndex,
            0,
            enteredEpochIndex,
            liquidity,
            0,
            true
        );
        // add totalLiquidity.
        totalPendingCertificateLiquidity = totalPendingCertificateLiquidity.add(
            liquidity
        );
        _mint(tx.origin, certificateId);

        emit NewLPMinted(
            tx.origin,
            certificateId,
            enteredEpochIndex,
            liquidity,
            address(metaDefender)
        );
        return certificateId;
    }

    /**
     * @notice decreaseLiquidity. decrease the liquidity when user withdraws from the pool.
     *
     * @param certificateId The id of the LiquidityCertificate.
     * @param isForce Whether the certificate is force withdrawn.
     */
    function decreaseLiquidity(
        uint256 certificateId,
        bool isForce
    ) external override onlyMetaDefender {
        if (!isForce) {
            require(
                _isApprovedOrOwner(tx.origin, certificateId),
                'attempted to expire nonexistent certificate, or not owner'
            );
        }
        totalValidCertificateLiquidity = totalValidCertificateLiquidity.sub(
            _certificateInfo[certificateId].liquidity
        );
        totalPendingCertificateLiquidity = totalPendingCertificateLiquidity.sub(
            _certificateInfo[certificateId].liquidity
        );
    }

    /**
     * @notice expire. LiquidityCertificate.
     *
     * @param certificateId The id of the LiquidityCertificate.
     * @param currentEpochIndex the currentEpochIndex.
     */
    function expire(
        uint256 certificateId,
        uint64 currentEpochIndex,
        bool isForce
    ) external override onlyMetaDefender {
        if (!isForce) {
            require(
                _isApprovedOrOwner(tx.origin, certificateId),
                'attempted to expire nonexistent certificate, or not owner'
            );
        }
        _certificateInfo[certificateId].exitedEpochIndex = currentEpochIndex;
        _certificateInfo[certificateId].isValid = false;
        emit Expired(certificateId);
    }

    function newEpochCreated() external override {
        // when the new epoch created
        totalValidCertificateLiquidity = totalPendingCertificateLiquidity;
    }

    modifier onlyMetaDefender() virtual {
        require(msg.sender == address(metaDefender), 'Only MetaDefender');
        _;
    }

    error InsufficientPrivilege();
    error InsufficientLiquidity();

    event NewLPMinted(
        address owner,
        uint256 certificateId,
        uint256 enteredEpochIndex,
        uint256 liquidity,
        address protocol
    );
    event Expired(uint256 certificateId);
}
