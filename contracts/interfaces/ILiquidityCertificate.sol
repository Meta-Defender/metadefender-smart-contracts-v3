//SPDX-License-Identifier: ISC
pragma solidity 0.8.9;

interface ILiquidityCertificate {

    struct CertificateInfo {
        uint epoch;
        uint liquidity;
        uint debtRPS;
        uint debtSPS;
    }

    struct CertificateInfoCurrent {
        // amount = liquidity * η
        uint amount;
        // frozen
        uint frozen;
        // the amount of money one can withdraw when he/she wants to exit from the pool and it will become 0 when shadow > amount
        uint withdrawal;
        // the amount of money one protect for other, which may be greater than that he/she deposits.
        uint SPS;
        // the share of pool when someone exits.
        uint liquidity;
    }

    // get the protocol address
    function protocol() external view returns (address);

    // get the metaDefender address
    function metaDefender() external view returns (address);

    // get the totalCertificateLiquidity.
    function totalValidCertificateLiquidity() external view returns (uint);

    function totalPendingEntranceCertificateLiquidity() external view returns (uint);

    function totalPendingExitCertificateLiquidity() external view returns (uint);

    function MIN_LIQUIDITY() external view returns (uint);

    function getLiquidityProviders(address owner) external view returns (uint[] memory);

    function getLiquidity(uint certificateId) external view returns (uint);

    function getEpoch(uint certificateId) external view returns (uint);

    function getCertificateInfo(uint certificateId) external view returns (CertificateInfo memory);

    function updateCertificateDebtRPS(uint certificateId, uint RPS) external;

    function newEpochCreated() external;

    function mint(
        address owner,
        uint amount,
        uint rewardDebt,
        uint shadowDebt,
        uint enteredAt
    ) external returns (uint);

    function burn(address spender, uint certificateId) external;

    function belongsTo(uint certificateId) external view returns (address);
}
