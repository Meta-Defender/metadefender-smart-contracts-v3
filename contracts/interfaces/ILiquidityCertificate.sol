//SPDX-License-Identifier: ISC
pragma solidity 0.8.9;

interface ILiquidityCertificate {
    struct CertificateInfo {
        uint64 enteredEpochIndex;
        uint64 exitedEpochIndex;
        uint64 rewardDebtEpochIndex;
        uint256 liquidity;
        uint256 SPSLocked;
        bool isValid;
    }

    // get the protocol address
    function protocol() external view returns (address);

    // get the metaDefender address
    function metaDefender() external view returns (address);

    function totalValidCertificateLiquidity() external view returns (uint);

    function totalPendingCertificateLiquidity() external view returns (uint);

    function MIN_LIQUIDITY() external view returns (uint);

    function getLiquidityProviders(
        address owner
    ) external view returns (uint[] memory);

    function getLiquidity(uint certificateId) external view returns (uint);

    function getCertificateInfo(
        uint certificateId
    ) external view returns (CertificateInfo memory);

    function updateRewardDebtEpochIndex(
        uint certificateId,
        uint64 currentEpochIndex
    ) external;

    function updateSPSLocked(uint certificateId, uint SPSLocked) external;

    function newEpochCreated() external;

    function mint(
        uint64 enteredEpochIndex,
        uint liquidity
    ) external returns (uint);

    function decreaseLiquidity(uint certificateId) external;

    function decreaseLiquidityByJudger(uint certificateId) external;

    function expire(uint certificateId, uint64 currentEpochIndex) external;

    function expireByJudger(
        uint certificateId,
        uint64 currentEpochIndex
    ) external;

    function belongsTo(uint certificateId) external view returns (address);
}
