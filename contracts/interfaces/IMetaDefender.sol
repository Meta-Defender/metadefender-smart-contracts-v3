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
        uint256 strikeRate;
        uint256 baseRate;
    }

    function getGlobalInfo() external view returns (GlobalInfo memory);

    function transferOfficial(address official) external;

    function updateStandardRisk(uint256 standardRisk) external;

    function teamClaim() external;

    //function validMiningProxyManage(address proxy, bool _isValid) external;

    function buyPolicy(
        address beneficiary,
        uint256 coverage
    ) external;

    function claimRewards(uint256 certificateId) external;

    function getSPSLockedByCertificateId(
        uint256 certificateId
    ) external view returns (uint256, uint256);

    function certificateProviderEntrance(uint256 _amount) external;

    function certificateProviderExit(uint256 certificateId) external;

    function getRewards(
        uint256 certificateId,
        bool isExit
    ) external view returns (uint256);

    function withdrawAfterExit(uint256 medalId) external;

    function epochCheck() external;
}
