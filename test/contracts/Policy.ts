import { Signer } from 'ethers';
import {
    deployTestSystem,
    TestSystemContractsType,
} from '../utils/deployTestSystem';
import { ethers } from 'hardhat';
import { fastForward, restoreSnapshot, takeSnapshot } from '../utils';
import { expect } from 'chai';
import { toBN, ZERO_ADDRESS } from '../../scripts/util/web3utils';
import { seedTestSystem } from '../utils/seedTestSystem';

describe('Policy - uint tests', async () => {
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

    describe('init', async () => {
        it('should not allow init twice', async () => {
            await expect(
                contracts.policy.init(
                    contracts.metaDefender.address,
                    ZERO_ADDRESS,
                    contracts.epochManage.address,
                    'Policy',
                    'POL',
                ),
            ).to.be.revertedWith(
                'Initializable: contract is already initialized',
            );
        });
    });

    describe('getPolicyBuyers', async () => {
        it('should return the correct number of policy buyers', async () => {
            await seedTestSystem(deployer, contracts, 100000, [
                provider1,
                coverBuyer1,
                coverBuyer2,
            ]);
            await contracts.metaDefender
                .connect(provider1)
                .certificateProviderEntrance(toBN('10100'));
            await fastForward(86400);
            await contracts.metaDefender
                .connect(coverBuyer1)
                .buyPolicy(await coverBuyer1.getAddress(), toBN('1000'), '100');
            await contracts.metaDefender
                .connect(coverBuyer2)
                .buyPolicy(await coverBuyer2.getAddress(), toBN('1000'), '100');
            await contracts.metaDefender
                .connect(coverBuyer1)
                .buyPolicy(await coverBuyer1.getAddress(), toBN('1000'), '100');
            const Ids = await contracts.policy.getPolicies(
                await coverBuyer1.getAddress(),
            );
            expect(Ids[0]).to.be.equal(0);
            expect(Ids[1]).to.be.equal(2);
        });

        describe('getPolicyInfo', async () => {
            it('should return the correct policy info', async () => {
                await seedTestSystem(deployer, contracts, 100000, [
                    provider1,
                    coverBuyer1,
                    coverBuyer2,
                ]);
                await contracts.metaDefender
                    .connect(provider1)
                    .certificateProviderEntrance(toBN('10100'));
                await fastForward(86400);
                await contracts.metaDefender
                    .connect(coverBuyer1)
                    .buyPolicy(
                        await coverBuyer1.getAddress(),
                        toBN('1000'),
                        '100',
                    );
                const Ids = await contracts.policy.getPolicies(
                    await coverBuyer1.getAddress(),
                );
                const policyInfo = await contracts.policy.getPolicyInfo(Ids[0]);
                expect(policyInfo[0]).to.be.equal(
                    await coverBuyer1.getAddress(),
                );
                expect(policyInfo[1]).to.be.equal(toBN('1000'));
                expect(policyInfo[2]).to.be.equal(toBN('10'));
            });
        });

        describe('mint', async () => {
            it('will revert if the msg.sender is not the metadefender address', async () => {
                await expect(
                    contracts.policy
                        .connect(user)
                        .mint(
                            await coverBuyer1.getAddress(),
                            toBN('1000'),
                            '10',
                            '1',
                            '100',
                            toBN('100'),
                            toBN('1000'),
                            String(Math.floor(Date.now() / 1000)),
                        ),
                ).to.be.revertedWith('Only MetaDefender');
            });
        });
    });
});
