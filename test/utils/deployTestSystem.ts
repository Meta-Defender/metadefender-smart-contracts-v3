import { Signer } from 'ethers';
import { ethers } from 'hardhat';
import { toBN, ZERO_ADDRESS } from '../../scripts/util/web3utils';
import {
    MetaDefender,
    LiquidityCertificate,
    LiquidityMedal,
    Policy,
    MockRiskReserve,
    MetaDefenderGlobals,
    EpochManage,
} from '../../typechain-types';
import { TestERC20 } from '../../typechain-types';

export type TestSystemContractsType = {
    metaDefender: MetaDefender;
    metaDefenderGlobals: MetaDefenderGlobals;
    liquidityCertificate: LiquidityCertificate;
    liquidityMedal: LiquidityMedal;
    policy: Policy;
    epochManage: EpochManage;
    mockRiskReserve: MockRiskReserve;
    test: {
        quoteToken: TestERC20;
    };
};

export async function deployTestContracts(
    deployer: Signer,
): Promise<TestSystemContractsType> {
    // Deploy mocked contracts

    // Deploy real contracts
    const metaDefender = (await (
        await ethers.getContractFactory('MetaDefender')
    )
        .connect(deployer)
        .deploy()) as MetaDefender;

    const liquidityCertificate = (await (
        await ethers.getContractFactory('LiquidityCertificate')
    )
        .connect(deployer)
        .deploy('liquidityCertificate', 'LC')) as LiquidityCertificate;

    const liquidityMedal = (await (
        await ethers.getContractFactory('LiquidityMedal')
    )
        .connect(deployer)
        .deploy('liquidityMedal', 'LM')) as LiquidityMedal;

    const policy = (await (await ethers.getContractFactory('Policy'))
        .connect(deployer)
        .deploy('policy', 'Policy')) as Policy;

    const mockRiskReserve = (await (
        await ethers.getContractFactory('MockRiskReserve')
    )
        .connect(deployer)
        .deploy()) as MockRiskReserve;

    const quoteToken = (await (await ethers.getContractFactory('TestERC20'))
        .connect(deployer)
        .deploy('TQA', 'TQA')) as TestERC20;

    const epochManage = (await (await ethers.getContractFactory('EpochManage'))
        .connect(deployer)
        .deploy()) as EpochManage;

    const metaDefenderGlobals = (await (
        await ethers.getContractFactory('MetaDefenderGlobals')
    )
        .connect(deployer)
        .deploy()) as MetaDefenderGlobals;

    return {
        metaDefender,
        metaDefenderGlobals,
        liquidityCertificate,
        liquidityMedal,
        policy,
        mockRiskReserve,
        epochManage,
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

    await c.metaDefender.init(
        c.test.quoteToken.address,
        overrides.judger || ZERO_ADDRESS,
        overrides.official || ZERO_ADDRESS,
        c.mockRiskReserve.address,
        c.liquidityCertificate.address,
        c.liquidityMedal.address,
        c.policy.address,
        c.epochManage.address,
        c.metaDefenderGlobals.address,
    );

    await c.liquidityCertificate.init(
        c.metaDefender.address,
        overrides.protocol || ZERO_ADDRESS,
    );

    await c.liquidityMedal.init(
        c.metaDefender.address,
        overrides.protocol || ZERO_ADDRESS,
    );

    await c.policy.init(
        c.metaDefender.address,
        overrides.protocol || ZERO_ADDRESS,
        c.epochManage.address,
    );

    await c.mockRiskReserve.init(
        c.metaDefender.address,
        c.test.quoteToken.address,
    );

    await c.epochManage.init(
        c.metaDefender.address,
        c.liquidityCertificate.address,
        c.metaDefenderGlobals.address,
    );

    await c.metaDefenderGlobals.init(
        overrides.official || ZERO_ADDRESS,
        overrides.currentFee || toBN('0.02'),
        overrides.minimumFee || toBN('0.02'),
        c.epochManage.address,
        toBN('1'),
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
        riskReserve: c.mockRiskReserve.address,
    });
    return c;
}
