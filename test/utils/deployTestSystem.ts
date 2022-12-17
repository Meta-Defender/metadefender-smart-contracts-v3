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
    GlobalsViewer,
    MetaDefenderMarketsRegistry,
} from '../../typechain-types';
import { TestERC20 } from '../../typechain-types';

export type TestSystemContractsType = {
    metaDefender: MetaDefender;
    liquidityCertificate: LiquidityCertificate;
    policy: Policy;
    epochManage: EpochManage;
    mockRiskReserve: MockRiskReserve;
    americanBinaryOptions: AmericanBinaryOptions;
    periphery: {
        globalsViewer: GlobalsViewer;
        metaDefenderMarketsRegistry: MetaDefenderMarketsRegistry;
    };
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

    const americanBinaryOptions = (await (
        await ethers.getContractFactory('AmericanBinaryOptions')
    )
        .connect(deployer)
        .deploy()) as AmericanBinaryOptions;

    const globalsViewer = (await (
        await ethers.getContractFactory('GlobalsViewer')
    )
        .connect(deployer)
        .deploy()) as GlobalsViewer;

    const metaDefenderMarketsRegistry = (await (
        await ethers.getContractFactory('MetaDefenderMarketsRegistry')
    )
        .connect(deployer)
        .deploy()) as MetaDefenderMarketsRegistry;

    return {
        metaDefender,
        liquidityCertificate,
        policy,
        epochManage,
        mockRiskReserve,
        americanBinaryOptions,
        periphery: {
            globalsViewer,
            metaDefenderMarketsRegistry,
        },
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
        c.americanBinaryOptions.address,
        c.epochManage.address,
        toBN('0.10'),
        toBN('0'),
        toBN('100'),
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
        c.policy.address,
    );

    // init periphery
    await c.periphery.globalsViewer.init(
        c.metaDefender.address,
        c.americanBinaryOptions.address,
        c.liquidityCertificate.address,
        c.policy.address,
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
