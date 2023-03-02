//SPDX-License-Identifier: ISC
pragma solidity 0.8.9;

// oz
import '@openzeppelin/contracts/access/Ownable.sol';
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

import '../interfaces/IMetaDefender.sol';
import '../interfaces/IMockRiskReserve.sol';
import '../Test-helpers/ITestERC20.sol';

contract MockRiskReserve is IMockRiskReserve, Initializable {
    bool internal initialized;
    ITestERC20 internal aUSD;
    IMetaDefender internal metaDefender;

    function init(IMetaDefender _metaDefender, ITestERC20 _aUSD) external initializer {
        require(!initialized, 'contract already initialized');
        metaDefender = _metaDefender;
        aUSD = _aUSD;
        initialized = true;
    }

    /**
     * @dev mock payTo the user who get hacked.
     * @param amount The amount mockRiskReserve want to mint for itself.
     */
    function payTo(
        address user,
        uint256 amount
    ) external override onlyMetaDefender {
        aUSD.transfer(user, amount);
    }

    function mockMint(uint256 amount) external override {
        aUSD.mint(address(this), amount);
    }

    modifier onlyMetaDefender() virtual {
        require(msg.sender == address(metaDefender), 'Only MetaDefender');
        _;
    }
}
