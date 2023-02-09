//SPDX-License-Identifier: ISC
pragma solidity 0.8.9;

// Libraries
import './Lib/SafeDecimalMath.sol';

// Inherited
import '@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol';
import './interfaces/IPolicy.sol';
import './interfaces/IEpochManage.sol';

/**
 * @title Policy
 * @author MetaDefender
 * @dev An ERC721 token which represents a policy.
 * It is minted when users buy the cover.
 */
contract Policy is IPolicy, ERC721Enumerable {
    using SafeMath for uint256;
    using SafeDecimalMath for uint256;

    /// @dev The minimum amount of the coverage one can buy.
    uint256 public constant override MIN_COVERAGE = 1e18;

    uint256 internal nextId;
    mapping(uint256 => PolicyInfo) internal _policyInfo;
    address public override metaDefender;
    address public override protocol;
    bool internal initialized = false;
    IEpochManage internal epochManage;
    uint256 public override totalCoverage;
    uint256 public override totalPendingCoverage;

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
    function init(
        address _metaDefender,
        address _protocol,
        IEpochManage _epochManage
    ) external {
        require(!initialized, 'already initialized');
        require(
            _metaDefender != address(0),
            'liquidityPool cannot be 0 address'
        );
        metaDefender = _metaDefender;
        protocol = _protocol;
        epochManage = _epochManage;
        initialized = true;
    }

    /**
     * @dev Returns all the certificates own by a given address.
     *
     * @param beneficiary The policies of a certain beneficiary.
     */
    function getPolicies(
        address beneficiary
    ) external view override returns (uint256[] memory) {
        uint256 numCerts = balanceOf(beneficiary);
        uint256[] memory ids = new uint256[](numCerts);

        for (uint256 i = 0; i < numCerts; i++) {
            ids[i] = tokenOfOwnerByIndex(beneficiary, i);
        }

        return ids;
    }

    /**
     * @notice Returns a policy's data.
     *
     * @param policyId The id of a certain policy.
     */
    function getPolicyInfo(
        uint256 policyId
    ) external view override returns (IPolicy.PolicyInfo memory) {
        require(
            _policyInfo[policyId].enteredEpochIndex != 0,
            'policy does not exist'
        );
        return _policyInfo[policyId];
    }

    /**
     * @dev find out which address is this policyId belongs to.
     *
     * @param policyId The id of the policy.
     */
    function belongsTo(uint256 policyId) external view returns (address) {
        return ownerOf(policyId);
    }

    /**
     * @dev Mints a new policy NFT and transfers it to `beneficiary`.
     * @param beneficiary The address will benefit from the policy.
     * @param coverage The amount of money that the policy covers.
     * @param fee The amount of money that the policy buyer deposits to prevent forgetting cancel the policy at expiry
     * @param enteredEpochIndex The epochIndex when the policy buyer buys the policy.
     * @param duration The duration of the policy
     * @param SPS the shadow still captured in the medalNFT.
     */
    function mint(
        address beneficiary,
        uint256 coverage,
        uint256 fee,
        uint64 enteredEpochIndex,
        uint256 duration,
        uint256 SPS,
        uint256 standardRisk,
        uint256 timestamp
    ) external override onlyMetaDefender returns (uint256) {
        if (msg.sender != metaDefender) {
            revert InsufficientPrivilege();
        }

        if (coverage < MIN_COVERAGE) {
            revert InsufficientCoverage();
        }

        totalPendingCoverage = totalPendingCoverage.add(coverage);

        uint256 policyId = nextId++;
        _policyInfo[policyId] = PolicyInfo(
            beneficiary,
            coverage,
            fee,
            timestamp,
            duration,
            standardRisk,
            enteredEpochIndex,
            SPS,
            false,
            false,
            false
        );
        _mint(beneficiary, policyId);

        emit NewPolicyMinted(
            beneficiary,
            policyId,
            timestamp,
            coverage,
            fee,
            duration,
            standardRisk,
            enteredEpochIndex,
            SPS,
            address(metaDefender),
            address(epochManage)
        );
        return policyId;
    }

    /**
     * @notice isCancelAvailable the to check if the policy can be cancelled now.
     * @param policyId The id of the policy.
     */
    function isSettleAvailable(
        uint256 policyId
    ) external view override returns (bool) {
        require(
            _policyInfo[policyId].timestamp.add(
                _policyInfo[policyId].duration * 1 days
            ) < block.timestamp,
            'policy is not expired'
        );
        require(
            _policyInfo[policyId].enteredEpochIndex != 0,
            'policy does not exist'
        );
        require(
            _policyInfo[policyId].isSettled == false,
            'policy is already cancelled'
        );
        require(
            _policyInfo[policyId].isClaimApplying == false,
            'policy is applying for claim'
        );
        require(
            _policyInfo[policyId].isClaimed == false,
            'policy is already claimed'
        );
        return true;
    }

    /**
     * @notice isCancelAvailable the to check if the policy can be cancelled now.
     * @param policyId The id of the policy.
     */
    function isClaimAvailable(
        uint256 policyId
    ) external view override returns (bool) {
        require(
            _policyInfo[policyId].enteredEpochIndex != 0,
            'policy does not exist'
        );
        require(
            _policyInfo[policyId].isSettled == false,
            'policy is already cancelled'
        );
        require(
            _policyInfo[policyId].isClaimApplying == true,
            'policy is not applying for claim'
        );
        require(
            _policyInfo[policyId].isClaimed == false,
            'policy is already claimed'
        );
        return true;
    }

    /**
     * @notice Burns the LiquidityCertificate.
     *
     * @param spender The account which is performing the burn.
     * @param policyId The id of the policy.
     */
    function burn(
        address spender,
        uint256 policyId
    ) external override onlyMetaDefender {
        if (msg.sender != metaDefender) {
            revert InsufficientPrivilege();
        }
        require(
            _isApprovedOrOwner(spender, policyId),
            'attempted to burn nonexistent certificate, or not owner'
        );
        delete _policyInfo[policyId];
        _burn(policyId);
    }

    function newEpochCreated() external override {
        // when the new epoch created
        totalCoverage = totalPendingCoverage;
    }

    /**
     * @dev Change the status of whether the policy has been claimed.
     * @param policyId The id of the policy.
     * @param status The status of whether the policy has been claimed.
     */
    function changeStatusIsClaimed(
        uint256 policyId,
        bool status
    ) external override onlyMetaDefender {
        if (msg.sender != metaDefender) {
            revert InsufficientPrivilege();
        }
        _policyInfo[policyId].isClaimed = status;
        emit PolicyClaimed(policyId, status);
    }

    /**
     * @dev Change the status of whether the policy has been cancelled.
     * @param policyId The id of the policy.
     * @param status The status of whether the policy has been cancelled.
     */
    function changeStatusIsSettled(
        uint256 policyId,
        bool status
    ) external override onlyMetaDefender {
        if (msg.sender != metaDefender) {
            revert InsufficientPrivilege();
        }
        require(
            _policyInfo[policyId].enteredEpochIndex != 0,
            'policy does not exist'
        );
        _policyInfo[policyId].isSettled = status;
        // if the policy is settled with any reason(expire to settle or claim to settle), the totalCoverage will be reduced;
        totalPendingCoverage = totalPendingCoverage.sub(
            _policyInfo[policyId].coverage
        );
        emit PolicySettled(policyId, status);
    }

    /**
     * @dev Change the status of whether the policy is under claim applying.
     * @param policyId The id of the policy.
     * @param status The status of whether the policy is under claim applying.
     */
    function changeStatusIsClaimApplying(
        uint256 policyId,
        bool status
    ) external override onlyMetaDefender {
        if (msg.sender != metaDefender) {
            revert InsufficientPrivilege();
        }
        _policyInfo[policyId].isClaimApplying = status;
        emit PolicyUnderClaimApplying(policyId, status);
    }

    modifier onlyMetaDefender() virtual {
        require(msg.sender == address(metaDefender), 'Only MetaDefender');
        _;
    }

    error InsufficientPrivilege();
    error InsufficientCoverage();

    // events
    event PolicyUnderClaimApplying(uint256 policyId, bool status);
    event PolicyClaimed(uint256 policyId, bool status);
    event PolicySettled(uint256 policyId, bool status);
    event NewPolicyMinted(
        address beneficiary,
        uint256 policyId,
        uint256 timestamp,
        uint256 coverage,
        uint256 fee,
        uint256 duration,
        uint256 standardRisk,
        uint256 enteredEpochIndex,
        uint256 SPS,
        address protocol,
        address epochManage
    );
}
