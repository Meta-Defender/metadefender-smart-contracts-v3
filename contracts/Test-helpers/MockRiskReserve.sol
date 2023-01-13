//SPDX-License-Identifier: ISC
pragma solidity 0.8.9;

import "hardhat/console.sol";

import "@openzeppelin/contracts/access/Ownable.sol";

import "../interfaces/IMetaDefender.sol";
import "../interfaces/IMockRiskReserve.sol";

import "../Test-helpers/ITestERC20.sol";

contract MockRiskReserve is IMockRiskReserve {

    bool initialized = false;
    ITestERC20 internal aUSD;
    IMetaDefender internal metaDefender;

    function init(IMetaDefender _metaDefender, ITestERC20 _aUSD) external {
        require(!initialized, "contract already initialized");
        aUSD = _aUSD;
        metaDefender = _metaDefender;
        initialized = true;
    }

    /**
    * @dev mock payTo the user who get hacked.
   * @param amount The amount mockRiskReserve want to mint for itself.
   */
    function payTo(address user, uint256 amount) external override onlyMetaDefender {
        aUSD.transfer(user, amount);
    }

    function mockMint(uint256 amount) external override {
       aUSD.mint(address(this),amount);
    }

    modifier onlyMetaDefender virtual {
        require(msg.sender == address(metaDefender), "Only MetaDefender");
        _;
    }
}