import * as fs from 'fs-extra';
import { AcalaTxParams, toBN, txParams, ZERO_ADDRESS } from './util/web3utils';
import { Contract, Signer } from 'ethers';
import { providerOverrides } from './util/overrideProvider';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const hre = require('hardhat');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { upgrades } = require('hardhat');

export type DeployedContracts = {
    network: string;
    globalsViewer: string;
    metaDefenderMarketsRegistry: string;
    testERC20: string;
    americanBinaryOptions: string;
    markets: Market[];
};

export type Market = {
    marketName: string;
    marketDescription: string;
    marketPaymentToken: string;
    marketProtectionType: string;
    network: string;
    metaDefender: string;
    liquidityCertificate: string;
    policy: string;
    mockRiskReserve: string;
    epochManage: string;
};
async function main(
    marketName: string,
    marketDescription: string,
    marketPaymentToken: string,
    marketProtectionType: string,
    network: string,
) {
    let res: DeployedContracts;
    let signers: Signer[] = [];
    if (
        fs.existsSync(
            './deployments/.env.' + String(hre.network.name) + '.json',
        )
    ) {
        res = JSON.parse(
            fs.readFileSync(
                './deployments/.env.' + String(hre.network.name) + '.json',
                'utf8',
            ),
        );
    } else {
        const markets: Market[] = [];
        res = {} as DeployedContracts;
        res.markets = markets;
    }
    if (
        String(hre.network.name) != 'mandala' &&
        String(hre.network.name) != 'mandala_localhost'
    ) {
        console.log('detected network' + hre.network.name);
        signers = await hre.ethers.getSigners();
    } else {
        const res = await providerOverrides(String(hre.network.name));
        if (hre.network.name == 'mandala_localhost') {
            console.log('detected network mandala localhost');
            signers.push(res.signers[0]);
        } else {
            console.log('detected network mandala');
            signers.push(res.signers[1]);
        }
    }
    // in acala testnet, we should get the txparams first
    // deploy
    // now set to proxy contracts are:
    // MetaDefender, LiquidityCertificate, Policy, MockRiskReserve, EpochManage
    const _MetaDefender = await hre.ethers.getContractFactory(
        'MetaDefender',
        signers[0],
    );
    const MetaDefender = await upgrades.deployProxy(_MetaDefender, [], {
        useDeployedImplementation: false,
    });
    console.log(
        'successfully deployed MetaDefender: ' +
            MetaDefender.address +
            ' ' +
            MetaDefender.deployTransaction.hash,
    );
    const _LiquidityCertificate = await hre.ethers.getContractFactory(
        'LiquidityCertificate',
        signers[0],
    );
    const LiquidityCertificate = await upgrades.deployProxy(
        _LiquidityCertificate,
        [],
        {
            useDeployedImplementation: false,
        },
    );
    console.log(
        'successfully deployed LiquidityCertificate: ' +
            LiquidityCertificate.address +
            ' ' +
            LiquidityCertificate.deployTransaction.hash,
    );
    const _Policy = await hre.ethers.getContractFactory('Policy', signers[0]);
    const Policy = await upgrades.deployProxy(_Policy, [], {
        useDeployedImplementation: false,
    });
    console.log(
        'successfully deployed Policy: ' +
            Policy.address +
            ' ' +
            Policy.deployTransaction.hash,
    );
    const _MockRiskReserve = await hre.ethers.getContractFactory(
        'MockRiskReserve',
        signers[0],
    );
    const MockRiskReserve = await upgrades.deployProxy(_MockRiskReserve, [], {
        useDeployedImplementation: false,
    });
    console.log(
        'successfully deployed MockRiskReserve: ' +
            MockRiskReserve.address +
            ' ' +
            MockRiskReserve.deployTransaction.hash,
    );
    const _EpochManage = await hre.ethers.getContractFactory(
        'EpochManage',
        signers[0],
    );
    const EpochManage = await upgrades.deployProxy(_EpochManage, [], {
        useDeployedImplementation: false,
    });
    console.log(
        'successfully deployed EpochManage: ' +
            EpochManage.address +
            ' ' +
            EpochManage.deployTransaction.hash,
    );
    const _AmericanBinaryOptions = await hre.ethers.getContractFactory(
        'AmericanBinaryOptions',
        signers[0],
    );
    const _TestERC20 = await hre.ethers.getContractFactory(
        'TestERC20',
        signers[0],
    );
    // periphery contracts
    const _GlobalsViewer = await hre.ethers.getContractFactory(
        'GlobalsViewer',
        signers[0],
    );
    const _MetaDefenderMarketsRegistry = await hre.ethers.getContractFactory(
        'MetaDefenderMarketsRegistry',
        signers[0],
    );
    let MetaDefenderMarketsRegistry: Contract;
    let GlobalsViewer: Contract;
    let AmericanBinaryOptions: Contract;
    let TestERC20: Contract;

    let metaDefenderMarketsRegistryAddress: string;
    let globalsViewerAddress: string;
    let americanBinaryOptionsAddress: string;
    let testERC20Address: string;

    if (!res.metaDefenderMarketsRegistry) {
        MetaDefenderMarketsRegistry =
            await _MetaDefenderMarketsRegistry.deploy();
        console.log(
            'successfully deployed MetaDefenderMarketsRegistry: ' +
                MetaDefenderMarketsRegistry.address,
        );
        GlobalsViewer = await _GlobalsViewer.deploy();
        AmericanBinaryOptions = await _AmericanBinaryOptions.deploy();
        console.log(
            'successfully deployed AmericanBinaryOption: ' +
                AmericanBinaryOptions.address,
        );
        console.log(
            'successfully deployed GlobalsViewer: ' + GlobalsViewer.address,
        );
        await GlobalsViewer.init(
            MetaDefenderMarketsRegistry.address,
            AmericanBinaryOptions.address,
        );
        console.log('successfully init the GlobalsViewer contract');
        TestERC20 = await _TestERC20.deploy('TQA', 'TQA');
        console.log('successfully deployed TestERC20: ' + TestERC20.address);
        // mint 10M tokens for the owner
        await TestERC20.mint(
            await signers[0].getAddress(),
            '10000000000000000000000000',
        );
        metaDefenderMarketsRegistryAddress =
            MetaDefenderMarketsRegistry.address;
        globalsViewerAddress = GlobalsViewer.address;
        americanBinaryOptionsAddress = AmericanBinaryOptions.address;
        testERC20Address = TestERC20.address;
    } else {
        for (let i = 0; i < res.markets.length; i++) {
            if (res.markets[i].marketName === marketName) {
                console.log('market already exists');
                return;
            }
        }
        metaDefenderMarketsRegistryAddress = res.metaDefenderMarketsRegistry;
        globalsViewerAddress = res.globalsViewer;
        americanBinaryOptionsAddress = res.americanBinaryOptions;
        testERC20Address = res.testERC20;
        MetaDefenderMarketsRegistry = await _MetaDefenderMarketsRegistry.attach(
            metaDefenderMarketsRegistryAddress,
        );
        GlobalsViewer = await _GlobalsViewer.attach(globalsViewerAddress);
        AmericanBinaryOptions = await _AmericanBinaryOptions.attach(
            americanBinaryOptionsAddress,
        );
        TestERC20 = await _TestERC20.attach(testERC20Address);
    }
    res.markets.push({
        marketName: marketName,
        marketDescription: marketDescription,
        marketPaymentToken: marketPaymentToken,
        marketProtectionType: marketProtectionType,
        network: network,
        metaDefender: String(MetaDefender.address),
        liquidityCertificate: String(LiquidityCertificate.address),
        policy: String(Policy.address),
        mockRiskReserve: String(MockRiskReserve.address),
        epochManage: String(EpochManage.address),
    });
    res['network'] = hre.network.name;
    res['globalsViewer'] = globalsViewerAddress;
    res['metaDefenderMarketsRegistry'] = metaDefenderMarketsRegistryAddress;
    res['testERC20'] = testERC20Address;
    res['americanBinaryOptions'] = americanBinaryOptionsAddress;
    fs.writeFileSync(
        './deployments/.env.' + String(hre.network.name) + '.json',
        JSON.stringify(res, null, 2),
    );
    // begin init the contracts
    // init the metaDefender contract
    await MetaDefender.init(
        TestERC20.address,
        signers[0].getAddress(),
        signers[0].getAddress(),
        MockRiskReserve.address,
        LiquidityCertificate.address,
        Policy.address,
        AmericanBinaryOptions.address,
        EpochManage.address,
        toBN('0.10'),
        toBN('0.00'),
        toBN('5000'),
    );
    console.log('successfully init the MetaDefender contract');
    await LiquidityCertificate.init(
        MetaDefender.address,
        ZERO_ADDRESS,
        'LiquidityCertificate',
        'LC',
    );
    console.log('successfully init the LiquidityCertificate contract');
    await Policy.init(
        MetaDefender.address,
        ZERO_ADDRESS,
        EpochManage.address,
        'Policy',
        'POL',
    );
    console.log('successfully init the Policy contract');
    await MockRiskReserve.init(MetaDefender.address, TestERC20.address);
    console.log('successfully init the MockRiskReserve contract');
    await EpochManage.init(
        MetaDefender.address,
        LiquidityCertificate.address,
        Policy.address,
    );
    console.log('successfully init the EpochManage contract');

    console.log('registry in process...');
    await MetaDefenderMarketsRegistry.addMarket(
        MetaDefender.address,
        LiquidityCertificate.address,
        Policy.address,
        EpochManage.address,
        marketName,
        marketDescription,
        marketPaymentToken,
        marketProtectionType,
        network,
    );
    console.log('successfully registry the market');
}

main(
    'Test_StableCoin1_Pool',
    'Stable_Coin_Pool',
    'USDT',
    'DePeg Safety',
    'Arbitrum',
)
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
