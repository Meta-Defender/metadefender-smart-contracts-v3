//SPDX-License-Identifier: ISC
pragma solidity 0.8.9;

interface IPolicy {

    struct PolicyInfo {
        address beneficiary;
        uint coverage;
        uint fee;
        uint duration;
        uint standardRisk;
        uint64 enteredEpochIndex;
        uint SPS;
        bool isClaimed;
        bool isClaimApplying;
        bool isSettled;
    }

    // get the protocol address
    function protocol() external view returns (address);

    // get the metaDefender address
    function metaDefender() external view returns (address);

    function MIN_COVERAGE() external view returns (uint);

    function getPolicies(address beneficiary) external view returns (uint[] memory);

    function getPolicyInfo(uint policyId) external view returns (PolicyInfo memory);

    function mint(
        address beneficiary,
        uint coverage,
        uint fee,
        uint64 enteredEpochIndex,
        uint duration,
        uint SPS,
        uint standardRisk
    ) external returns (uint);

    function burn(address spender, uint certificateId) external;

    function belongsTo(uint policyId) external view returns (address);

    function isSettleAvailable(uint policyId) external view returns (bool);

    function isClaimAvailable(uint policyId) external view returns (bool);

    function changeStatusIsClaimed(uint policyId, bool status) external;

    function changeStatusIsClaimApplying(uint policyId, bool status) external;

    function changeStatusIsSettled(uint policyId, bool status) external;
}
