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
                contracts.liquidityCertificate.init(
                    MOCK_MINING_ADDRESS,
                    MOCK_MINING_ADDRESS,
                ),
            ).to.be.revertedWith('already initialized');
        });
        it('should revert if the metadefender address is ZERO_ADDRESS', async () => {
            await expect(
                contracts.liquidityCertificate.init(
                    ZERO_ADDRESS,
                    contracts.liquidityMedal.address,
                ),
            ).to.be.revertedWith('liquidityPool cannot be 0 address');
        });
    });

    describe('getLiquidityProviders', async () => {
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
            const Ids =
                await contracts.liquidityCertificate.getLiquidityProviders(
                    await provider1.getAddress(),
                );
            expect(Ids[0]).to.be.equal(0);
            expect(Ids[1]).to.be.equal(2);
        });
    });

    describe('getLiquidity', async () => {
        it('should get liquidity correctly', async () => {
            await seedTestSystem(deployer, contracts, 100000, [
                provider1,
                provider2,
            ]);
            await contracts.metaDefender
                .connect(provider1)
                .providerEntrance(await provider1.getAddress(), toBN('10000'));
            expect(
                await contracts.liquidityCertificate.getLiquidity(0),
            ).to.be.equal(toBN('10000'));
        });
    });

    describe('getEnteredAt', async () => {
        it('should get enteredAt correctly', async () => {
            await seedTestSystem(deployer, contracts, 10000, [
                provider1,
                provider2,
            ]);
            await contracts.metaDefender
                .connect(provider1)
                .providerEntrance(await provider1.getAddress(), toBN('10000'));
            expect(
                await contracts.liquidityCertificate.getEnteredAt(0),
            ).to.be.greaterThan(0);
        });
    });

    describe('mint', async () => {
        it('will revert if the msg.sender is not the metadefender protocol', async () => {
            await expect(
                contracts.liquidityCertificate
                    .connect(provider1)
                    .mint(
                        await provider1.getAddress(),
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
                contracts.liquidityCertificate
                    .connect(provider1)
                    .burn(await provider1.getAddress(), '1'),
            ).to.be.revertedWithCustomError(
                contracts.liquidityCertificate,
                'InsufficientPrivilege',
            );
        });
    });
    describe('addRewardDebt', async () => {
        it('will revert if the msg.sender is not the metadefender protocol', async () => {
            await expect(
                contracts.liquidityCertificate
                    .connect(provider1)
                    .addRewardDebt('1', toBN('10000')),
            ).to.be.revertedWithCustomError(
                contracts.liquidityCertificate,
                'InsufficientPrivilege',
            );
        });
    });
});
