//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.9;

import './MetaDefender.sol';
import './LiquidityCertificate.sol';
import './Policy.sol';
import './EpochManage.sol';
import './Test-helpers/MockRiskReserve.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol';

contract MetaDefenderFactory is Ownable {
    ITestERC20 internal quoteToken;
    IAmericanBinaryOptions internal americanBinaryOptions;

    struct MarketSet {
        MetaDefender metaDefender;
        LiquidityCertificate liquidityCertificate;
        Policy policy;
        MockRiskReserve mockRiskReserve;
        EpochManage epochManage;
    }

    struct MarketMessage {
        string marketName;
        string marketSymbol;
        uint256 initialRisk;
        uint256 teamReserveRate;
        uint256 standardRisk;
    }

    function deployMarkets(
        MarketMessage memory _marketMessage,
        ITestERC20 _quoteToken,
        IAmericanBinaryOptions _americanBinaryOptions
    ) external onlyOwner {
        MetaDefender metaDefender = new MetaDefender();
        LiquidityCertificate liquidityCertificate = new LiquidityCertificate();
        Policy policy = new Policy();
        MockRiskReserve mockRiskReserve = new MockRiskReserve();
        EpochManage epochManage = new EpochManage();
        MarketSet memory marketSet = MarketSet(
            metaDefender,
            liquidityCertificate,
            policy,
            mockRiskReserve,
            epochManage
        );

        // then we try to init the markets.
        createProxyMarketSet(
            marketSet,
            _marketMessage,
            _quoteToken,
            _americanBinaryOptions
        );
    }

    function createProxyMarketSet(
        MarketSet memory marketSet,
        MarketMessage memory _marketMessage,
        ITestERC20 _quoteToken,
        IAmericanBinaryOptions _americanBinaryOptions
    ) internal {
        ERC1967Proxy proxyMetaDefender = new ERC1967Proxy(
            address(marketSet.metaDefender),
            abi.encodeWithSelector(
                MetaDefender(address(0)).init.selector,
                _quoteToken,
                owner(),
                owner(),
                marketSet.mockRiskReserve,
                marketSet.liquidityCertificate,
                marketSet.policy,
                _americanBinaryOptions,
                marketSet.epochManage,
                _marketMessage.initialRisk,
                _marketMessage.teamReserveRate,
                _marketMessage.standardRisk
            )
        );
        ERC1967Proxy proxyLiquidityCertificate = new ERC1967Proxy(
            address(marketSet.liquidityCertificate),
            abi.encodeWithSelector(
                LiquidityCertificate(address(0)).init.selector,
                marketSet.metaDefender,
                address(0),
                strConcat(_marketMessage.marketName, 'Certificate'),
                strConcat(_marketMessage.marketSymbol, 'C')
            )
        );
        ERC1967Proxy proxyPolicy = new ERC1967Proxy(
            address(marketSet.policy),
            abi.encodeWithSelector(
                Policy(address(0)).init.selector,
                marketSet.metaDefender,
                address(0),
                marketSet.mockRiskReserve,
                strConcat(_marketMessage.marketName, 'Policy'),
                strConcat(_marketMessage.marketSymbol, 'P')
            )
        );
        ERC1967Proxy mockRiskReserve = new ERC1967Proxy(
            address(marketSet.mockRiskReserve),
            abi.encodeWithSelector(
                MockRiskReserve(address(0)).init.selector,
                marketSet.metaDefender,
                _quoteToken
            )
        );
        ERC1967Proxy proxyEpochManage = new ERC1967Proxy(
            address(marketSet.epochManage),
            abi.encodeWithSelector(
                EpochManage(address(0)).init.selector,
                marketSet.metaDefender,
                marketSet.liquidityCertificate,
                marketSet.policy
            )
        );
        emit MetaDefenderProxyDeployed(address(proxyMetaDefender));
        emit LiquidityCertificateProxyDeployed(
            address(proxyLiquidityCertificate)
        );
        emit PolicyProxyDeployed(address(proxyPolicy));
        emit MockRiskReserveProxyDeployed(address(proxyPolicy));
        emit EpochManageProxyDeployed(address(proxyPolicy));
    }

    function strConcat(
        string memory _a,
        string memory _b
    ) public pure returns (string memory) {
        bytes memory _ba = bytes(_a);
        bytes memory _bb = bytes(_b);
        string memory ret = new string(_ba.length + _bb.length);
        bytes memory bret = bytes(ret);
        uint k = 0;
        for (uint i = 0; i < _ba.length; i++) bret[k++] = _ba[i];
        for (uint i = 0; i < _bb.length; i++) bret[k++] = _bb[i];
        return string(ret);
    }

    // events
    event MetaDefenderProxyDeployed(address proxyMetaDefender);
    event LiquidityCertificateProxyDeployed(address proxyLiquidityCertificate);
    event PolicyProxyDeployed(address proxyPolicy);
    event MockRiskReserveProxyDeployed(address proxyMockRiskReserve);
    event EpochManageProxyDeployed(address proxyEpochManage);
}
