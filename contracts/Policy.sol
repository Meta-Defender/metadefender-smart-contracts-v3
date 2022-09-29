//SPDX-License-Identifier: ISC
pragma solidity 0.8.9;

// Libraries
import "./Lib/SafeDecimalMath.sol";

// Inherited
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "./interfaces/IPolicy.sol";

/**
 * @title Policy
 * @author MetaDefender
 * @dev An ERC721 token which represents a policy.
 * It is minted when users buy the cover.
 */
contract Policy is IPolicy, ERC721Enumerable {
    using SafeMath for uint;
    using SafeDecimalMath for uint;

    /// @dev The minimum amount of the coverage one can buy.
    uint public constant override MIN_COVERAGE = 1e18;

    uint internal nextId;
    mapping(uint => PolicyInfo) internal _policyInfo;
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
     * @param _metaDefender MetaDefender address.
     * @param _protocol Protocol address.
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
   * @param beneficiary The policies of a certain beneficiary.
   */
    function getPolicies(address beneficiary) external view override returns (uint[] memory) {
        uint numCerts = balanceOf(beneficiary);
        uint[] memory ids = new uint[](numCerts);

        for (uint i = 0; i < numCerts; i++) {
            ids[i] = tokenOfOwnerByIndex(beneficiary, i);
        }

        return ids;
    }

    /**
     * @notice Returns a policy's data.
   *
   * @param policyId The id of a certain policy.
   */
    function getPolicyInfo(uint policyId)
    external
    view
    override
    returns (IPolicy.PolicyInfo memory)
    {
        require(_policyInfo[policyId].enteredAt != 0, "policy does not exist");
        return _policyInfo[policyId];
    }

    /**
     * @dev find out which address is this policyId belongs to.
    *
    * @param policyId The id of the policy.
    */
    function belongsTo(uint policyId) external view returns (address) {
        return ownerOf(policyId);
    }

    /**
     * @dev Mints a new policy NFT and transfers it to `beneficiary`.
   *
   * @param beneficiary The address will benefit from the policy.
   * @param coverage The amount of money that the policy covers.
   * @param deposit The amount of money that the policy buyer deposits to prevent forgetting cancel the policy at expiry
   * @param enteredAt The timestamp when the policy buyer buys the policy.
   * @param expiredAt The timestamp when the policy expires.
   * @param shadowImpact The shadow the policy causes: shadowImpact = coverage / liquidity.totalCertificateLiquidity.
   */
    function mint(
        address beneficiary,
        uint coverage,
        uint deposit,
        uint enteredAt,
        uint expiredAt,
        uint shadowImpact
    ) external override returns (uint) {
        if (msg.sender != metaDefender) {
            revert InsufficientPrivilege();
        }

        if (coverage < MIN_COVERAGE){
            revert InsufficientCoverage();
        }

        uint policyId = nextId++;
        _policyInfo[policyId] = PolicyInfo(beneficiary, coverage, deposit, enteredAt, expiredAt, shadowImpact, false, false, false);
        _mint(beneficiary, policyId);

        emit newPolicyMinted(beneficiary, coverage, deposit, enteredAt, expiredAt, shadowImpact);
        return policyId;
    }

    /**
     * @notice isCancelAvailable the to check if the policy can be cancelled now.
   *
   * @param policyId The id of the policy.
   */
    function isCancelAvailable(uint policyId) external view override returns (bool) {
        require(_policyInfo[policyId].enteredAt != 0, "policy does not exist");
        require(_policyInfo[policyId].expiredAt < block.timestamp, "policy is not expired");
        require(_policyInfo[policyId].isCancelled == false, "policy is already cancelled");
        require(_policyInfo[policyId].isClaimApplying == false, "policy is applying for claim");
        require(_policyInfo[policyId].isClaimed == false, "policy is already claimed");
        if (policyId == 0) {
            return true;
        } else {
            return _policyInfo[policyId-1].isCancelled;
        }
    }



    /**
     * @notice Burns the LiquidityCertificate.
   *
   * @param spender The account which is performing the burn.
   * @param policyId The id of the policy.
   */
    function burn(address spender, uint policyId) external override {
        if (msg.sender != metaDefender) {
            revert InsufficientPrivilege();
        }
        require(_isApprovedOrOwner(spender, policyId), "attempted to burn nonexistent certificate, or not owner");
        delete _policyInfo[policyId];
        _burn(policyId);
    }

    /**
     * @dev Change the status of whether the policy has been claimed.
    * @param policyId The id of the policy.
    * @param status The status of whether the policy has been claimed.
    */
    function changeStatusIsClaimed(uint policyId, bool status) external override {
        if (msg.sender != metaDefender) {
            revert InsufficientPrivilege();
        }
        _policyInfo[policyId].isClaimed = status;
    }

    /**
     * @dev Change the status of whether the policy has been cancelled.
    * @param policyId The id of the policy.
    * @param status The status of whether the policy has been cancelled.
    */
    function changeStatusIsCancelled(uint policyId, bool status) external override {
        if (msg.sender != metaDefender) {
            revert InsufficientPrivilege();
        }
        require(_policyInfo[policyId].enteredAt != 0, "policy does not exist");
        _policyInfo[policyId].isCancelled = status;
    }

    /**
     * @dev Change the status of whether the policy is under claim applying.
    * @param policyId The id of the policy.
    * @param status The status of whether the policy is under claim applying.
    */
    function changeStatusIsClaimApplying(uint policyId, bool status) external override {
        if (msg.sender != metaDefender) {
            revert InsufficientPrivilege();
        }
        _policyInfo[policyId].isClaimApplying = status;
    }

    /**
     * @dev Hook that is called before any token transfer. This includes minting and burning.
   */
    function _beforeTokenTransfer(
        address, // from
        address, // to
        uint tokenId
    ) internal view override {
        // TODO: YES, actually, you can transfer you policy NFT freely, but you will never change the beneficiary in the token. which means, even you lose your NFT, you can still apply for claim when the risk happens.
    }

    error InsufficientPrivilege();
    error InsufficientCoverage();

    event newPolicyMinted(address beneficiary, uint coverage, uint deposit, uint enteredAt, uint expiredAt, uint shadowImpact);
}
