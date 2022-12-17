//SPDX-License-Identifier:ISC
pragma solidity 0.8.9;

import "../interfaces/IMetaDefender.sol";
import "../interfaces/IAmericanBinaryOptions.sol";
import "../Lib/SafeDecimalMath.sol";
import "hardhat/console.sol";
import "../interfaces/IPolicy.sol";

/**
 * @title OptionMarketViewer
 * @author MetaDefender
 * @dev Provides helpful functions to allow the dapp to operate more smoothly;
 */
contract GlobalsViewer {
    using SafeMath for uint;
    using SafeDecimalMath for uint;

    struct TradeInsuranceView {
        uint premium;
        uint fee;
        uint newRisk;
    }

    IMetaDefender internal metaDefender;
    IAmericanBinaryOptions internal americanBinaryOptions;
    ILiquidityCertificate internal liquidityCertificate;
    IPolicy internal policy;

    bool public initialized = false;

    constructor() {}

    /**
     * @dev Initializes the contract
   * @param _metaDefender MetaDefender contract address
   * @param _americanBinaryOptions AmericanBinaryOptions contract address
   */
    function init(
        IMetaDefender _metaDefender,
        IAmericanBinaryOptions _americanBinaryOptions,
        ILiquidityCertificate _liquidityCertificate,
        IPolicy _policy
    ) external {
        require(!initialized, "Contract already initialized");

        metaDefender = _metaDefender;
        americanBinaryOptions = _americanBinaryOptions;
        liquidityCertificate = _liquidityCertificate;
        policy = _policy;

        initialized = true;
    }

    /**
     * @dev Gets the premium from the AmericanBinaryOptions contract and calculates the fee.
   */
    function getPremium(uint coverage, uint duration) public view returns (TradeInsuranceView memory) {
        IMetaDefender.GlobalInfo memory globalInfo = metaDefender.getGlobalInfo();
        uint newRisk = globalInfo.risk.add(coverage.divideDecimal(globalInfo.standardRisk));
        int premium = americanBinaryOptions.americanBinaryOptionPrices(duration * 1 days, globalInfo.risk, 1000e18, 1500e18, 6e16);
        if (premium < 0) {
            premium = 0;
        }
        return TradeInsuranceView(uint(premium), 10e18, newRisk);
    }

    function getTotalValidLiquidity() public view returns (uint) {
        return liquidityCertificate.totalValidCertificateLiquidity();
    }

    function getTotalCoverage() public view returns (uint) {
        return policy.totalCoverage();
    }
}
