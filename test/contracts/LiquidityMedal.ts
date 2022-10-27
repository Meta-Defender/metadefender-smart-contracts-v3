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

describe('MetaDefender - uint tests', async () => {
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
                contracts.liquidityMedal.init(
                    MOCK_MINING_ADDRESS,
                    MOCK_MINING_ADDRESS,
                ),
            ).to.be.revertedWith('already initialized');
        });
        it('should revert if the metadefender address is ZERO_ADDRESS', async () => {
            await expect(
                contracts.liquidityMedal.init(
                    ZERO_ADDRESS,
                    contracts.liquidityMedal.address,
                ),
            ).to.be.revertedWith('liquidityPool cannot be 0 address');
        });
    });

    describe('getMedalProviders', async () => {
        it('should return the correct number of liquidity providers', async () => {
            await seedTestSystem(deployer, contracts, 100000, [
                provider1,
                provider2,
            ]);
            await contracts.metaDefender
                .connect(provider1)
                .providerEntrance(await provider1.getAddress(), toBN('10000'));
            await contracts.metaDefender
                .connect(provider2)
                .providerEntrance(await provider2.getAddress(), toBN('10000'));
            await contracts.metaDefender
                .connect(provider1)
                .providerEntrance(await provider1.getAddress(), toBN('10000'));
            await contracts.metaDefender
                .connect(provider2)
                .providerEntrance(await provider2.getAddress(), toBN('10000'));

            await contracts.metaDefender
                .connect(provider1)
                .certificateProviderExit('0');
            await contracts.metaDefender
                .connect(provider1)
                .certificateProviderExit('2');
            await contracts.metaDefender
                .connect(provider2)
                .certificateProviderExit('1');
            const Ids = await contracts.liquidityMedal.getMedalProviders(
                await provider1.getAddress(),
            );
            // the certificateId and medalId will be the same with the same liquidity.
            expect(Ids[0]).to.be.equal(0);
            expect(Ids[1]).to.be.equal(2);
        });
    });

    describe('getReserve', async () => {
        it('should get reserve correctly', async () => {
            await seedTestSystem(deployer, contracts, 100000, [
                provider1,
                provider2,
            ]);
            await contracts.metaDefender
                .connect(provider1)
                .providerEntrance(await provider1.getAddress(), toBN('10000'));
            await contracts.metaDefender
                .connect(provider2)
                .providerEntrance(await provider2.getAddress(), toBN('10000'));
            await contracts.metaDefender
                .connect(provider1)
                .certificateProviderExit('0');
            // reserve is 10000 * 1 - 10000 = 0
            expect(await contracts.liquidityMedal.getReserve(0)).to.be.equal(
                toBN('0'),
            );
        });
    });

    describe('getEnteredAt & ExitedAt', async () => {
        it('should get enteredAt & ExitedAt correctly', async () => {
            await seedTestSystem(deployer, contracts, 10000, [
                provider1,
                provider2,
            ]);
            await contracts.metaDefender
                .connect(provider1)
                .providerEntrance(await provider1.getAddress(), toBN('10000'));
            await contracts.metaDefender
                .connect(provider2)
                .providerEntrance(await provider2.getAddress(), toBN('10000'));
            await contracts.metaDefender
                .connect(provider1)
                .certificateProviderExit('0');
            expect(
                await contracts.liquidityMedal.getEnteredAt(0),
            ).to.be.greaterThan(0);
            expect(
                await contracts.liquidityMedal.getExitedAt(0),
            ).to.be.greaterThan(0);
        });
    });

    describe('getMedalInfo', async () => {
        it('should revert if the medal invalid', async () => {
            await seedTestSystem(deployer, contracts, 10000, [
                provider1,
                provider2,
            ]);
            await contracts.metaDefender
                .connect(provider1)
                .providerEntrance(await provider1.getAddress(), toBN('10000'));
            await contracts.metaDefender
                .connect(provider2)
                .providerEntrance(await provider2.getAddress(), toBN('10000'));
            await contracts.metaDefender
                .connect(provider1)
                .certificateProviderExit('0');
            await expect(
                contracts.liquidityMedal.getMedalInfo(1),
            ).to.be.revertedWith('medal does not exist');
        });
    });

    describe('mint', async () => {
        it('will revert if the msg.sender is not the metadefender protocol', async () => {
            await expect(
                contracts.liquidityMedal
                    .connect(provider1)
                    .mint(
                        await provider1.getAddress(),
                        toBN('10000'),
                        toBN('10000'),
                        toBN('10000'),
                        toBN('10000'),
                        toBN('10000'),
                        toBN('10000'),
                    ),
            ).to.be.revertedWithCustomError(
                contracts.liquidityCertificate,
                'InsufficientPrivilege',
            );
        });
    });
    describe('burn', async () => {
        it('will burn if the msg.sender is not the metadefender protocol', async () => {
            await expect(
                contracts.liquidityMedal
                    .connect(provider1)
                    .burn(await provider1.getAddress(), '1'),
            ).to.be.revertedWithCustomError(
                contracts.liquidityCertificate,
                'InsufficientPrivilege',
            );
        });
    });
    describe('updateReserve', async () => {
        it('will revert if the msg.sender is not the metadefender protocol', async () => {
            await expect(
                contracts.liquidityMedal
                    .connect(provider1)
                    .updateReserve('1', toBN('10000')),
            ).to.be.revertedWithCustomError(
                contracts.liquidityMedal,
                'InsufficientPrivilege',
            );
        });
    });
});
