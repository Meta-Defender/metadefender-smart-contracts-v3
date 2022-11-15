//SPDX-License-Identifier: ISC
pragma solidity 0.8.9;

interface ILiquidityMedal {

    struct MedalInfo {
        // the time one entered the liquidity pool
        uint enteredEpoch;
        // the time one exit from the liquidity pool
        uint exitedEpoch;
        // the liquidity one entered the pool with
        uint liquidity;
        // the amount of shadowDebt when the medal was minted
        uint debtSPS;
    }

    struct MedalInfoCurrent {
        // amount = liquidity * η
        uint amount;
        // frozen
        uint frozen;
        // the amount of money one can withdraw when he/she wants to exit from the pool and it will become 0 when shadow > amount
        uint withdrawal;
        // the amount of money one protect for other, which may be greater than that he/she deposits.
        uint shadow;
        // the share of pool when someone exits.
        uint liquidity;
    }

    function metaDefender() external view returns (address);

    function protocol() external view returns (address);

    function getMedalProviders(address owner) external view returns (uint[] memory);

    function getEnteredEpoch(uint medalId) external view returns (uint);

    function getExitedEpoch(uint medalId) external view returns (uint);

    function getMedalInfo(uint medalId) external view returns (MedalInfo memory);

    function updateMedalDebtSPS(uint medalId, uint debtSPS) external;

    function belongsTo(uint medalId) external view returns (address);

    function mint(
        address owner,
        uint medalId,
        uint enteredEpoch,
        uint exitedEpoch,
        uint liquidity,
        uint debtSPS
    ) external returns (uint);

    function burn(address spender, uint medalId) external;
}
