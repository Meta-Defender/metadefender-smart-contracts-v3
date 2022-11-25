//SPDX-License-Identifier: ISC
pragma solidity 0.8.9;

interface ICalculatePremium {

    function calculate(uint coverage, uint duration, uint risk) external view returns (uint);

}