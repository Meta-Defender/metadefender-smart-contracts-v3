// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.9;

import "./interfaces/ICalculatePremium.sol";

/// @title CalculatePremium
/// @notice Contains functions for calculating premium
contract CalculatePremium is ICalculatePremium {
        function calculate(uint coverage, uint duration, uint risk) external view override returns (uint) {
            return 2e18;
        }
}