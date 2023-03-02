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

    function totalValidCertificateLiquidity() external view returns (uint256);

    function totalPendingCertificateLiquidity() external view returns (uint256);

    function MIN_LIQUIDITY() external view returns (uint256);

    function getLiquidityProviders(
        address owner
    ) external view returns (uint256[] memory);

    function getLiquidity(
        uint256 certificateId
    ) external view returns (uint256);

    function getCertificateInfo(
        uint256 certificateId
    ) external view returns (CertificateInfo memory);

    function updateRewardDebtEpochIndex(
        uint256 certificateId,
        uint64 currentEpochIndex
    ) external;

    function updateSPSLocked(uint256 certificateId, uint256 SPSLocked) external;

    function newEpochCreated() external;

    function mint(
        uint64 enteredEpochIndex,
        uint256 liquidity
    ) external returns (uint256);

    function decreaseLiquidity(uint256 certificateId, bool isForce) external;

    function expire(
        uint256 certificateId,
        uint64 currentEpochIndex,
        bool isForce
    ) external;

    function belongsTo(uint256 certificateId) external view returns (address);
}
