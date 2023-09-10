//SPDX-License-Identifier:ISC
pragma solidity 0.8.9;

import '../interfaces/IMetaDefender.sol';
import '../interfaces/IAmericanBinaryOptions.sol';
import '../interfaces/IPolicy.sol';
import '../interfaces/IMetaDefenderMarketsRegistry.sol';

import '../Lib/SafeDecimalMath.sol';

/**
 * @title OptionMarketViewer
 * @author MetaDefender
 * @dev Provides helpful functions to allow the dapp to operate more smoothly;
 */
contract GlobalsViewer {
    using SafeMath for uint256;
    using SafeDecimalMath for uint256;

    struct TradeInsuranceView {
        uint256 premium;
        uint256 fee;
        uint256 newRisk;
    }

    struct GlobalsView {
        uint256 totalValidCertificateLiquidity;
        uint256 totalPendingCertificateLiquidity;
        uint256 totalCoverage;
        uint256 totalPendingCoverage;
        address protocol;
    }

    IMetaDefender internal metaDefender;
    IAmericanBinaryOptions internal americanBinaryOptions;
    ILiquidityCertificate internal liquidityCertificate;
    IMetaDefenderMarketsRegistry internal metaDefenderMarketsRegistry;
    IPolicy internal policy;

    bool public initialized = false;
    uint256 public constant BASE_POINT = 1e16;
    uint256 public constant DURATION = 25;

    constructor() {}

    /**
     * @dev Initializes the contract
     * @param _americanBinaryOptions AmericanBinaryOptions contract address
     */
    function init(
        IMetaDefenderMarketsRegistry _metaDefenderMarketsRegistry,
        IAmericanBinaryOptions _americanBinaryOptions
    ) external {
        require(!initialized, 'Contract already initialized');
        metaDefenderMarketsRegistry = _metaDefenderMarketsRegistry;
        americanBinaryOptions = _americanBinaryOptions;
        initialized = true;
    }

    /**
     * @dev Gets the premium from the AmericanBinaryOptions contract and calculates the fee.
     */
    function getPremium(
        uint256 coverage,
        address _metaDefender
    ) public view returns (TradeInsuranceView memory) {
        IMetaDefender.GlobalInfo memory globalInfo = IMetaDefender(
            _metaDefender
        ).getGlobalInfo();
        uint256 newRisk = globalInfo.risk.add(
            coverage.divideDecimal(globalInfo.standardRisk).multiplyDecimal(
                BASE_POINT
            )
        );
        int premium = americanBinaryOptions.americanBinaryOptionPrices(
            DURATION * 1 days,
            newRisk,
            1000e18,
            uint(1000e18).multiplyDecimal(globalInfo.strikeRate),
            6e16
        );
        if (premium < 0) {
            premium = 0;
        }
        uint256 basePayment = coverage.mul(globalInfo.baseRate).div(100);
        return
            TradeInsuranceView(
                uint256(premium).multiplyDecimal(coverage).add(basePayment),
                10e18,
                newRisk
            );
    }

    function getGlobals() public view returns (GlobalsView[] memory) {
        (address[] memory markets, ) = metaDefenderMarketsRegistry
            .getInsuranceMarkets();
        (
            IMetaDefenderMarketsRegistry.MarketAddresses[]
                memory marketAddresses,

        ) = metaDefenderMarketsRegistry.getInsuranceMarketsAddressesAndMessages(
                markets
            );
        uint256 totalValidCertificateLiquidityInAll = 0;
        uint256 totalPendingCertificateLiquidityInAll = 0;
        uint256 totalCoverageInAll = 0;
        uint256 totalPendingCoverageInAll = 0;
        GlobalsView[] memory globalsViews = new GlobalsView[](
            markets.length + 1
        );
        for (uint256 i = 0; i < marketAddresses.length; i++) {
            globalsViews[i] = GlobalsView(
                ILiquidityCertificate(marketAddresses[i].liquidityCertificate)
                    .totalValidCertificateLiquidity(),
                ILiquidityCertificate(marketAddresses[i].liquidityCertificate)
                    .totalPendingCertificateLiquidity(),
                IPolicy(marketAddresses[i].policy).totalCoverage(),
                IPolicy(marketAddresses[i].policy).totalPendingCoverage(),
                markets[i]
            );
            totalValidCertificateLiquidityInAll = totalValidCertificateLiquidityInAll
                .add(
                    ILiquidityCertificate(
                        marketAddresses[i].liquidityCertificate
                    ).totalValidCertificateLiquidity()
                );
            totalPendingCertificateLiquidityInAll = totalPendingCertificateLiquidityInAll
                .add(
                    ILiquidityCertificate(
                        marketAddresses[i].liquidityCertificate
                    ).totalPendingCertificateLiquidity()
                );
            totalCoverageInAll = totalCoverageInAll.add(
                IPolicy(marketAddresses[i].policy).totalCoverage()
            );
            totalPendingCoverageInAll = totalPendingCoverageInAll.add(
                IPolicy(marketAddresses[i].policy).totalPendingCoverage()
            );
        }
        globalsViews[markets.length] = GlobalsView(
            totalValidCertificateLiquidityInAll,
            totalPendingCertificateLiquidityInAll,
            totalCoverageInAll,
            totalPendingCoverageInAll,
            address(0)
        );
        return globalsViews;
    }
}
