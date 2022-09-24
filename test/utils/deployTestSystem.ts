import { Signer } from 'ethers';
import { ethers } from 'hardhat';
import { toBN, ZERO_ADDRESS } from '../../scripts/util/web3utils';
import {
    LiquidityToken,
    MetaDefender,
    MetaDefenderGlobals,
} from '../../typechain-types';
import { TestERC20 } from '../../typechain-types';

export type TestSystemContractsType = {
    metaDefenderGlobals: MetaDefenderGlobals;
    metaDefender: MetaDefender;
    liquidityToken: LiquidityToken;
    test: {
        quoteToken: TestERC20;
    };
};

export async function deployTestContracts(
    deployer: Signer,
): Promise<TestSystemContractsType> {
    // Deploy mocked contracts

    // Deploy real contracts
    const metaDefenderGlobals = (await (
        await ethers.getContractFactory('MetaDefenderGlobals')
    )
        .connect(deployer)
        .deploy()) as MetaDefenderGlobals;

    const metaDefender = (await (
        await ethers.getContractFactory('MetaDefender')
    )
        .connect(deployer)
        .deploy()) as MetaDefender;

    const liquidityToken = (await (
        await ethers.getContractFactory('LiquidityToken')
    )
        .connect(deployer)
        .deploy('LT', 'LT')) as LiquidityToken;

    const quoteToken = (await (await ethers.getContractFactory('TestERC20'))
        .connect(deployer)
        .deploy('TQA', 'TQA')) as TestERC20;

    return {
        metaDefenderGlobals,
        metaDefender,
        liquidityToken,
        test: {
            quoteToken,
        },
    };
}

export async function initTestSystem(
    c: TestSystemContractsType,
    overrides: any,
) {
    // permit
    await c.test.quoteToken.permitMint(c.metaDefender.address, true);
    await c.liquidityToken.permitMint(c.metaDefender.address, true);

    // set initial fee
    await c.metaDefenderGlobals.setInitialFee(
        c.test.quoteToken.address,
        // the initial fee is 2%
        toBN('0.02'),
    );

    // set minimum fee
    await c.metaDefenderGlobals.setMinimumFee(
        c.test.quoteToken.address,
        // the minimum fee is 2%
        toBN('0.02'),
    );

    await c.metaDefender.init(
        c.test.quoteToken.address,
        c.liquidityToken.address,
        overrides.judger,
        overrides.official,
        overrides.marketAddress,
        overrides.riskReserve,
        c.metaDefenderGlobals.address,
    );
}

export async function deployTestSystem(
    deployer: Signer,
): Promise<TestSystemContractsType> {
    const c = await deployTestContracts(deployer);
    const deployerAddress = await deployer.getAddress();
    await initTestSystem(c, {
        judger: deployerAddress,
        official: deployerAddress,
        marketAddress: ZERO_ADDRESS,
        riskReserve: ZERO_ADDRESS,
    });
    return c;
}
