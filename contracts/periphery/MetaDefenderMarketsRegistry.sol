//SPDX-License-Identifier: ISC
pragma solidity 0.8.9;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

/**
 * @title MetaDefenderMarketsRegistry
 * @author MetaDefender
 * @dev Registry that allow external services to keep track of the deployments MetaDefender Markets
 */
contract MetaDefenderMarketsRegistry is Ownable {
    using EnumerableSet for EnumerableSet.AddressSet;

    struct MarketAddresses {
        address liquidityCertificate;
        address policy;
        address epochManage;
    }

    EnumerableSet.AddressSet internal insuranceMarkets;
    mapping(address => MarketAddresses) public insuranceMarketsAddresses;

    event MarketAdded(address metaDefender, address liquidityCertificate, address policy, address epochManage);
    event MarketRemoved(address metaDefender);

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
        address epochManage
    ) external onlyOwner {
        require(insuranceMarkets.add(metaDefender), "market already present");
        insuranceMarketsAddresses[metaDefender] = MarketAddresses(
            liquidityCertificate,
            policy,
            epochManage
        );

        emit MarketAdded(
            metaDefender,
            liquidityCertificate,
            policy,
            epochManage
        );
    }

    /**
     * @dev Method to remove a market
   *
   * @param metaDefender Address of the metaDefender contract
   */
    function removeMarket(address metaDefender) external onlyOwner {
        require(insuranceMarkets.remove(metaDefender), "market not present");
        delete insuranceMarketsAddresses[metaDefender];

        emit MarketRemoved(metaDefender);
    }

    /**
     * @dev Gets the list of addresses of deployments MetaDefender contracts
   *
   * @return Array of MetaDefender addresses
   */
    function getInsuranceMarkets() external view returns (address[] memory) {
        address[] memory list = new address[](insuranceMarkets.length());
        for (uint i = 0; i < insuranceMarkets.length(); i++) {
            list[i] = insuranceMarkets.at(i);
        }
        return list;
    }

    /**
     * @dev Gets the addresses of the contracts associated to an OptionMarket contract
   *
   * @param insuranceMarketList Array of metaDefender contract addresses
   * @return Array of struct containing the associated contract addresses
   */
    function getInsuranceMarketsAddresses(address[] calldata insuranceMarketList)
    external
    view
    returns (MarketAddresses[] memory)
    {
        MarketAddresses[] memory marketAddresses = new MarketAddresses[](insuranceMarketList.length);
        for (uint i = 0; i < insuranceMarketList.length; i++) {
            marketAddresses[i] = insuranceMarketsAddresses[insuranceMarketList[i]];
        }
        return marketAddresses;
    }
}
