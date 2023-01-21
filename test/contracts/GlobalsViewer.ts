import { Signer } from 'ethers';
import {
    deployTestSystem,
    TestSystemContractsType,
} from '../utils/deployTestSystem';
import { ethers } from 'hardhat';
import { fastForward, restoreSnapshot, takeSnapshot } from '../utils';
import { expect } from 'chai';
import { toBN } from '../../scripts/util/web3utils';
import { seedTestSystem } from '../utils/seedTestSystem';

describe('GlobalViewers - uint tests', async () => {
    let deployer: Signer;
    let provider1: Signer;
    let coverBuyer1: Signer;
    let contracts: TestSystemContractsType;
    let snapshotId: number;

    before(async function () {
        [deployer, provider1, coverBuyer1] = await ethers.getSigners();
        contracts = await deployTestSystem(deployer);
        snapshotId = await takeSnapshot();
    });

    beforeEach(async function () {
        await restoreSnapshot(snapshotId);
        snapshotId = await takeSnapshot();
    });

    describe('init', async () => {
        it('should not allow init twice', async () => {
            await expect(
                contracts.periphery.globalsViewer.init(
                    contracts.periphery.metaDefenderMarketsRegistry.address,
                    contracts.americanBinaryOptions.address,
                ),
            ).to.be.revertedWith('Contract already initialized');
        });
    });

    describe('getPremium', async () => {
        it('get the premium correctly', async () => {
            const res = await contracts.periphery.globalsViewer.getPremium(
                toBN('10000'),
                '180',
                contracts.metaDefender.address,
            );
            expect(res[0]).to.be.equal('698771327552756951');
            expect(res[1]).to.be.equal(toBN('10'));
            expect(res[2]).to.be.equal(toBN('1.1'));
        });
    });

    describe('getGlobals', async () => {
        it('get all the globals correctly', async () => {
            await seedTestSystem(deployer, contracts, 20000, [
                provider1,
                coverBuyer1,
            ]);
            await contracts.metaDefender
                .connect(provider1)
                .certificateProviderEntrance(toBN('10000'));
            const resBefore =
                await contracts.periphery.globalsViewer.getGlobals();
            expect(resBefore[0][0]).to.be.equal(toBN('0'));
            expect(resBefore[0][1]).to.be.equal(toBN('10000'));
            expect(resBefore[0][2]).to.be.equal(toBN('0'));
            expect(resBefore[0][3]).to.be.equal(toBN('0'));
            await fastForward(86400);
            await contracts.metaDefender.epochCheck();
            await contracts.metaDefender
                .connect(coverBuyer1)
                .buyPolicy(await coverBuyer1.getAddress(), toBN('1000'), '365');
            const resAfter =
                await contracts.periphery.globalsViewer.getGlobals();
            expect(resAfter[0][0]).to.be.equal(toBN('10000'));
            expect(resAfter[0][1]).to.be.equal(toBN('10000'));
            expect(resAfter[0][2]).to.be.equal(toBN('1000'));
            expect(resAfter[0][3]).to.be.equal(toBN('1000'));
        });
    });
});
