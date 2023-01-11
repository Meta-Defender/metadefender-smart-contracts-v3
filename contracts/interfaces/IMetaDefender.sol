//SPDX-License-Identifier: ISC
pragma solidity 0.8.9;

import "./ILiquidityCertificate.sol";

interface IMetaDefender {

    struct GlobalInfo {
        uint accSPS;
        uint accRPS;
        uint accRealSPS;
        uint risk;
        uint reward4Team;
        uint standardRisk;
    }

    function getGlobalInfo() external view returns (GlobalInfo memory);

    function transferJudger(address judger) external;

    function transferOfficial(address official) external;

    function updateStandardRisk(uint standardRisk) external;

    function teamClaim() external;

    function validMiningProxyManage(address proxy, bool _isValid) external;

    function buyPolicy(address beneficiary, uint coverage, uint duration) external;

    function claimRewards(uint certificateId) external;

    function getSPSLockedByCertificateId(uint certificateId) external view returns(uint,uint);

    function certificateProviderEntrance(uint _amount) external;

    function certificateProviderExit(uint certificateId) external;

    function settlePolicy(uint policyId) external;

    function policyClaimApply(uint _id) external;

    function refuseApply(uint _id) external;

    function getRewards(uint certificateId) external view returns (uint);

    function approveApply(uint _id) external;

    function mine(uint _amount, address _to) external;

    function withdrawAfterExit(uint medalId) external;

    function getRealLiquidityByCertificateId(uint256 certificateId) external view returns(uint);

    function getLostLiquidityByCertificateId(uint256 certificateId) external view returns(uint);

    function epochCheck() external;

}
