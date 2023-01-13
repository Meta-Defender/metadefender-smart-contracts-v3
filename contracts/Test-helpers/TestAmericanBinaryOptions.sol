//SPDX-License-Identifier: ISC
pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import "../AmericanBinaryOptions.sol";

contract TestAmericanBinaryOptions is AmericanBinaryOptions {
    using SafeDecimalMath for uint256;
    using SignedSafeDecimalMath for int;

    function ln_pub(uint256 x) external pure returns (int) {
        return ln(x).preciseDecimalToDecimal();
    }

    function exp_pub(int x) external pure returns (uint256) {
        return exp(x).preciseDecimalToDecimal();
    }

    function sqrt_pub(uint256 x) external pure returns (uint256) {
        return sqrt(x * 1e18);
    }

    function abs_pub(int x) external pure returns (uint256) {
        return abs(x);
    }

    function erf_pub(int x) external view returns (int) {
        return erf(x).preciseDecimalToDecimal();
    }

    function stdNormal_pub(int x) external pure returns (uint256) {
        return stdNormal(x).preciseDecimalToDecimal();
    }

    function stdNormalCDF_pub(int x) external pure returns (uint256) {
        return stdNormalCDF(x).preciseDecimalToDecimal();
    }

    function annualise_pub(uint256 secs) external pure returns (uint256 yearFraction) {
        return annualise(secs).preciseDecimalToDecimal();
    }

    function d1d2_pub(
        uint256 tAnnualised,
        uint256 volatility,
        uint256 spot,
        uint256 strike,
        int rate
    ) external pure returns (int d1, int d2) {
        (d1, d2) = d1d2(tAnnualised, volatility, spot, strike, rate);
        return (d1.preciseDecimalToDecimal(), d2.preciseDecimalToDecimal());
    }
}
