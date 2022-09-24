import { BigNumber, Signer } from 'ethers';
import { ethers } from 'hardhat';
import {
    HOUR_SEC,
    MONTH_SEC,
    toBN,
    toBytes32,
    TradeType,
    UNIT,
    WEEK_SEC,
    ZERO_ADDRESS,
} from '../../scripts/util/web3utils';
import {
    currentTime,
    fastForward,
    restoreSnapshot,
    takeSnapshot,
} from '../utils';
import {
    deployTestSystem,
    TestSystemContractsType,
} from '../utils/deployTestSystem';
import { expect } from 'chai';
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
                contracts.metaDefender.init(
                    ZERO_ADDRESS,
                    ZERO_ADDRESS,
                    ZERO_ADDRESS,
                    ZERO_ADDRESS,
                    ZERO_ADDRESS,
                    ZERO_ADDRESS,
                    ZERO_ADDRESS,
                ),
            ).to.be.revertedWithCustomError(
                contracts.metaDefender,
                'ContractAlreadyInitialized',
            );
        });
    });

    describe('transferJudger', async () => {
        it('should not allow transfer when the msg.sender is not the judger', async () => {
            await expect(
                contracts.metaDefender
                    .connect(user)
                    .transferJudger(await user.getAddress()),
            ).to.be.revertedWithCustomError(
                contracts.metaDefender,
                'InsufficientPrivilege',
            );
        });
        it('should successfully transfer the judger', async () => {
            await contracts.metaDefender
                .connect(deployer)
                .transferJudger(await user.getAddress());
            expect(await contracts.metaDefender.judger()).to.be.equal(
                await user.getAddress(),
            );
        });
    });

    describe('transfer official', async () => {
        it('should not allow transfer when the msg.sender is not the official', async () => {
            await expect(
                contracts.metaDefender
                    .connect(user)
                    .transferOfficial(await user.getAddress()),
            ).to.be.revertedWithCustomError(
                contracts.metaDefender,
                'InsufficientPrivilege',
            );
        });
        it('should successfully transfer the official', async () => {
            await contracts.metaDefender
                .connect(deployer)
                .transferOfficial(await user.getAddress());
            expect(await contracts.metaDefender.official()).to.be.equal(
                await user.getAddress(),
            );
        });
    });

    describe('provide liquidity', async () => {
        it('will fail if one has been acted as a provider', async () => {
            await seedTestSystem(deployer, contracts, [provider1, coverBuyer1]);
            await contracts.metaDefender
                .connect(provider1)
                .providerEntrance(toBN('10000'));
            await expect(
                contracts.metaDefender
                    .connect(provider1)
                    .providerEntrance(toBN('10000')),
            ).to.be.revertedWithCustomError(
                contracts.metaDefender,
                'ProviderDetected',
            );
        });

        it('will successfully provide liquidity', async () => {
            await seedTestSystem(deployer, contracts, [
                provider1,
                provider2,
                coverBuyer1,
            ]);
            await contracts.metaDefender
                .connect(provider1)
                .providerEntrance(toBN('10000'));
            expect(
                await contracts.liquidityToken.balanceOf(
                    await provider1.getAddress(),
                ),
            ).to.be.equal(toBN('10000'));
            // check the change of k
            expect(
                (await contracts.metaDefender.marketInfos(ZERO_ADDRESS)).kLast,
            ).to.be.equal(toBN('200'));
            await contracts.metaDefender
                .connect(provider2)
                .providerEntrance(toBN('10000'));
            expect(
                (await contracts.metaDefender.marketInfos(ZERO_ADDRESS)).kLast,
            ).to.be.equal(toBN('400'));
        });
    });

    describe('buyCover', async () => {
        it('will fail to buy a cover due to insufficient usable capital', async () => {
            await expect(
                contracts.metaDefender.buyCover(toBN('100')),
            ).to.be.revertedWithCustomError(
                contracts.metaDefender,
                'InsufficientUsableCapital',
            );
        });

        it('will fail to buy a cover due to exceeding maximum coverage percentage', async () => {
            // first we deposit some capital into the pool
            await seedTestSystem(deployer, contracts, [user]);
            await contracts.metaDefender
                .connect(user)
                .providerEntrance(toBN('10000'));
            await expect(
                contracts.metaDefender.buyCover(toBN('2001')),
            ).to.be.revertedWithCustomError(
                contracts.metaDefender,
                'CoverageTooLarge',
            );
        });

        it('will successfully buy a cover', async () => {
            // first we deposit some capital into the pool
            await seedTestSystem(deployer, contracts, [provider1, coverBuyer1]);
            await contracts.metaDefender
                .connect(provider1)
                .providerEntrance(toBN('10000'));
            await contracts.metaDefender
                .connect(coverBuyer1)
                .buyCover(toBN('2000'));
            expect(
                await contracts.test.quoteToken.balanceOf(
                    await provider1.getAddress(),
                ),
            ).to.be.equal(toBN('90000'));
            expect(
                await contracts.test.quoteToken.balanceOf(
                    await coverBuyer1.getAddress(),
                ),
            ).to.be.equal(toBN('99958'));
            expect(
                await (
                    await contracts.metaDefender.marketInfos(ZERO_ADDRESS)
                ).totalCoverage,
            ).to.be.equal(toBN('2000'));
            // accSPS = coverage / totalSupply = 2000 / 10000 = 0.2
            expect(
                await (
                    await contracts.metaDefender.marketInfos(ZERO_ADDRESS)
                ).accSPS,
            ).to.be.equal(toBN('0.20'));
            // reward for team  = 0.05 * 40 = 2
            expect(
                await (
                    await contracts.metaDefender.marketInfos(ZERO_ADDRESS)
                ).claimableTeamReward,
            ).to.be.equal(toBN('2'));
            // reward for providers = (1 - 0.05) * 40 = 38
            // so the accRPS should be 38 / 10000 = 0.0038
            expect(
                await (
                    await contracts.metaDefender.marketInfos(ZERO_ADDRESS)
                ).accRPS,
            ).to.be.equal(toBN('0.0038'));
            // the 0 policy belongs to the coverBuyer1
            expect(
                await contracts.metaDefender.userPolicies(
                    await coverBuyer1.getAddress(),
                    0,
                ),
            ).to.be.equal(0);
        });
    });

    describe('getWithdrawAndShadow', async () => {
        it('will get shadow and withdraw successfully under the scenario of provider.index > lastUnforzenIndex', async () => {
            await seedTestSystem(deployer, contracts, [provider1, coverBuyer1]);
            await contracts.metaDefender
                .connect(provider1)
                .providerEntrance(toBN('10000'));
            await contracts.metaDefender
                .connect(coverBuyer1)
                .buyCover(toBN('2000'));
            const [withdraw, shadow] =
                await contracts.metaDefender.getWithdrawalAndShadow(
                    await provider1.getAddress(),
                );
            // in this scenario shadow = saUSDAmount * accSPS - provider.SDebt = 10000 * 0.20 - 0 = 2000
            expect(shadow).to.be.equal(toBN('2000'));
            // in this scenario withdraw = saUSDAmount - shadow = 10000 - 2000 = 8000
            expect(withdraw).to.be.equal(toBN('8000'));
        });
    });

    describe('provider exit', async () => {
        it('should revert if the provider has no liquidity', async () => {
            await expect(
                contracts.metaDefender.providerExit(),
            ).to.be.revertedWithCustomError(
                contracts.metaDefender,
                'ProviderNotExistOrActive',
            );
        });
        it('should get the liquidity back except the locked value', async () => {
            await seedTestSystem(deployer, contracts, [provider1, coverBuyer1]);

            await contracts.metaDefender
                .connect(provider1)
                .providerEntrance(toBN('10000'));

            await contracts.metaDefender
                .connect(coverBuyer1)
                .buyCover(toBN('2000'));

            await contracts.metaDefender.connect(provider1).providerExit();
            // reward = 38, locked = 2000, balance = 100000 - 2000 + 38 = 98038
            expect(
                await contracts.test.quoteToken.balanceOf(
                    await provider1.getAddress(),
                ),
            ).to.be.equal(toBN('98038'));
            // saUSDAmount = 0
            expect(
                await contracts.liquidityToken.balanceOf(
                    await provider1.getAddress(),
                ),
            ).to.be.equal(toBN('0'));
            // fee * currentUsableCapital = fee * 0 = 0
            expect(
                (await contracts.metaDefender.marketInfos(ZERO_ADDRESS)).kLast,
            ).to.be.equal(toBN('0'));
        });
    });

    describe('claim rewards', async () => {
        it('will revert if not provider', async () => {
            expect(
                contracts.metaDefender.claimRewards(),
            ).to.be.revertedWithCustomError(
                contracts.metaDefender,
                'ProviderNotExistOrActive',
            );
        });
        it('will successfully claim rewards', async () => {
            await seedTestSystem(deployer, contracts, [provider1, coverBuyer1]);
            // provider asset
            await contracts.metaDefender
                .connect(provider1)
                .providerEntrance(toBN('10000'));
            // buy cover
            await contracts.metaDefender
                .connect(coverBuyer1)
                .buyCover(toBN('2000'));
            // in this case provider's reward = 38
            await contracts.metaDefender.connect(provider1).claimRewards();
            // provider's balance = 100000 - 1000 + 38 = 98038
            expect(
                await contracts.test.quoteToken.balanceOf(
                    await provider1.getAddress(),
                ),
            ).to.be.equal(toBN('90038'));
        });
    });

    describe('getWithdrawalAndShadow', async () => {
        it('will return zero if one is not the provider', async () => {
            // provider1 is not a provider yet
            const withdrawalAndShadow =
                await contracts.metaDefender.getWithdrawalAndShadow(
                    await provider1.getAddress(),
                );
            expect(withdrawalAndShadow[0]).to.be.equal(toBN('0'));
            expect(withdrawalAndShadow[1]).to.be.equal(toBN('0'));
        });
        it('will calculate the correct shadow and withdraw', async () => {
            // in this senario, provider index is greater than lastUnforzenIndex
            await seedTestSystem(deployer, contracts, [provider1, coverBuyer1]);
            await contracts.metaDefender
                .connect(provider1)
                .providerEntrance(toBN('10000'));
            await contracts.metaDefender
                .connect(coverBuyer1)
                .buyCover(toBN('2000'));
            const withdrawalAndShadow =
                await contracts.metaDefender.getWithdrawalAndShadow(
                    await provider1.getAddress(),
                );
            // in this case shadow = 10000 * 0.2 - 0 = 2000
            expect(withdrawalAndShadow[1]).to.be.equal(toBN('2000'));
            // in this case withdraw = 10000 - 2000 = 8000
            expect(withdrawalAndShadow[0]).to.be.equal(toBN('8000'));
        });
    });

    describe('getWithdrawalAndShadowHistorical', async () => {
        it('will revert if one is not the provider', async () => {
            await expect(
                contracts.metaDefender
                    .connect(provider1)
                    .getWithdrawalAndShadowHistorical(),
            );
        });
    });
});
