//SPDX-License-Identifier: ISC
pragma solidity 0.8.9;

interface IMetaDefenderMarketsRegistry {

    struct MarketAddresses {
        address liquidityCertificate;
        address policy;
        address epochManage;
    }

    function getInsuranceMarkets() external view returns (address[] memory);

    function getInsuranceMarketsAddresses(address[] calldata) external view returns (MarketAddresses[] memory);

}



