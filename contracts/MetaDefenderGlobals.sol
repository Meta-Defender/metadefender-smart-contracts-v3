//SPDX-License-Identifier: ISC
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IMetaDefenderGlobals.sol";
import "hardhat/console.sol";

contract MetaDefenderGlobals is IMetaDefenderGlobals, Ownable {
    mapping(address => uint) public override initialFee;
    mapping(address => uint) public override minimumFee;

    function setInitialFee(address _address, uint _initialFee) external override onlyOwner {
        initialFee[_address] = _initialFee;
    }

    function setMinimumFee(address _address, uint _minimumFee) external override onlyOwner {
        minimumFee[_address] = _minimumFee;
    }
}
