//SPDX-License-Identifier: ISC
pragma solidity 0.8.9;

// Libraries
import "./Lib/SafeDecimalMath.sol";

// Inherited
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "./interfaces/ILiquidityMedal.sol";

/**
 * @title LiquidityMedal
 * @author MetaDefender
 * @dev An ERC721 token which represents a share of the Liquidity which has been exited from the pool.
 * It is minted when the liquidity exits, and burned when the last shadow was freed.
 */
contract LiquidityMedal is ILiquidityMedal, ERC721Enumerable {
    using SafeMath for uint;
    using SafeDecimalMath for uint;

    uint internal nextId;
    mapping(uint => MedalInfo) internal _medalInfo;
    address public override metaDefender;
    address public override protocol;
    bool internal initialized = false;

    /**
     * @param _name Token collection name
   * @param _symbol Token collection symbol
   */
    constructor(string memory _name, string memory _symbol) ERC721(_name, _symbol) {}

    /**
     * @dev Initialize the contract.
   * @param _metaDefender MetaDefender address
   * @param _protocol the protocol MD is used for.
   */
    function init(address _metaDefender, address _protocol) external {
        require(!initialized, "already initialized");
        require(_metaDefender != address(0), "liquidityPool cannot be 0 address");
        metaDefender = _metaDefender;
        protocol = _protocol;
        initialized = true;
    }

    /**
     * @dev Returns all the certificates own by a given address.
   *
   * @param owner The owner of the certificates
   */
    function medalProviders(address owner) external view override returns (uint[] memory) {
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
   * @param medalId The id of the medal.
   */
    function getReserve(uint medalId) external view override returns (uint) {
        return _medalInfo[medalId].reserve;
    }

    /**
     * @notice Returns medal's `enteredAt`.
   *
   * @param medalId The id of the medal.
   */
    function getEnteredAt(uint medalId) external view override returns (uint) {
        return _medalInfo[medalId].enteredAt;
    }

    /**
     * @notice Returns medal's `burnableAt`.
   *
   * @param medalId The id of the medal.
   */
    function getExitedAt(uint medalId) external view override returns (uint) {
        return _medalInfo[medalId].exitedAt;
    }

    /**
     * @notice Returns a medal hodler's data.
   *
   * @param medalId The id of the medal.
   */
    function getMedalInfo(uint medalId)
    external
    view
    override
    returns (ILiquidityMedal.MedalInfo memory)
    {
        require(_medalInfo[medalId].enteredAt != 0, "medal does not exist");
        return _medalInfo[medalId];
    }

    /**
     * @dev updates the reward debt when a provider claims his/her rewards.
    *
    * @param medalId The id of the medal.
    * @param reserve The reserve of the medal.
    */
    function updateReserve(uint medalId, uint reserve) external override {
        if (msg.sender != metaDefender) {
            revert InsufficientPrivilege();
        }
        _medalInfo[medalId].reserve = reserve;
    }

    /**
     * @dev find out which address is this medal belongs to.
    *
    * @param medalId The id of the medal provider.
    */
    function belongsTo(uint medalId) external view returns (address) {
        return ownerOf(medalId);
    }


    /**
     * @dev Mints a new certificate and transfers it to `owner`.
   *
   * @param owner The account that will own the medal.
   * @param enteredAt The timestamp origin provider enters into the pool.
   * @param liquidity The liquidity when the provider exits from the pool.
   * @param shadowDebt The past shadow of the provider when the provider exits the system.
   * @param marketShadow The market shadow when the provider exits the system.
   */
    function mint(
        address owner,
        uint enteredAt,
        uint liquidity,
        uint reserve,
        uint shadowDebt,
        uint marketShadow
    ) external override returns (uint) {
        if (msg.sender != metaDefender) {
            revert InsufficientPrivilege();
        }

        uint medalId = nextId++;
        _medalInfo[medalId] = MedalInfo(enteredAt,block.timestamp,liquidity,reserve,shadowDebt,marketShadow);
        _mint(owner, medalId);

        emit newMedalMinted(enteredAt,block.timestamp,liquidity,reserve,shadowDebt,marketShadow);
        return medalId;
    }

    /**
     * @notice Burns the medal.
   *
   * @param spender The account which is performing the burn.
   * @param medalId The id of the medal.
   */
    function burn(address spender, uint medalId) external {
        if (msg.sender != metaDefender) {
            revert InsufficientPrivilege();
        }
        require(_isApprovedOrOwner(spender, medalId), "attempted to burn nonexistent certificate, or not owner");
        delete _medalInfo[medalId];
        _burn(medalId);
    }

    /**
     * @dev Hook that is called before any token transfer. This includes minting and burning.
   */
    function _beforeTokenTransfer(
        address, // from
        address, // to
        uint tokenId
    ) internal view override {
        // TODO: Any hooks we need for transferring the token?
    }

    error InsufficientPrivilege();
    error InsufficientLiquidity();

    event newMedalMinted(uint enteredAT, uint exitedAt, uint liquidity, uint reserve, uint shadowDebt, uint marketShadow);
}
