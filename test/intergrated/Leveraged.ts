import { Signer } from 'ethers';
import { ethers } from 'hardhat';
import {
    MOCK_MINING_ADDRESS,
    MOCK_PROXY_ADDRESS,
    toBN,
    ZERO_ADDRESS,
} from '../../scripts/util/web3utils';
import {
    fastForward,
    fastForwardToNextExitDay,
    fastForwardToNextNotExitDay,
    restoreSnapshot,
    takeSnapshot,
} from '../utils';
import {
    deployTestSystem,
    TestSystemContractsType,
} from '../utils/deployTestSystem';
import { expect } from 'chai';
import { seedTestSystem } from '../utils/seedTestSystem';
import { americanBinaryOptions } from '../utils/americanBinaryOptions';

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

    describe('leveraged', async () => {
        it('should withdraw zero when leveraged', async () => {
            // ----P1=1000----0:00----B1=10*90----0:00----P2=9000----0:00----B2=100*90=9000----0:00----queryWithdrawP1
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
            for (let i = 0; i < 90; i++) {
                console.log(i);
                await contracts.metaDefender
                    .connect(coverBuyer1)
                    .buyPolicy(
                        await coverBuyer1.getAddress(),
                        toBN('10'),
                        '100',
                    );
            }
            await fastForward(86400);
            await contracts.metaDefender.epochCheck();
            await contracts.metaDefender
                .connect(provider2)
                .certificateProviderEntrance(toBN('9000'));
            await fastForward(86400);
            for (let i = 0; i < 90; i++) {
                console.log(i);
                await contracts.metaDefender
                    .connect(coverBuyer2)
                    .buyPolicy(
                        await coverBuyer2.getAddress(),
                        toBN('100'),
                        '100',
                    );
            }
            await fastForward(86400);
            await contracts.metaDefender.epochCheck();
            const withdrawal = await contracts.metaDefender
                .connect(provider1)
                .getSPSLockedByCertificateId('0');
            console.log(withdrawal);
        });
    });
});
