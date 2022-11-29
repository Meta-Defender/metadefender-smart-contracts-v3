import { Signer } from 'ethers';
import { ethers } from 'hardhat';
import { toBN, ZERO_ADDRESS } from '../../scripts/util/web3utils';
import {
    MetaDefender,
    LiquidityCertificate,
    Policy,
    MockRiskReserve,
    EpochManage,
    AmericanBinaryOptions,
} from '../../typechain-types';
import { TestERC20 } from '../../typechain-types';

export type TestSystemContractsType = {
    metaDefender: MetaDefender;
    liquidityCertificate: LiquidityCertificate;
    policy: Policy;
    epochManage: EpochManage;
    mockRiskReserve: MockRiskReserve;
    americanBinaryOptions: AmericanBinaryOptions;
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

    const calculatePremium = (await (
        await ethers.getContractFactory('CalculatePremium')
    )
        .connect(deployer)
        .deploy()) as CalculatePremium;

    return {
        metaDefender,
        liquidityCertificate,
        policy,
        epochManage,
        mockRiskReserve,
        calculatePremium,
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
        c.policy.address,
        c.calculatePremium.address,
        c.epochManage.address,
    );

    await c.liquidityCertificate.init(
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
