//SPDX-License-Identifier: ISC
pragma solidity 0.8.9;

interface IMetaDefender {

    struct Liquidity {
        uint totalCertificateLiquidity;
        uint totalReserveLiquidity;
    }

    struct GlobalInfo {
        uint rewardPerShare;
        uint shadowPerShare;
        uint shadowFreedPerShare;
        uint totalCoverage;
        // keep kLast stable when the policy is expired
        uint kLast;
        // keep fee stable when user provides/removes liquidity
        uint fee;
        uint claimableTeamReward;
        // the timestamp in the latest freed policy
        uint currentFreedTs;
        // η
        uint exchangeRate;

        // fees
        uint minimumFee;
        uint initialFee;

        // liquidity
        uint totalCertificateLiquidity;
        uint totalMedalLiquidity;
    }

    function getLiquidity() external view returns (Liquidity memory);

    function getUsableCapital() external view returns (uint);

    function buyCover(uint _coverage) external;

    function getRewards(uint certificateId) external view returns (uint);

    function claimRewards(uint certificateId) external;

    function providerEntrance(address beneficiary, uint _amount) external;

    function certificateProviderExit(uint certificateId) external;

    function getWithdrawalAndShadowByCertificate(uint certificateId) external view returns (uint, uint);

    function getWithdrawalAndShadowByMedal(uint medalId) external view returns (uint, uint);

    function medalProviderWithdraw(uint medalId) external;

    function cancelPolicy(uint policyId) external;

    function policyClaimApply(uint _id) external;

    function refuseApply(uint _id) external;

    function approveApply(uint _id) external;

    function mine(uint _amount, address _to) external;
}
