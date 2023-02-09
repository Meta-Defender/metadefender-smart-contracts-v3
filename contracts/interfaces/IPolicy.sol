//SPDX-License-Identifier: ISC
pragma solidity 0.8.9;

interface IPolicy {
    struct PolicyInfo {
        address beneficiary;
        uint256 coverage;
        uint256 fee;
        uint256 timestamp;
        uint256 duration;
        uint256 standardRisk;
        uint64 enteredEpochIndex;
        uint256 SPS;
        bool isClaimed;
        bool isClaimApplying;
        bool isSettled;
    }

    // get the protocol address
    function protocol() external view returns (address);

    // get the metaDefender address
    function metaDefender() external view returns (address);

    function MIN_COVERAGE() external view returns (uint256);

    function totalCoverage() external view returns (uint256);

    function totalPendingCoverage() external view returns (uint256);

    function getPolicies(
        address beneficiary
    ) external view returns (uint256[] memory);

    function getPolicyInfo(
        uint256 policyId
    ) external view returns (PolicyInfo memory);

    function mint(
        address beneficiary,
        uint256 coverage,
        uint256 fee,
        uint64 enteredEpochIndex,
        uint256 duration,
        uint256 SPS,
        uint256 standardRisk,
        uint256 timestamp
    ) external returns (uint256);

    function burn(address spender, uint256 certificateId) external;

    function belongsTo(uint256 policyId) external view returns (address);

    function isSettleAvailable(uint256 policyId) external view returns (bool);

    function isClaimAvailable(uint256 policyId) external view returns (bool);

    function newEpochCreated() external;

    function changeStatusIsClaimed(uint256 policyId, bool status) external;

    function changeStatusIsClaimApplying(
        uint256 policyId,
        bool status
    ) external;

    function changeStatusIsSettled(uint256 policyId, bool status) external;
}
