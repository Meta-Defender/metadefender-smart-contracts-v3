import { Signer } from 'ethers';
import { ethers } from 'hardhat';
import { toBN } from '../../scripts/util/web3utils';
import { fastForward, restoreSnapshot, takeSnapshot } from '../utils';
import {
    deployTestSystem,
    TestSystemContractsType,
} from '../utils/deployTestSystem';
import { seedTestSystem } from '../utils/seedTestSystem';
import { expect } from 'chai';

describe('MetaDefender - integrated tests', async () => {
    let deployer: Signer;
    let user: Signer;
    let provider1: Signer;
    let provider2: Signer;
    let coverBuyer1: Signer;
    let coverBuyer2: Signer;
    let contracts: TestSystemContractsType;
    let snapshotId: number;

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

    describe('claim situation', async () => {
        it('the one before the policyBuying will suffer the loss while the one after the policyBuying will not', async () => {
            // ----P1----0:00----B1----0:00----P2-----0:00-----claimForB1----approve----0:00----queryWithdrawP1,P2
            //epoch 1            2             3                  4                             5
            await seedTestSystem(deployer, contracts, 100000, [
                provider1,
                provider2,
                coverBuyer1,
                coverBuyer2,
            ]);
            await contracts.metaDefender
                .connect(provider1)
                .certificateProviderEntrance(toBN('1000'));
            await fastForward(86400);
            await contracts.metaDefender.epochCheck();
            await contracts.metaDefender
                .connect(coverBuyer1)
                .buyPolicy(await coverBuyer1.getAddress(), toBN('100'), '100');
            await fastForward(86400);
            await contracts.metaDefender.epochCheck();
            await contracts.metaDefender
                .connect(provider2)
                .certificateProviderEntrance(toBN('10000'));
            await fastForward(86400);
            await contracts.metaDefender.epochCheck();
            await contracts.metaDefender
                .connect(coverBuyer1)
                .policyClaimApply('0');
            await contracts.metaDefender.connect(deployer).approveApply('0');
            await fastForward(86400);
            await contracts.metaDefender.epochCheck();
            const withdrawP1 =
                await contracts.metaDefender.getSPSLockedByCertificateId('0');
            const withdrawP2 =
                await contracts.metaDefender.getSPSLockedByCertificateId('1');
            expect(withdrawP1[0]).to.be.equal(toBN('0.1'));
            expect(withdrawP2[0]).to.be.equal(toBN('0'));
        });
    });
});
