//SPDX-License-Identifier: ISC
pragma solidity 0.8.9;

interface IAmericanBinaryOptions {
    struct PricesDeltaStdVega {
        uint256 callPrice;
        uint256 putPrice;
        int callDelta;
        int putDelta;
        uint256 stdVega;
    }

    function mockCalculation(
        uint256 coverage,
        uint256 duration,
        uint256 risk
    ) external pure returns (uint256 premium);

    function americanBinaryOptionPrices(
        uint256 timeToExpirySec,
        uint256 volatilityDecimal,
        uint256 spotDecimal,
        uint256 strikeDecimal,
        int rateDecimal
    ) external view returns (int);

    function abs(int x) external pure returns (uint256);

    function exp(uint256 x) external pure returns (uint256);

    function exp(int x) external pure returns (uint256);

    function sqrt(uint256 x) external pure returns (uint256 y);

    function optionPrices(
        uint256 timeToExpirySec,
        uint256 volatilityDecimal,
        uint256 spotDecimal,
        uint256 strikeDecimal,
        int rateDecimal
    ) external pure returns (uint256 call, uint256 put);

    function pricesDeltaStdVega(
        uint256 timeToExpirySec,
        uint256 volatilityDecimal,
        uint256 spotDecimal,
        uint256 strikeDecimal,
        int rateDecimal
    ) external view returns (PricesDeltaStdVega memory);
}
