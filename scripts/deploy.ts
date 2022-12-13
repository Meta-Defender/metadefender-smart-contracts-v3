import * as fs from 'fs-extra';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { MockRiskReserve, TestERC20 } from '../typechain-types';
import { toBN, ZERO_ADDRESS } from './util/web3utils';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const hre = require('hardhat');

async function main() {
    const Signers = await hre.ethers.getSigners();
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

    const _Policy = await hre.ethers.getContractFactory('Policy');
    const Policy = await _Policy.deploy('Policy', 'Policy');
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

    const _EpochManage = await hre.ethers.getContractFactory('EpochManage');
    const EpochManage = await _EpochManage.deploy();
    console.log('successfully deployed EpochManage: ' + EpochManage.address);
    fs.appendFileSync(
        './.env',
        'EpochManageAddress=' + '"' + EpochManage.address + '"' + '\n',
    );

    const _AmericanBinaryOptions = await hre.ethers.getContractFactory(
        'AmericanBinaryOptions',
    );
    const AmericanBinaryOptions = await _AmericanBinaryOptions.deploy();
    console.log(
        'successfully deployed AmericanBinaryOption: ' +
            AmericanBinaryOptions.address,
    );
    fs.appendFileSync(
        './.env',
        'AmericanBinaryOptionAddress=' +
            '"' +
            AmericanBinaryOptions.address +
            '"' +
            '\n',
    );

    const _TestERC20 = await hre.ethers.getContractFactory('TestERC20');
    const TestERC20 = await _TestERC20.deploy('TQA', 'TQA');
    console.log('successfully deployed TestERC20: ' + TestERC20.address);
    fs.appendFileSync(
        './.env',
        'TestERC20Address=' + '"' + TestERC20.address + '"' + '\n',
    );

    // begin init the contracts
    // init the metadefender contract
    await MetaDefender.init(
        TestERC20.address,
        Signers[0].getAddress(),
        Signers[0].getAddress(),
        MockRiskReserve.address,
        LiquidityCertificate.address,
        Policy.address,
        AmericanBinaryOptions.address,
        EpochManage.address,
        toBN('0.10'),
        toBN('0.00'),
        toBN('100'),
    );
    console.log('successfully init the MetaDefender contract');
    await LiquidityCertificate.init(MetaDefender.address, ZERO_ADDRESS);
    console.log('successfully init the LiquidityCertificate contract');
    await Policy.init(MetaDefender.address, ZERO_ADDRESS, EpochManage.address);
    console.log('successfully init the Policy contract');
    await MockRiskReserve.init(MetaDefender.address, TestERC20.address);
    console.log('successfully init the MockRiskReserve contract');
    await EpochManage.init(MetaDefender.address, LiquidityCertificate.address);
    console.log('successfully init the EpochManage contract');
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
