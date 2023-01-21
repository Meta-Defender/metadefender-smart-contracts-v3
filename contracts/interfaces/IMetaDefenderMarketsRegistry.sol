//SPDX-License-Identifier: ISC
pragma solidity 0.8.9;

interface IMetaDefenderMarketsRegistry {
    struct MarketAddresses {
        address liquidityCertificate;
        address policy;
        address epochManage;
    }

    struct MarketMessages {
        string marketName;
        string marketDescription;
        string marketPaymentToken;
        string protectionType;
        string network;
    }

    function getInsuranceMarkets() external view returns (address[] memory, string[] memory);

    function getInsuranceMarketsAddressesAndMessages(
        address[] calldata
    ) external view returns (MarketAddresses[] memory, MarketMessages[] memory);
}
