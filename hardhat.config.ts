import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
import 'solidity-coverage';
require('@nomicfoundation/hardhat-chai-matchers');

const config: HardhatUserConfig = {
    solidity: {
        version: '0.8.9',
        settings: {
            optimizer: {
                enabled: true,
                runs: 200,
            },
        },
    },
    networks: {
        goerli: {
            url: 'https://eth-goerli.g.alchemy.com/v2/QcFlKsNZbPZkqKT3zkIbe_uGZ57y53Ba',
            accounts: [
                '7e8444e3b47e706d2190801a32c568edeaeab2fe16e9dafdb774a6fdc5a211b8',
            ],
            allowUnlimitedContractSize: true,
        },
    },
};

export default config;
