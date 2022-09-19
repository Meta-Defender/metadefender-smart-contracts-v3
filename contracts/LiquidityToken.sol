//SPDX-License-Identifier:ISC
pragma solidity 0.8.9;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/ILiquidityToken.sol";
import "./ERC20_ForbidTransfer.sol";

contract LiquidityToken is ILiquidityToken, ERC20 {
    mapping(address => bool) permitted;

    constructor(string memory name_, string memory symbol_) ERC20(name_, symbol_) {
        permitted[msg.sender] = true;
    }

    function permitMint(address user, bool permit) external {
        require(permitted[msg.sender], "only permitted");
        permitted[user] = permit;
    }

    function mint(address account, uint amount) external override {
        require(permitted[msg.sender], "only permitted");
        ERC20._mint(account, amount);
    }

    function burn(address account, uint amount) external override {
        require(permitted[msg.sender], "only permitted");
        ERC20._burn(account, amount);
    }
}
