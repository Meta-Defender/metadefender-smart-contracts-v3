import { Signer, BigNumber } from 'ethers';
import {
    deployTestSystem,
    TestSystemContractsType,
} from '../utils/deployTestSystem';
import { ethers } from 'hardhat';
import { restoreSnapshot, takeSnapshot } from '../utils';
import { expect } from 'chai';
import { seedTestSystem } from '../utils/seedTestSystem';
import { toBN } from '../../scripts/util/web3utils';

describe('EpochManage - uint tests', async () => {
    let deployer: Signer;
    let provider1: Signer;
    let contracts: TestSystemContractsType;
    let snapshotId: number;

    before(async function () {
        [deployer, provider1] = await ethers.getSigners();
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
                contracts.epochManage.init(
                    contracts.metaDefender.address,
                    contracts.liquidityCertificate.address,
                    contracts.policy.address,
                ),
            ).to.be.revertedWith('already initialized');
        });
    });

    describe('updateCrossShadow', async () => {
        it('should not allow updateCrossShadow by non-metadefender', async () => {
            await expect(
                contracts.epochManage
                    .connect(provider1)
                    .updateCrossShadow(toBN('1'), toBN('1'), true),
            ).to.be.revertedWith('Only MetaDefender');
        });
    });

    describe('checkAndCreateNewEpochAndUpdateLiquidity', async () => {
        it('should not allow checkAndCreateNewEpochAndUpdateLiquidity by non-metadefender', async () => {
            await expect(
                contracts.epochManage
                    .connect(provider1)
                    .checkAndCreateNewEpochAndUpdateLiquidity(),
            ).to.be.revertedWith('Only MetaDefender');
        });
    });

    describe('checkAndCreateNewEpochAndUpdateAccRPSAccSPS', async () => {
        it('should not allow checkAndCreateNewEpochAndUpdateAccRPSAccSPS by non-metadefender', async () => {
            await expect(
                contracts.epochManage
                    .connect(provider1)
                    .checkAndCreateNewEpochAndUpdateAccRPSAccSPS(),
            ).to.be.revertedWith('Only MetaDefender');
        });
    });

    describe('get timestamp from epoch', async () => {
        it('should return the correct timestamp', async () => {
            await seedTestSystem(deployer, contracts, 20000, [provider1]);
            await contracts.metaDefender
                .connect(provider1)
                .certificateProviderEntrance(toBN('11000'));
            const epochInfo = await contracts.epochManage.getEpochInfo(1);
            const ts = await contracts.epochManage.getTimestampFromEpoch(1);
            expect(Number(epochInfo['epochId']) * 86400).to.be.equal(
                Number(ts),
            );
        });
    });
});
