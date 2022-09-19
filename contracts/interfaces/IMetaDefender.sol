//SPDX-License-Identifier: ISC
pragma solidity 0.8.9;

interface IMetaDefender {
    struct Liquidity {
        uint aUSDTotalLiquidity;
        uint aUSDLockedLiquidity;
    }

    function liquidity() external view returns (uint, uint);

    function getLiquidity() external view returns (Liquidity memory);

    function getUsableCapital() external view returns (uint);

    function buyCover(uint _coverage) external;

    function getRewards(address _provider) external view returns (uint);

    function getWithdrawalAndShadow(address _provider) external view returns (uint, uint);

    function claimRewards() external;

    function providerExit() external;

    function providerEntrance(uint _amount) external;

    function getWithdrawalAndShadowHistorical(address _provider) external view returns (uint, uint);

    function historicalProviderWithdraw() external;

    function cancelPolicy(uint _id) external;

    function policyClaimApply(uint _id) external;

    function refuseApply(uint _id) external;

    function approveApply(uint _id) external;

    function mine(uint _amount, address _to) external;
}
