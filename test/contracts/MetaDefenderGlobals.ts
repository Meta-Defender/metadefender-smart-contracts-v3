import { Signer } from 'ethers';
import { ethers } from 'hardhat';
import { toBN, ZERO_ADDRESS } from '../../scripts/util/web3utils';
import { restoreSnapshot, takeSnapshot } from '../utils';
import {
    deployTestSystem,
    TestSystemContractsType,
} from '../utils/deployTestSystem';
import { expect } from 'chai';

describe('MetaDefenderGlobals - uint tests', async function () {
    let deployer: Signer;
    let user: Signer;
    let contracts: TestSystemContractsType;
    let snapshotId: number;

    before(async function () {
        [deployer, user] = await ethers.getSigners();
        contracts = await deployTestSystem(deployer);
        snapshotId = await takeSnapshot();
    });

    beforeEach(async function () {
        await restoreSnapshot(snapshotId);
        snapshotId = await takeSnapshot();
    });

    describe('setInitialFee', async function () {
        it('reverts if not called by owner', async function () {
            await expect(
                contracts.metaDefenderGlobals
                    .connect(user)
                    .setInitialFee(ZERO_ADDRESS, toBN('0.02')),
            ).to.be.revertedWith('Ownable: caller is not the owner');
        });

        it('should set initial fee', async function () {
            await contracts.metaDefenderGlobals.setInitialFee(
                ZERO_ADDRESS,
                // the initial fee is 2%
                toBN('0.03'),
            );
            expect(
                await contracts.metaDefenderGlobals.initialFee(ZERO_ADDRESS),
            ).to.be.equal(toBN('0.03'));
        });
    });

    describe('setMinimumFee', async function () {
        it('reverts if not called by owner', async function () {
            await expect(
                contracts.metaDefenderGlobals
                    .connect(user)
                    .setMinimumFee(ZERO_ADDRESS, toBN('0.02')),
            ).to.be.revertedWith('Ownable: caller is not the owner');
        });

        it('should set minimum fee', async function () {
            await contracts.metaDefenderGlobals.setMinimumFee(
                ZERO_ADDRESS,
                // the minimum fee is 2%
                toBN('0.03'),
            );
            expect(
                await contracts.metaDefenderGlobals.minimumFee(ZERO_ADDRESS),
            ).to.be.equal(toBN('0.03'));
        });
    });
});
