//SPDX-License-Identifier:ISC
pragma solidity 0.8.9;

import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import 'hardhat/console.sol';

import './ITestERC20.sol';

contract TestERC20 is ITestERC20, ERC20 {
    mapping(address => bool) permitted;
    mapping(address => uint256) mintedAmount;

    constructor(
        string memory name_,
        string memory symbol_
    ) ERC20(name_, symbol_) {
        permitted[msg.sender] = true;
    }

    function permitMint(address user, bool permit) external {
        require(permitted[msg.sender], 'only permitted');
        permitted[user] = permit;
    }

    function mint(address account, uint256 amount) external override {
        // require(permitted[msg.sender], 'only permitted');
        mintedAmount[msg.sender] += amount;
        require(mintedAmount[msg.sender] <= 50000000000000000000000, "max minted");
        ERC20._mint(account, amount);
    }

    function burn(address account, uint256 amount) external override {
        require(permitted[msg.sender], 'only permitted');
        ERC20._burn(account, amount);
    }
}
