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
                    ZERO_ADDRESS,
                    toBN('0.02'),
                    toBN('0.02'),
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

    describe('update the minimumFee', async () => {
        it('should not allow update when the msg.sender is not the official', async () => {
            await expect(
                contracts.metaDefender
                    .connect(user)
                    .updateMinimumFee(toBN('0.02')),
            ).to.be.revertedWithCustomError(
                contracts.metaDefender,
                'InsufficientPrivilege',
            );
        });
        it('should successfully update the minimumFee', async () => {
            await contracts.metaDefender
                .connect(deployer)
                .updateMinimumFee(toBN('0.03'));
            expect(
                (await contracts.metaDefender.globalInfo()).minimumFee,
            ).to.be.equal(toBN('0.03'));
        });
    });

    describe('provide liquidity', async () => {
        it('will successfully provide liquidity', async () => {
            await seedTestSystem(deployer, contracts, [
                provider1,
                provider2,
                coverBuyer1,
            ]);
            await contracts.metaDefender
                .connect(provider1)
                .providerEntrance(await provider1.getAddress(), toBN('10000'));
            expect(
                await contracts.test.quoteToken.balanceOf(
                    contracts.metaDefender.address,
                ),
            ).to.be.equal(toBN('10000'));
            expect(
                await contracts.test.quoteToken.balanceOf(
                    await provider1.getAddress(),
                ),
            ).to.be.equal(toBN('90000'));
            expect(
                await contracts.liquidityCertificate.balanceOf(
                    await provider1.getAddress(),
                ),
            ).to.be.equal('1');
            const certificateInfo =
                await contracts.liquidityCertificate.getCertificateInfo('0');
            expect(certificateInfo.enteredAt).to.be.greaterThan(0);
            expect(certificateInfo.rewardDebt).to.be.equal(0);
            expect(certificateInfo.shadowDebt).to.be.equal(0);
            expect(certificateInfo.liquidity).to.be.equal(toBN('10000'));
            // check the change of k
            expect(
                (await contracts.metaDefender.globalInfo()).kLast,
            ).to.be.equal(toBN('200'));
            await contracts.metaDefender
                .connect(provider2)
                .providerEntrance(await provider2.getAddress(), toBN('10000'));
            expect(
                (await contracts.metaDefender.globalInfo()).kLast,
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
            await seedTestSystem(deployer, contracts, [provider1]);
            await contracts.metaDefender
                .connect(provider1)
                .providerEntrance(await provider1.getAddress(), toBN('10000'));
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
                .providerEntrance(await provider1.getAddress(), toBN('10000'));
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
                (await contracts.metaDefender.globalInfo()).totalCoverage,
            ).to.be.equal(toBN('2000'));
            expect(
                (await contracts.metaDefender.protocolLiquidity())
                    .totalCertificateLiquidity,
            ).to.be.equal(toBN('10000'));
            // shadow = coverage / totalSupply = 2000 / 10000 = 0.2
            expect(
                (await contracts.metaDefender.globalInfo()).shadowPerShare,
            ).to.be.equal(toBN('0.20'));
            // reward for team  = 0.05 * 40 = 2
            expect(
                (await contracts.metaDefender.globalInfo()).claimableTeamReward,
            ).to.be.equal(toBN('2'));
            // reward for providers = (1 - 0.05) * 40 = 38
            // so the reward per share should be 38 / 10000 = 0.0038
            expect(
                (await contracts.metaDefender.globalInfo()).rewardPerShare,
            ).to.be.equal(toBN('0.0038'));
            // the 0 policy belongs to the coverBuyer1
            expect(await contracts.policy.belongsTo('0')).to.be.equal(
                await coverBuyer1.getAddress(),
            );
        });
    });

    describe('getWithdrawAndShadow', async () => {
        it('will get shadow and withdraw successfully under the scenario of certificateInfo.enteredAt > globalInfo.currentFreedTs', async () => {
            await seedTestSystem(deployer, contracts, [provider1, coverBuyer1]);
            await contracts.metaDefender
                .connect(provider1)
                .providerEntrance(await provider1.getAddress(), toBN('10000'));
            await contracts.metaDefender
                .connect(coverBuyer1)
                .buyCover(toBN('2000'));
            const [withdraw, shadow] =
                await contracts.metaDefender.getWithdrawalAndShadowByCertificate(
                    '0',
                );
            // in this scenario shadow = liquidity * shadowPerShare - CertificateInfo[id].shadowDebt = 10000 * 0.20 - 0 = 2000
            expect(shadow).to.be.equal(toBN('2000'));
            // in this scenario withdraw = liquidity - shadow = 10000 - 2000 = 8000
            expect(withdraw).to.be.equal(toBN('8000'));
        });
    });

    describe('certificateProvider exit', async () => {
        it('should revert if the certificate is invalid', async () => {
            await expect(
                contracts.metaDefender.certificateProviderExit('7777'),
            ).to.be.revertedWith('certificate does not exist');
        });

        it('should revert if the certificate not belongs to the msg.sender', async () => {
            await seedTestSystem(deployer, contracts, [
                provider1,
                provider2,
                coverBuyer1,
            ]);
            await contracts.metaDefender
                .connect(provider1)
                .providerEntrance(await provider1.getAddress(), toBN('10000'));
            await expect(
                contracts.metaDefender
                    .connect(provider2)
                    .certificateProviderExit('0'),
            ).to.be.revertedWith(
                'attempted to burn nonexistent certificate, or not owner',
            );
        });

        it('should get the liquidity back except the locked value', async () => {
            await seedTestSystem(deployer, contracts, [provider1, coverBuyer1]);

            await contracts.metaDefender
                .connect(provider1)
                .providerEntrance(await provider1.getAddress(), toBN('10000'));

            await contracts.metaDefender
                .connect(coverBuyer1)
                .buyCover(toBN('2000'));

            await contracts.metaDefender
                .connect(provider1)
                .certificateProviderExit('0');
            // reward = 38, locked = 2000, balance = 100000 - 2000 + 38 = 98038
            expect(
                await contracts.test.quoteToken.balanceOf(
                    await provider1.getAddress(),
                ),
            ).to.be.equal(toBN('98038'));
            // fee * currentUsableCapital = fee * 0 = 0
            expect(
                (await contracts.metaDefender.globalInfo()).kLast,
            ).to.be.equal(toBN('0'));
        });
    });

    describe('claim rewards', async () => {
        it('will revert if certificateId does not exist', async () => {
            await expect(
                contracts.metaDefender.claimRewards('7777'),
            ).to.be.revertedWith('ERC721: invalid token ID');
        });

        it('will revert if not the provider owner', async () => {
            await seedTestSystem(deployer, contracts, [provider1, coverBuyer1]);
            await contracts.metaDefender
                .connect(provider1)
                .providerEntrance(await provider1.getAddress(), toBN('10000'));
            await expect(
                contracts.metaDefender.connect(provider2).claimRewards('0'),
            ).to.be.revertedWithCustomError(
                contracts.metaDefender,
                'InsufficientPrivilege',
            );
        });

        it('will successfully claim rewards', async () => {
            await seedTestSystem(deployer, contracts, [provider1, coverBuyer1]);
            // provider asset
            await contracts.metaDefender
                .connect(provider1)
                .providerEntrance(await provider1.getAddress(), toBN('10000'));
            // buy cover
            await contracts.metaDefender
                .connect(coverBuyer1)
                .buyCover(toBN('2000'));
            // in this case provider's reward = 38
            await contracts.metaDefender.connect(provider1).claimRewards('0');
            // provider's balance = 100000 - 1000 + 38 = 98038
            expect(
                await contracts.test.quoteToken.balanceOf(
                    await provider1.getAddress(),
                ),
            ).to.be.equal(toBN('90038'));
        });
    });

    describe('getWithdrawalAndShadowByCertificate', async () => {
        it('will revert if the certificateId is invalid', async () => {
            // provider1 is not a provider yet
            await expect(
                contracts.metaDefender.getWithdrawalAndShadowByCertificate(
                    '7777',
                ),
            ).to.be.revertedWith('certificate does not exist');
        });
        it('will calculate the correct shadow and withdraw', async () => {
            // in this scenario, certificateInfo.enteredAt > globalInfo.currentFreedTs
            await seedTestSystem(deployer, contracts, [provider1, coverBuyer1]);
            await contracts.metaDefender
                .connect(provider1)
                .providerEntrance(await provider1.getAddress(), toBN('10000'));
            await contracts.metaDefender
                .connect(coverBuyer1)
                .buyCover(toBN('2000'));
            const withdrawalAndShadow =
                await contracts.metaDefender.getWithdrawalAndShadowByCertificate(
                    '0',
                );
            // in this case shadow = 10000 * 0.2 - 0 = 2000
            expect(withdrawalAndShadow[1]).to.be.equal(toBN('2000'));
            // in this case withdraw = 10000 - 2000 = 8000
            expect(withdrawalAndShadow[0]).to.be.equal(toBN('8000'));
        });
    });

    describe('team claiming', async () => {
        it('should revert if the caller is not the team', async () => {
            await expect(
                contracts.metaDefender.connect(provider1).teamClaim(),
            ).to.be.revertedWithCustomError(
                contracts.metaDefender,
                'InsufficientPrivilege',
            );
        });
        it('should claim reward correctly', async () => {
            await seedTestSystem(deployer, contracts, [provider1, coverBuyer1]);
            await contracts.metaDefender
                .connect(provider1)
                .providerEntrance(await provider1.getAddress(), toBN('10000'));
            await contracts.metaDefender
                .connect(coverBuyer1)
                .buyCover(toBN('2000'));
            await contracts.metaDefender.connect(deployer).teamClaim();
            // team's balance = 2000 * 0.02 * 0.05 = 2.
            expect(
                await contracts.test.quoteToken.balanceOf(
                    await deployer.getAddress(),
                ),
            ).to.be.equal(toBN('100002'));
        });
    });

    describe('get the protocol liquidity', async () => {
        it('should return the correct liquidity', async () => {
            await seedTestSystem(deployer, contracts, [provider1, coverBuyer1]);
            await contracts.metaDefender
                .connect(provider1)
                .providerEntrance(await provider1.getAddress(), toBN('10000'));
            await contracts.metaDefender
                .connect(coverBuyer1)
                .buyCover(toBN('2000'));
            const liquidityBefore =
                await contracts.metaDefender.getProtocolLiquidity();
            // liquidity = 10000
            expect(liquidityBefore.totalCertificateLiquidity).to.be.equal(
                toBN('10000'),
            );
            await contracts.metaDefender
                .connect(provider1)
                .certificateProviderExit('0');
            const liquidityAfter =
                await contracts.metaDefender.getProtocolLiquidity();
            // liquidity = 0
            expect(liquidityAfter.totalCertificateLiquidity).to.be.equal(
                toBN('0'),
            );
        });
    });

    describe('policy claim apply', async () => {
        it('should revert if the policy is expired', async () => {
            await seedTestSystem(deployer, contracts, [provider1, coverBuyer1]);
            await contracts.metaDefender
                .connect(provider1)
                .providerEntrance(await provider1.getAddress(), toBN('10000'));
            await contracts.metaDefender
                .connect(coverBuyer1)
                .buyCover(toBN('2000'));
            // in this case, the policy is expired
            await fastForward(91 * 86400);
            await expect(
                contracts.metaDefender
                    .connect(coverBuyer1)
                    .policyClaimApply('0'),
            ).to.be.revertedWithCustomError(
                contracts.metaDefender,
                'PolicyAlreadyStale',
            );
        });
        it('should revert if the policy has been under claim applying', async () => {
            await seedTestSystem(deployer, contracts, [provider1, coverBuyer1]);
            await contracts.metaDefender
                .connect(provider1)
                .providerEntrance(await provider1.getAddress(), toBN('10000'));
            await contracts.metaDefender
                .connect(coverBuyer1)
                .buyCover(toBN('2000'));
            // in this case, the policy is expired
            await contracts.metaDefender
                .connect(coverBuyer1)
                .policyClaimApply('0');
            await expect(
                contracts.metaDefender
                    .connect(coverBuyer1)
                    .policyClaimApply('0'),
            ).to.be.revertedWithCustomError(
                contracts.metaDefender,
                'ClaimUnderProcessing',
            );
        });
        it('should revert if the msg.sender is not the beneficiary', async () => {
            await seedTestSystem(deployer, contracts, [provider1, coverBuyer1]);
            await contracts.metaDefender
                .connect(provider1)
                .providerEntrance(await provider1.getAddress(), toBN('10000'));
            await contracts.metaDefender
                .connect(coverBuyer1)
                .buyCover(toBN('2000'));
            await expect(
                contracts.metaDefender.connect(provider1).policyClaimApply('0'),
            ).to.be.revertedWithCustomError(
                contracts.metaDefender,
                'SenderNotBeneficiary',
            );
        });
        it('should revert if the policy has been claimed', async () => {
            await seedTestSystem(deployer, contracts, [provider1, coverBuyer1]);
            await contracts.mockRiskReserve.mockMint(toBN('10000'));
            await contracts.metaDefender
                .connect(provider1)
                .providerEntrance(await provider1.getAddress(), toBN('10000'));
            await contracts.metaDefender
                .connect(coverBuyer1)
                .buyCover(toBN('2000'));
            await contracts.metaDefender
                .connect(coverBuyer1)
                .policyClaimApply('0');
            await contracts.metaDefender.connect(deployer).approveApply('0');
            await expect(
                contracts.metaDefender.policyClaimApply('0'),
            ).to.be.revertedWithCustomError(
                contracts.metaDefender,
                'PolicyAlreadyClaimed',
            );
        });
    });

    describe('refuse claim apply', async () => {
        it('should revert if the msg.sender is not the judger', async () => {
            await expect(
                contracts.metaDefender.connect(provider1).refuseApply('0'),
            ).to.be.revertedWithCustomError(
                contracts.metaDefender,
                'InsufficientPrivilege',
            );
        });
        it('should revert if the policyId is invalid', async () => {
            await expect(
                contracts.metaDefender.connect(deployer).refuseApply('7777'),
            ).to.be.revertedWith('policy does not exist');
        });
        it('should revert if the policy is not applying for claim', async () => {
            await seedTestSystem(deployer, contracts, [provider1, coverBuyer1]);
            await contracts.metaDefender
                .connect(provider1)
                .providerEntrance(await provider1.getAddress(), toBN('10000'));
            await contracts.metaDefender
                .connect(coverBuyer1)
                .buyCover(toBN('2000'));
            await expect(
                contracts.metaDefender.connect(deployer).refuseApply('0'),
            ).to.be.revertedWithCustomError(
                contracts.metaDefender,
                'ClaimNotUnderProcessing',
            );
        });
        it('should successfully refuse the claim apply', async () => {
            await seedTestSystem(deployer, contracts, [provider1, coverBuyer1]);
            await contracts.metaDefender
                .connect(provider1)
                .providerEntrance(await provider1.getAddress(), toBN('10000'));
            await contracts.metaDefender
                .connect(coverBuyer1)
                .buyCover(toBN('2000'));
            await contracts.metaDefender
                .connect(coverBuyer1)
                .policyClaimApply('0');
            const policyInfoBeforeRefuseApply =
                await contracts.policy.getPolicyInfo('0');
            expect(policyInfoBeforeRefuseApply.isClaimApplying).to.be.equal(
                true,
            );
            await contracts.metaDefender.connect(deployer).refuseApply('0');
            const policyInfoAfterRefuseApply =
                await contracts.policy.getPolicyInfo('0');
            expect(policyInfoAfterRefuseApply.isClaimApplying).to.be.equal(
                false,
            );
        });
    });

    describe('approve apply', async () => {
        it('should revert if the msg.sender is not the judger', async () => {
            await expect(
                contracts.metaDefender.connect(provider1).approveApply('0'),
            ).to.be.revertedWithCustomError(
                contracts.metaDefender,
                'InsufficientPrivilege',
            );
        });
        it('should revert if the policyId is invalid', async () => {
            await expect(
                contracts.metaDefender.connect(deployer).approveApply('7777'),
            ).to.be.revertedWith('policy does not exist');
        });
        it('should revert if the policy is not applying for claim', async () => {
            await seedTestSystem(deployer, contracts, [provider1, coverBuyer1]);
            await contracts.metaDefender
                .connect(provider1)
                .providerEntrance(await provider1.getAddress(), toBN('10000'));
            await contracts.metaDefender
                .connect(coverBuyer1)
                .buyCover(toBN('2000'));
            await expect(
                contracts.metaDefender.connect(deployer).approveApply('0'),
            ).to.be.revertedWithCustomError(
                contracts.metaDefender,
                'ClaimNotUnderProcessing',
            );
        });
        it('should pay exact the coverage when there are enough funds in risk reserve contract', async () => {
            await seedTestSystem(deployer, contracts, [provider1, coverBuyer1]);
            await contracts.mockRiskReserve.mockMint(toBN('10000'));
            await contracts.metaDefender
                .connect(provider1)
                .providerEntrance(await provider1.getAddress(), toBN('10000'));
            await contracts.metaDefender
                .connect(coverBuyer1)
                .buyCover(toBN('2000'));
            await contracts.metaDefender
                .connect(coverBuyer1)
                .policyClaimApply('0');
            await contracts.metaDefender.connect(deployer).approveApply('0');

            // coverBuyer1 should get 2000 tokens: 100000 - 2000 * 0.02 - 2000 *0.02 *0.05 + 2000 = 101958
            expect(
                await contracts.test.quoteToken.balanceOf(
                    await coverBuyer1.getAddress(),
                ),
            ).to.be.equal(toBN('101958'));

            expect(
                await contracts.test.quoteToken.balanceOf(
                    contracts.mockRiskReserve.address,
                ),
            ).to.be.equal(toBN('8000'));
        });
    });

    describe('get fee', async () => {
        it('will revert when insufficient usable funds', async () => {
            await seedTestSystem(deployer, contracts, [provider1, coverBuyer1]);
            await expect(
                contracts.metaDefender.connect(provider1).getFee(),
            ).to.be.revertedWithCustomError(
                contracts.metaDefender,
                'InsufficientUsableCapital',
            );
        });
    });

    describe('medal provider withdraw', async () => {
        it('will revert if the medalId is not exist', async () => {
            await expect(
                contracts.metaDefender
                    .connect(provider1)
                    .medalProviderWithdraw('7777'),
            ).to.be.revertedWith('medal does not exist');
        });
    });

    describe('medal provider withdraw', async () => {
        it('will revert if the medalId is not exist', async () => {
            await expect(
                contracts.metaDefender
                    .connect(provider1)
                    .medalProviderWithdraw('7777'),
            ).to.be.revertedWith('medal does not exist');
        });
        it('will revert if the medalId is not belong to the msg.sender', async () => {
            await seedTestSystem(deployer, contracts, [provider1, coverBuyer1]);
            await contracts.metaDefender
                .connect(provider1)
                .providerEntrance(await provider1.getAddress(), toBN('10000'));
            await contracts.metaDefender
                .connect(coverBuyer1)
                .buyCover(toBN('2000'));
            await contracts.metaDefender
                .connect(provider1)
                .certificateProviderExit('0');
            await expect(
                contracts.metaDefender
                    .connect(coverBuyer1)
                    .medalProviderWithdraw('0'),
            ).to.be.revertedWithCustomError(
                contracts.metaDefender,
                'InsufficientPrivilege',
            );
        });
        it('will get the shadow and withdrawal successfully when medalInfo.enteredAt > globalInfo.currentFreedTs', async () => {
            await seedTestSystem(deployer, contracts, [provider1, coverBuyer1]);
            await contracts.metaDefender
                .connect(provider1)
                .providerEntrance(await provider1.getAddress(), toBN('10000'));
            await contracts.metaDefender
                .connect(coverBuyer1)
                .buyCover(toBN('2000'));
            await contracts.metaDefender
                .connect(provider1)
                .certificateProviderExit('0');
            const withdrawalAndAShadowByMedal =
                await contracts.metaDefender.getWithdrawalAndShadowByMedal('0');
            // which means one can withdraw 0 from the medal.
            expect(withdrawalAndAShadowByMedal[0]).to.be.equal(toBN('0'));
            // and he still has 2000 locked in the medal.
            expect(withdrawalAndAShadowByMedal[1]).to.be.equal(toBN('2000'));
            await contracts.metaDefender
                .connect(provider1)
                .medalProviderWithdraw('0');
        });
        describe('cancel policy', async () => {
            it('will revert when policy is not expired', async () => {
                await seedTestSystem(deployer, contracts, [
                    provider1,
                    coverBuyer1,
                ]);
                await contracts.metaDefender
                    .connect(provider1)
                    .providerEntrance(
                        await provider1.getAddress(),
                        toBN('10000'),
                    );
                await contracts.metaDefender
                    .connect(coverBuyer1)
                    .buyCover(toBN('2000'));
                await fastForward(45 * 86400);
                await expect(
                    contracts.metaDefender.cancelPolicy('0'),
                ).to.be.revertedWith('policy is not expired');
            });
            it('will revert if the other one cancel the policy in one day', async () => {
                await seedTestSystem(deployer, contracts, [
                    provider1,
                    coverBuyer1,
                ]);
                await contracts.metaDefender
                    .connect(provider1)
                    .providerEntrance(
                        await provider1.getAddress(),
                        toBN('10000'),
                    );
                await contracts.metaDefender
                    .connect(coverBuyer1)
                    .buyCover(toBN('2000'));
                // after 90 day and a half
                await fastForward(90 * 86400 + 43200);
                await expect(
                    contracts.metaDefender.connect(provider1).cancelPolicy('0'),
                ).to.be.revertedWithCustomError(
                    contracts.metaDefender,
                    'PolicyCanOnlyCancelledByHolder',
                );
            });
            it('will successfully cancel the policy in one day', async () => {
                await seedTestSystem(deployer, contracts, [
                    provider1,
                    coverBuyer1,
                ]);
                await contracts.metaDefender
                    .connect(provider1)
                    .providerEntrance(
                        await provider1.getAddress(),
                        toBN('10000'),
                    );
                await contracts.metaDefender
                    .connect(coverBuyer1)
                    .buyCover(toBN('2000'));
                // after 90 day and a half
                await fastForward(90 * 86400 + 43200);
                await contracts.metaDefender
                    .connect(coverBuyer1)
                    .cancelPolicy('0');
            });
            it('will successfully cancel the policy after one day by another', async () => {
                await seedTestSystem(deployer, contracts, [
                    provider1,
                    coverBuyer1,
                ]);
                await contracts.metaDefender
                    .connect(provider1)
                    .providerEntrance(
                        await provider1.getAddress(),
                        toBN('10000'),
                    );
                await contracts.metaDefender
                    .connect(coverBuyer1)
                    .buyCover(toBN('2000'));
                // after 91 days and a half
                await fastForward(91 * 86400);
                await contracts.metaDefender
                    .connect(coverBuyer1)
                    .cancelPolicy('0');
            });
            it('will revert if the policy is already cancelled', async () => {
                await seedTestSystem(deployer, contracts, [
                    provider1,
                    coverBuyer1,
                ]);
                await contracts.metaDefender
                    .connect(provider1)
                    .providerEntrance(
                        await provider1.getAddress(),
                        toBN('10000'),
                    );
                await contracts.metaDefender
                    .connect(coverBuyer1)
                    .buyCover(toBN('2000'));
                // after 91 days and a half
                await fastForward(91 * 86400);
                await contracts.metaDefender
                    .connect(coverBuyer1)
                    .cancelPolicy('0');
                await expect(
                    contracts.metaDefender
                        .connect(coverBuyer1)
                        .cancelPolicy('0'),
                ).to.be.revertedWith('policy is already cancelled');
            });
        });
    });
});
