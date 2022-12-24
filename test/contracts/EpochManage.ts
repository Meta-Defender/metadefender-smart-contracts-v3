import { Signer } from 'ethers';
import {
    deployTestSystem,
    TestSystemContractsType,
} from '../utils/deployTestSystem';
import { ethers } from 'hardhat';
import { restoreSnapshot, takeSnapshot } from '../utils';
import { expect } from 'chai';
import {
    MOCK_MINING_ADDRESS,
    toBN,
    ZERO_ADDRESS,
} from '../../scripts/util/web3utils';
import { seedTestSystem } from '../utils/seedTestSystem';
import { time } from '@nomicfoundation/hardhat-network-helpers';

describe('EpochManage - uint tests', async () => {
    let deployer: Signer;
    let user: Signer;
    let provider1: Signer;
    let provider2: Signer;
    let coverBuyer1: Signer;
    let coverBuyer2: Signer;
    let contracts: TestSystemContractsType;
    let snapshotId: number;
    const tAnnualised = 1;
    const strikePrice = 1500;
    const spotPrice = 1000;
    const freeRate = 0.06;
    const initialRisk = 0.1;
    const standardRisk = 100;

    before(async function () {
        [deployer, user, provider1, provider2, coverBuyer1, coverBuyer2] =
            await ethers.getSigners();
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

    describe('nextExitDay', async () => {
        it('should get the right nextExitDay', async () => {
            const nextExitDay = await contracts.epochManage.nextExitDay();
            const day = Math.floor(Date.now() / 86400000);
            if (day % 7 == 0) {
                expect(nextExitDay).to.equal(day * 86400);
            } else {
                expect(nextExitDay).to.equal((day + 7 - (day % 7)) * 86400);
            }
        });
    });
});
