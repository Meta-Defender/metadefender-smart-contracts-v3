import { Signer } from 'ethers';
import hre, { ethers } from 'hardhat';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { upgrades } = require('hardhat');
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
    const _metaDefender = await ethers.getContractFactory('MetaDefender');
    const metaDefender = (await upgrades.deployProxy(
        _metaDefender,
        [],
    )) as MetaDefender;

    const _liquidityCertificate = await ethers.getContractFactory(
        'LiquidityCertificate',
    );
    const liquidityCertificate = (await upgrades.deployProxy(
        _liquidityCertificate,
        [],
    )) as LiquidityCertificate;

    const _policy = await ethers.getContractFactory('Policy');
    const policy = (await upgrades.deployProxy(_policy, [])) as Policy;

    const _mockRiskReserve = await ethers.getContractFactory('MockRiskReserve');
    const mockRiskReserve = (await upgrades.deployProxy(
        _mockRiskReserve,
        [],
    )) as MockRiskReserve;

    const quoteToken = (await (await ethers.getContractFactory('TestERC20'))
        .connect(deployer)
        .deploy('TQA', 'TQA')) as TestERC20;

    const _epochManage = await ethers.getContractFactory('EpochManage');
    const epochManage = (await upgrades.deployProxy(
        _epochManage,
        [],
    )) as EpochManage;

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
        'LiquidityCertificate',
        'LC',
    );

    await c.policy.init(
        c.metaDefender.address,
        overrides.protocol || ZERO_ADDRESS,
        c.epochManage.address,
        'Policy',
        'POL',
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
        c.periphery.metaDefenderMarketsRegistry.address,
        c.americanBinaryOptions.address,
    );

    // market registry
    await c.periphery.metaDefenderMarketsRegistry.addMarket(
        c.metaDefender.address,
        c.liquidityCertificate.address,
        c.policy.address,
        c.epochManage.address,
        'compoundV3',
        'a lending protocol',
        'USDT',
        'contract safety',
        'Ethereum',
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
