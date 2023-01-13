//SPDX-License-Identifier: ISC
pragma solidity 0.8.9;

interface IMockRiskReserve {
    function payTo(address user, uint amount) external;

    function mockMint(uint amount) external;
}
