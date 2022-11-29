//SPDX-License-Identifier: ISC
pragma solidity 0.8.9;

interface IAmericanBinaryOptions {

    struct PricesDeltaStdVega {
        uint callPrice;
        uint putPrice;
        int callDelta;
        int putDelta;
        uint stdVega;
    }

    function mockCalculation(uint coverage, uint duration, uint risk) external pure returns(uint premium);

    function americanBinaryOptionPrices(
        uint timeToExpirySec,
        uint volatilityDecimal,
        uint spotDecimal,
        uint strikeDecimal,
        int rateDecimal
    ) external view returns (int);

    function abs(int x) external pure returns (uint);

    function exp(uint x) external pure returns (uint);

    function exp(int x) external pure returns (uint);

    function sqrt(uint x) external pure returns (uint y);

    function optionPrices(
        uint timeToExpirySec,
        uint volatilityDecimal,
        uint spotDecimal,
        uint strikeDecimal,
        int rateDecimal
    ) external pure returns (uint call, uint put);

    function pricesDeltaStdVega(
        uint timeToExpirySec,
        uint volatilityDecimal,
        uint spotDecimal,
        uint strikeDecimal,
        int rateDecimal
    ) external view returns (PricesDeltaStdVega memory);
}
