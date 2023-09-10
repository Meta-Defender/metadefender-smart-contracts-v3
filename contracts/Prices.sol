// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.8.0;

import "@acala-network/contracts/oracle/IOracle.sol";
import "@acala-network/contracts/utils/MandalaTokens.sol";
import './interfaces/IDEX.sol';
import './Lib/SafeDecimalMath.sol';

import 'hardhat/console.sol';


contract Prices {
    using SafeMath for uint256;
    using SafeMath for uint64;
    using SafeDecimalMath for uint256;

    address constant ORACLE = 0x0000000000000000000000000000000000000801;
    address constant DEX = 0x0000000000000000000000000000000000000803;

    IOracle oracle = IOracle(ORACLE);
    IDEX dex = IDEX(DEX);

    function getAcaPrice() public view returns (uint256) {
        uint256 price = oracle.getPrice(ACA);
        return price;
    }

    function getAcaAusdPrice() public view returns (uint256) {
        address[] memory path1 = new address[](2);
        path1[0] = AUSD;
        path1[1] = ACA;
        address[] memory path2 = new address[](2);
        path2[0] = ACA;
        path2[1] = AUSD;

        uint aseed2aca1 = dex.getSwapTargetAmount(path1, 10 ** 12);
        uint aseed2aca2 = dex.getSwapSupplyAmount(path2, 10 ** 12);

        uint aseed2aca = aseed2aca1.add(aseed2aca2).div(2);
        return aseed2aca;
    }
}