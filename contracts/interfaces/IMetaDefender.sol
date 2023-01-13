//SPDX-License-Identifier: ISC
pragma solidity 0.8.9;

import './ILiquidityCertificate.sol';

interface IMetaDefender {
    struct GlobalInfo {
        uint256 accSPS;
        uint256 accRPS;
        uint256 accRealSPS;
        uint256 risk;
        uint256 reward4Team;
        uint256 standardRisk;
    }

    function getGlobalInfo() external view returns (GlobalInfo memory);

    function transferJudger(address judger) external;

    function transferOfficial(address official) external;

    function updateStandardRisk(uint256 standardRisk) external;

    function teamClaim() external;

    function validMiningProxyManage(address proxy, bool _isValid) external;

    function buyPolicy(
        address beneficiary,
        uint256 coverage,
        uint256 duration
    ) external;

    function claimRewards(uint256 certificateId) external;

    function getSPSLockedByCertificateId(
        uint256 certificateId
    ) external view returns (uint256, uint256);

    function certificateProviderEntrance(uint256 _amount) external;

    function certificateProviderExit(uint256 certificateId) external;

    function settlePolicy(uint256 policyId) external;

    function policyClaimApply(uint256 _id) external;

    function refuseApply(uint256 _id) external;

    function getRewards(
        uint256 certificateId,
        bool isExit
    ) external view returns (uint256);

    function approveApply(uint256 _id) external;

    function mine(uint256 _amount, address _to) external;

    function withdrawAfterExit(uint256 medalId) external;

    function getRealLiquidityByCertificateId(
        uint256 certificateId
    ) external view returns (uint256);

    function getLostLiquidityByCertificateId(
        uint256 certificateId
    ) external view returns (uint256);

    function epochCheck() external;
}
