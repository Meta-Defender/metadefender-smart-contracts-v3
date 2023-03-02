import { toBN } from './util/web3utils';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const hre = require('hardhat');

async function main(
    marketName: string,
    marketSymbol: string,
    initialRisk: string,
    teamReserveRate: string,
    standardRisk: string,
) {
    // first deploy the factory contract;
    const _Factory = await hre.ethers.getContractFactory('MetaDefenderFactory');
    const factory = await _Factory.deploy();
    // deploy util contract such as quoteToken and americanBinaryOptions
    const _TestERC20 = await hre.ethers.getContractFactory('TestERC20');
    const testERC20 = await _TestERC20.deploy('TQA', 'TQA');
    const _AmericanBinaryOptions = await hre.ethers.getContractFactory(
        'AmericanBinaryOptions',
    );
    const americanBinaryOptions = await _AmericanBinaryOptions.deploy();
    await factory.deployMarkets(
        {
            marketName: marketName,
            marketSymbol: marketSymbol,
            initialRisk: toBN(initialRisk),
            teamReserveRate: toBN(teamReserveRate),
            standardRisk: toBN(standardRisk),
        },
        testERC20.address,
        americanBinaryOptions.address,
    );
}

main('COMPOUND', 'COMP', '0.1', '0', '100')
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
