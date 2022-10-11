//SPDX-License-Identifier: ISC
pragma solidity 0.8.9;

interface ILiquidityMedal {

    struct MedalInfo {
        // the time one entered the liquidity pool
        uint enteredAt;
        // the time one exit from the liquidity pool
        uint exitedAt;
        // the liquidity one entered the pool with
        uint liquidity;
        // the reserve when the medal was minted
        uint reserve;
        // the amount of shadowDebt when the medal was minted
        uint shadowDebt;
        // the shadow when this medal was minted
        uint marketShadow;
    }

    function metaDefender() external view returns (address);

    function protocol() external view returns (address);

    function getMedalProviders(address owner) external view returns (uint[] memory);

    function getReserve(uint medalId) external view returns (uint);

    function getEnteredAt(uint medalId) external view returns (uint);

    function getExitedAt(uint medalId) external view returns (uint);

    function getMedalInfo(uint medalId) external view returns (MedalInfo memory);

    function updateReserve(uint medalId, uint reserve) external;

    function belongsTo(uint medalId) external view returns (address);

    function mint(
        address owner,
        uint enteredAt,
        uint liquidity,
        uint reserve,
        uint shadowDebt,
        uint marketShadow
    ) external returns (uint);

    function burn(address spender, uint medalId) external;
}
