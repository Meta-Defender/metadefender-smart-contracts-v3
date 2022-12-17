import { Signer } from 'ethers';
import { ethers } from 'hardhat';
import { restoreSnapshot, takeSnapshot } from '../utils';
import {
    deployTestSystem,
    TestSystemContractsType,
} from '../utils/deployTestSystem';
import { expect } from 'chai';

describe('MetaDefenderMarketsRegistry - uint tests', () => {
    let deployer: Signer;
    let contracts1: TestSystemContractsType;
    let contracts2: TestSystemContractsType;
    let snapshotId: number;

    before(async function () {
        [deployer] = await ethers.getSigners();
        contracts1 = await deployTestSystem(deployer);
        snapshotId = await takeSnapshot();
    });

    beforeEach(async function () {
        await restoreSnapshot(snapshotId);
        snapshotId = await takeSnapshot();
    });

    describe('market creation', async () => {
        it('should successfully create markets and query correctly', async () => {
            await contracts1.periphery.metaDefenderMarketsRegistry.addMarket(
                contracts1.metaDefender.address,
                contracts1.liquidityCertificate.address,
                contracts1.policy.address,
                contracts1.epochManage.address,
            );
            contracts2 = await deployTestSystem(deployer);
            await contracts1.periphery.metaDefenderMarketsRegistry.addMarket(
                contracts2.metaDefender.address,
                contracts2.liquidityCertificate.address,
                contracts2.policy.address,
                contracts2.epochManage.address,
            );
            const insuranceMarkets =
                await contracts1.periphery.metaDefenderMarketsRegistry.getInsuranceMarkets();
            const insuranceMarketAddresses =
                await contracts1.periphery.metaDefenderMarketsRegistry.getInsuranceMarketsAddresses(
                    [insuranceMarkets[0], insuranceMarkets[1]],
                );
            expect(insuranceMarkets.length).to.be.equal(2);
            expect(insuranceMarkets[0]).to.be.equal(
                contracts1.metaDefender.address,
            );
            expect(insuranceMarkets[1]).to.be.equal(
                contracts2.metaDefender.address,
            );
            expect(insuranceMarketAddresses[0][0]).to.be.equal(
                contracts1.liquidityCertificate.address,
            );
            expect(insuranceMarketAddresses[0][1]).to.be.equal(
                contracts1.policy.address,
            );
            expect(insuranceMarketAddresses[0][2]).to.be.equal(
                contracts1.epochManage.address,
            );
            expect(insuranceMarketAddresses[1][0]).to.be.equal(
                contracts2.liquidityCertificate.address,
            );
            expect(insuranceMarketAddresses[1][1]).to.be.equal(
                contracts2.policy.address,
            );
            expect(insuranceMarketAddresses[1][2]).to.be.equal(
                contracts2.epochManage.address,
            );
        });
    });

    describe('remove market', async () => {
        it('should revert if the certain market is not exist', async () => {
            await contracts1.periphery.metaDefenderMarketsRegistry.addMarket(
                contracts1.metaDefender.address,
                contracts1.liquidityCertificate.address,
                contracts1.policy.address,
                contracts1.epochManage.address,
            );
            await expect(
                contracts1.periphery.metaDefenderMarketsRegistry.removeMarket(
                    contracts1.policy.address,
                ),
            ).to.be.revertedWith('market not present');
        });
        it('should successfully remove market', async () => {
            await contracts1.periphery.metaDefenderMarketsRegistry.addMarket(
                contracts1.metaDefender.address,
                contracts1.liquidityCertificate.address,
                contracts1.policy.address,
                contracts1.epochManage.address,
            );
            await contracts1.periphery.metaDefenderMarketsRegistry.removeMarket(
                contracts1.metaDefender.address,
            );
            const insuranceMarkets =
                await contracts1.periphery.metaDefenderMarketsRegistry.getInsuranceMarkets();
            expect(insuranceMarkets.length).to.be.equal(0);
        });
    });
});
