//SPDX-License-Identifier: ISC
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface ILiquidityToken is IERC20 {
    function mint(address account, uint amount) external;

    function burn(address account, uint amount) external;
}
