import { Contract } from 'ethers';
import * as fs from 'fs-extra';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const hre = require('hardhat');

export type Instances = {
    MetaDefender: Contract;
    LiquidityToken: Contract;
    MetaDefenderGlobals: Contract;
    TestQuoteAsset: Contract;
};

export async function deploy(): Promise<Instances> {
    // deploy
    fs.writeFileSync('./verify.sh', '\n');
    fs.writeFileSync('./.env.development', '\n');

    const _MetaDefender = await hre.ethers.getContractFactory('MetaDefender');
    const MetaDefender = await _MetaDefender.deploy();
    console.log('successfully deployed MetaDefender: ' + MetaDefender.address);
    fs.appendFileSync(
        './.env.development',
        'MetaDefenderAddress=' + '"' + MetaDefender.address + '"' + '\n',
    );
    fs.appendFileSync(
        './verify.sh',
        'echo "verifying MetaDefender"' +
            '\n' +
            'npx hardhat verify ' +
            MetaDefender.address +
            ' --network goerli' +
            '\n',
    );

    const _LiquidityToken = await hre.ethers.getContractFactory(
        'LiquidityToken',
    );
    const LiquidityToken = await _LiquidityToken.deploy('LP', 'LP');
    console.log(
        'successfully deployed LiquidityToken: ' + LiquidityToken.address,
    );
    fs.appendFileSync(
        './.env.development',
        'LiquidityToken=' + '"' + LiquidityToken.address + '"' + '\n',
    );
    fs.appendFileSync(
        './verify.sh',
        'echo "verifying LiquidityToken"' +
            '\n' +
            'npx hardhat verify ' +
            LiquidityToken.address +
            ' --network goerli' +
            '\n',
    );

    const _MetaDefenderGlobals = await hre.ethers.getContractFactory(
        'MetaDefenderGlobals',
    );
    const MetaDefenderGlobals = await _MetaDefenderGlobals.deploy();
    console.log(
        'successfully deployed MetaDefenderGlobal: ' +
            MetaDefenderGlobals.address,
    );
    fs.appendFileSync(
        './.env.development',
        'MetaDefenderGlobalAddress=' +
            '"' +
            MetaDefenderGlobals.address +
            '"' +
            '\n',
    );
    fs.appendFileSync(
        './verify.sh',
        'echo "verifying MetaDefenderGlobals"' +
            '\n' +
            'npx hardhat verify ' +
            MetaDefenderGlobals.address +
            ' --network goerli' +
            '\n',
    );

    const _TestQuoteAsset = await hre.ethers.getContractFactory('TestERC20');
    const TestQuoteAsset = await _TestQuoteAsset.deploy('TBA', 'TBA');
    console.log(
        'successfully deployed TestQuoteAsset: ' + TestQuoteAsset.address,
    );
    fs.appendFileSync(
        './.env.development',
        'TestQuoteAsset=' + '"' + TestQuoteAsset.address + '"' + '\n',
    );
    fs.appendFileSync(
        './verify.sh',
        'echo "verifying TestQuoteAsset"' +
            '\n' +
            'npx hardhat verify ' +
            TestQuoteAsset.address +
            ' --network goerli' +
            '\n',
    );

    const instances: Instances = {
        MetaDefender,
        LiquidityToken,
        MetaDefenderGlobals,
        TestQuoteAsset,
    };

    return instances;
}
