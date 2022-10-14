import * as fs from 'fs-extra';
import { MockRiskReserve, TestERC20 } from '../typechain-types';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const hre = require('hardhat');

async function main() {
    // deploy
    fs.writeFileSync('./.env', '\n');

    const _MetaDefender = await hre.ethers.getContractFactory('MetaDefender');
    const MetaDefender = await _MetaDefender.deploy();
    console.log('successfully deployed MetaDefender: ' + MetaDefender.address);
    fs.appendFileSync(
        './.env',
        'MetaDefenderAddress=' + '"' + MetaDefender.address + '"' + '\n',
    );

    const _LiquidityCertificate = await hre.ethers.getContractFactory(
        'LiquidityCertificate',
    );
    const LiquidityCertificate = await _LiquidityCertificate.deploy(
        'liquidityCertificate',
        'LC',
    );
    console.log(
        'successfully deployed LiquidityCertificate: ' +
            LiquidityCertificate.address,
    );
    fs.appendFileSync(
        './.env',
        'LiquidityCertificateAddress=' +
            '"' +
            LiquidityCertificate.address +
            '"' +
            '\n',
    );

    const _LiquidityMedal = await hre.ethers.getContractFactory(
        'LiquidityMedal',
    );
    const LiquidityMedal = await _LiquidityMedal.deploy('liquidityMedal', 'LM');
    console.log(
        'successfully deployed LiquidityMedal: ' + LiquidityMedal.address,
    );
    fs.appendFileSync(
        './.env',
        'LiquidityMedalAddress=' + '"' + LiquidityMedal.address + '"' + '\n',
    );

    const _Policy = await hre.ethers.getContractFactory('Policy');
    const Policy = await _Policy.deploy('Polciy', 'Policy');
    console.log('successfully deployed Policy: ' + Policy.address);
    fs.appendFileSync(
        './.env',
        'PolicyAddress=' + '"' + Policy.address + '"' + '\n',
    );

    const _MockRiskReserve = await hre.ethers.getContractFactory(
        'MockRiskReserve',
    );
    const MockRiskReserve = await _MockRiskReserve.deploy();
    console.log(
        'successfully deployed MockRiskReserve: ' + MockRiskReserve.address,
    );
    fs.appendFileSync(
        './.env',
        'MockRiskReserveAddress=' + '"' + MockRiskReserve.address + '"' + '\n',
    );

    const _TestERC20 = await hre.ethers.getContractFactory('TestERC20');
    const TestERC20 = await _TestERC20.deploy('TQA', 'TQA');
    console.log('successfully deployed TestERC20: ' + TestERC20.address);
    fs.appendFileSync(
        './.env',
        'TestERC20Address=' + '"' + TestERC20.address + '"' + '\n',
    );
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
