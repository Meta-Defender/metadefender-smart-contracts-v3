//SPDX-License-Identifier: ISC
pragma solidity 0.8.9;

interface ILiquidityCertificate {

    struct CertificateInfo {
        // the time one entered the liquidity pool
        uint enteredAt;
        uint liquidity;
        uint rewardDebt;
        uint shadowDebt;
    }

    // get the protocol address
    function protocol() external view returns (address);

    // get the metaDefender address
    function metaDefender() external view returns (address);

    function MIN_LIQUIDITY() external view returns (uint);

    function getLiquidityProviders(address owner) external view returns (uint[] memory);

    function getLiquidity(uint certificateId) external view returns (uint);

    function getEnteredAt(uint certificateId) external view returns (uint);

    function getCertificateInfo(uint certificateId) external view returns (CertificateInfo memory);

    function addRewardDebt(uint certificateId, uint rewards) external;

    function mint(
        address owner,
        uint amount,
        uint rewardDebt,
        uint shadowDebt
    ) external returns (uint);

    function burn(address spender, uint certificateId) external;

    function belongsTo(uint certificateId) external view returns (address);
}
