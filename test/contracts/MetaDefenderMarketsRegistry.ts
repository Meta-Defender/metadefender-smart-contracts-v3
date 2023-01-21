import { Signer } from 'ethers';
import { ethers } from 'hardhat';
import { restoreSnapshot, takeSnapshot } from '../utils';
import {
    deployTestSystem,
    TestSystemContractsType,
} from '../utils/deployTestSystem';
import { expect } from 'chai';
import { ZERO_ADDRESS } from '../../scripts/util/web3utils';

describe('MetaDefenderMarketsRegistry - uint tests', () => {
    let deployer: Signer;
    let user: Signer;
    let contracts1: TestSystemContractsType;
    let contracts2: TestSystemContractsType;
    let contracts3: TestSystemContractsType;
    let snapshotId: number;

    before(async function () {
        [deployer, user] = await ethers.getSigners();
        contracts1 = await deployTestSystem(deployer);
        snapshotId = await takeSnapshot();
    });

    beforeEach(async function () {
        await restoreSnapshot(snapshotId);
        snapshotId = await takeSnapshot();
    });

    describe('market creation', async () => {
        it('should not allow to create the market if not owner', async () => {
            contracts2 = await deployTestSystem(deployer);
            await expect(
                contracts1.periphery.metaDefenderMarketsRegistry
                    .connect(user)
                    .addMarket(
                        contracts2.metaDefender.address,
                        contracts2.liquidityCertificate.address,
                        contracts2.policy.address,
                        contracts2.epochManage.address,
                        'compoundV3',
                        'a lending protocol',
                        'USDT',
                        'contract safety',
                        'Ethereum',
                    ),
            ).to.be.revertedWith('Ownable: caller is not the owner');
        });
        it('should revert if the market already exits', async () => {
            await expect(
                contracts1.periphery.metaDefenderMarketsRegistry.addMarket(
                    contracts1.metaDefender.address,
                    contracts1.liquidityCertificate.address,
                    contracts1.policy.address,
                    contracts1.epochManage.address,
                    'compoundV3',
                    'a lending protocol',
                    'USDT',
                    'contract safety',
                    'Ethereum',
                ),
            ).to.be.revertedWith('market already present');
        });
        it('should successfully create markets and query correctly', async () => {
            contracts2 = await deployTestSystem(deployer);
            await contracts1.periphery.metaDefenderMarketsRegistry.addMarket(
                contracts2.metaDefender.address,
                contracts2.liquidityCertificate.address,
                contracts2.policy.address,
                contracts2.epochManage.address,
                'compoundV3',
                'a lending protocol',
                'USDT',
                'contract safety',
                'Ethereum',
            );
            contracts3 = await deployTestSystem(deployer);
            await contracts1.periphery.metaDefenderMarketsRegistry.addMarket(
                contracts3.metaDefender.address,
                contracts3.liquidityCertificate.address,
                contracts3.policy.address,
                contracts3.epochManage.address,
                'aave',
                'a lending protocol',
                'USDT',
                'contract safety',
                'Ethereum',
            );
            const insuranceMarkets =
                await contracts1.periphery.metaDefenderMarketsRegistry.getInsuranceMarkets();
            const insuranceMarketAddressesAndMessages =
                await contracts1.periphery.metaDefenderMarketsRegistry.getInsuranceMarketsAddressesAndMessages(
                    [insuranceMarkets[0][1], insuranceMarkets[0][2]],
                );
            expect(insuranceMarkets[0].length).to.be.equal(3);
            expect(insuranceMarkets[0][1]).to.be.equal(
                contracts2.metaDefender.address,
            );
            expect(insuranceMarkets[0][2]).to.be.equal(
                contracts3.metaDefender.address,
            );
            expect(insuranceMarketAddressesAndMessages[0][0][0]).to.be.equal(
                contracts2.liquidityCertificate.address,
            );
            expect(insuranceMarketAddressesAndMessages[0][0][1]).to.be.equal(
                contracts2.policy.address,
            );
            expect(insuranceMarketAddressesAndMessages[0][0][2]).to.be.equal(
                contracts2.epochManage.address,
            );
            expect(insuranceMarketAddressesAndMessages[0][1][0]).to.be.equal(
                contracts3.liquidityCertificate.address,
            );
            expect(insuranceMarketAddressesAndMessages[0][1][1]).to.be.equal(
                contracts3.policy.address,
            );
            expect(insuranceMarketAddressesAndMessages[0][1][2]).to.be.equal(
                contracts3.epochManage.address,
            );
        });
    });

    describe('remove market', async () => {
        it('should revert if the market is not exist', async () => {
            await expect(
                contracts1.periphery.metaDefenderMarketsRegistry.removeMarket(
                    ZERO_ADDRESS,
                ),
            ).to.be.revertedWith('market not present');
        });
        it('should revert if the market is not removed by owner', async () => {
            await expect(
                contracts1.periphery.metaDefenderMarketsRegistry
                    .connect(user)
                    .removeMarket(contracts1.metaDefender.address),
            ).to.be.revertedWith('Ownable: caller is not the owner');
        });
        it('should successfully remove market', async () => {
            await contracts1.periphery.metaDefenderMarketsRegistry.removeMarket(
                contracts1.metaDefender.address,
            );
            const insuranceMarkets =
                await contracts1.periphery.metaDefenderMarketsRegistry.getInsuranceMarkets();
            expect(insuranceMarkets[0].length).to.be.equal(0);
        });
    });
});
