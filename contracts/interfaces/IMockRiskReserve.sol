//SPDX-License-Identifier: ISC
pragma solidity 0.8.9;

interface IMockRiskReserve {
    function payTo(address user, uint256 amount) external;

    function mockMint(uint256 amount) external;
}
