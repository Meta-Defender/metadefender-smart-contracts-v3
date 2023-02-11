import { Signer } from 'ethers';
import {
    deployTestSystem,
    TestSystemContractsType,
} from '../utils/deployTestSystem';
import { ethers } from 'hardhat';
import { restoreSnapshot, takeSnapshot } from '../utils';
import { expect } from 'chai';
import { toBN, ZERO_ADDRESS } from '../../scripts/util/web3utils';
import { seedTestSystem } from '../utils/seedTestSystem';

describe('LiquidityCertificate - uint tests', async () => {
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
                    contracts.metaDefender.address,
                    ZERO_ADDRESS,
                    'LiquidityCertificate',
                    'LC',
                ),
            ).to.be.revertedWith(
                'Initializable: contract is already initialized',
            );
        });
        // it('should revert if the metadefender address is ZERO_ADDRESS', async () => {
        //     await expect(
        //         contracts.liquidityCertificate.init(
        //             ZERO_ADDRESS,
        //             ZERO_ADDRESS,
        //             'LiquidityCertificate',
        //             'LC',
        //         ),
        //     ).to.be.revertedWith('liquidityPool cannot be 0 address');
        // });
    });

    describe('getLiquidityProviders', async () => {
        it('should return the correct number of liquidity providers', async () => {
            await seedTestSystem(deployer, contracts, 100000, [
                provider1,
                provider2,
            ]);
            await contracts.metaDefender
                .connect(provider1)
                .certificateProviderEntrance(toBN('10100'));
            await contracts.metaDefender
                .connect(provider2)
                .certificateProviderEntrance(toBN('10100'));
            await contracts.metaDefender
                .connect(provider1)
                .certificateProviderEntrance(toBN('10100'));
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
                .certificateProviderEntrance(toBN('10100'));
            expect(
                await contracts.liquidityCertificate.getLiquidity(0),
            ).to.be.equal(toBN('10100'));
        });
    });

    describe('mint', async () => {
        it('will revert if the msg.sender is not the metadefender protocol', async () => {
            await expect(
                contracts.liquidityCertificate
                    .connect(provider1)
                    .mint('1', toBN('10100')),
            ).to.be.revertedWith('Only MetaDefender');
        });
    });
});
