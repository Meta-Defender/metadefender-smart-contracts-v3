import { Signer } from 'ethers';
import {
    deployTestSystem,
    TestSystemContractsType,
} from '../utils/deployTestSystem';
import { ethers } from 'hardhat';
import { restoreSnapshot, takeSnapshot } from '../utils';
import { expect } from 'chai';

describe('EpochManage - uint tests', async () => {
    let deployer: Signer;
    let contracts: TestSystemContractsType;
    let snapshotId: number;

    before(async function () {
        [deployer] = await ethers.getSigners();
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
});
