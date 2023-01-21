//SPDX-License-Identifier: ISC
pragma solidity 0.8.9;

import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/utils/structs/EnumerableSet.sol';
import '../interfaces/IMetaDefenderMarketsRegistry.sol';

/**
 * @title MetaDefenderMarketsRegistry
 * @author MetaDefender
 * @dev Registry that allow external services to keep track of the deployments MetaDefender Markets
 */
contract MetaDefenderMarketsRegistry is Ownable, IMetaDefenderMarketsRegistry {
    using EnumerableSet for EnumerableSet.AddressSet;

    EnumerableSet.AddressSet internal insuranceMarkets;
    mapping(address => MarketAddresses) public insuranceMarketsAddresses;
    mapping(address => MarketMessages) public insuranceMarketsMessages;

    /**
     * @dev Method to register the addresses of a new deployments market
     *
     * @param metaDefender Address of the metaDefender contract
     * @param liquidityCertificate Address of the liquidityCertificate contract(ERC721)
     * @param policy Address of the policy contract(ERC721)
     * @param epochManage Address of the epochManage contract
     */
    function addMarket(
        address metaDefender,
        address liquidityCertificate,
        address policy,
        address epochManage,
        string memory marketName,
        string memory marketDescription,
        string memory marketPaymentToken,
        string memory marketProtectionType,
        string memory network
    ) external onlyOwner {
        require(insuranceMarkets.add(metaDefender), 'market already present');
        insuranceMarketsAddresses[metaDefender] = MarketAddresses(
            liquidityCertificate,
            policy,
            epochManage
        );
        insuranceMarketsMessages[metaDefender] = MarketMessages(
            marketName,
            marketDescription,
            marketPaymentToken,
            marketProtectionType,
            network
        );
        emit MarketAdded(
            metaDefender,
            liquidityCertificate,
            policy,
            epochManage,
            marketName,
            marketDescription,
            marketPaymentToken,
            marketProtectionType,
            network
        );
    }

    /**
     * @dev Method to remove a market
     *
     * @param metaDefender Address of the metaDefender contract
     */
    function removeMarket(address metaDefender) external onlyOwner {
        require(insuranceMarkets.remove(metaDefender), 'market not present');
        delete insuranceMarketsAddresses[metaDefender];
        delete insuranceMarketsMessages[metaDefender];

        emit MarketRemoved(metaDefender);
    }

    /**
     * @dev Gets the list of addresses of deployments MetaDefender contracts
     *
     * @return Array of MetaDefender addresses
     */
    function getInsuranceMarkets()
        external
        view
        override
        returns (address[] memory, string[] memory)
    {
        address[] memory addresses = new address[](insuranceMarkets.length());
        for (uint256 i = 0; i < insuranceMarkets.length(); i++) {
            addresses[i] = insuranceMarkets.at(i);
        }
        string[] memory messages = new string[](insuranceMarkets.length());
        for (uint256 i = 0; i < insuranceMarkets.length(); i++) {
            messages[i] = insuranceMarketsMessages[insuranceMarkets.at(i)].marketName;
        }
        return (addresses, messages);
    }

    /**
     * @dev Gets the addresses of the contracts associated to an InsuranceMarket contract
     *
     * @param insuranceMarketList Array of metaDefender contract addresses
     * @return Array of struct containing the associated contract addresses
     */
    function getInsuranceMarketsAddressesAndMessages(
        address[] calldata insuranceMarketList
    )
        external
        view
        override
        returns (MarketAddresses[] memory, MarketMessages[] memory)
    {
        MarketAddresses[] memory marketAddresses = new MarketAddresses[](
            insuranceMarketList.length
        );
        MarketMessages[] memory marketMessages = new MarketMessages[](
            insuranceMarketList.length
        );
        for (uint256 i = 0; i < insuranceMarketList.length; i++) {
            marketAddresses[i] = insuranceMarketsAddresses[
                insuranceMarketList[i]
            ];
            marketMessages[i] = insuranceMarketsMessages[
                insuranceMarketList[i]
            ];
        }
        return (marketAddresses, marketMessages);
    }

    // events
    event MarketAdded(
        address metaDefender,
        address liquidityCertificate,
        address policy,
        address epochManage,
        string marketName,
        string marketDescription,
        string marketPaymentToken,
        string marketProtectionType,
        string network
    );
    event MarketRemoved(address metaDefender);
}
