import { Signer } from 'ethers';
import { ethers } from 'hardhat';
import {
    MOCK_MINING_ADDRESS,
    MOCK_PROXY_ADDRESS,
    toBN,
    ZERO_ADDRESS,
} from '../../scripts/util/web3utils';
import { fastForward, restoreSnapshot, takeSnapshot } from '../utils';
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
        it('will revert if the liquidity is less than the MIN_LIQUIDITY', async () => {
            await seedTestSystem(deployer, contracts, 100000, [provider1]);
            await expect(
                contracts.metaDefender
                    .connect(provider1)
                    .certificateProviderEntrance(toBN('0.01')),
            ).to.be.revertedWithCustomError(
                contracts.liquidityCertificate,
                'InsufficientLiquidity',
            );
        });
        it('will successfully provide liquidity', async () => {
            await seedTestSystem(deployer, contracts, 100000, [
                provider1,
                provider2,
                coverBuyer1,
            ]);
            await contracts.metaDefender
                .connect(provider1)
                .certificateProviderEntrance(toBN('10000'));
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
            expect(certificateInfo.enteredEpochIndex).to.be.equal('1');
            expect(certificateInfo.exitedEpochIndex).to.be.equal('0');
            expect(certificateInfo.rewardDebtEpochIndex).to.be.equal('1');
            expect(certificateInfo.liquidity).to.be.equal(toBN('10000'));
            expect(certificateInfo.SPSLocked).to.be.eq('0');
            expect(certificateInfo.isValid).to.be.eq(true);
        });
    });

    describe('buyCover', async () => {
        it('will fail to buy a cover due to coverage too large', async () => {
            await expect(
                contracts.metaDefender.buyPolicy(
                    await coverBuyer1.getAddress(),
                    toBN('100'),
                    '365',
                ),
            ).to.be.revertedWithCustomError(
                contracts.metaDefender,
                'CoverageTooLarge',
            );
        });
        it('will revert due to the liquidity will not get into the pool immediately', async () => {
            // first we deposit some capital into the pool
            await seedTestSystem(deployer, contracts, 100000, [
                provider1,
                coverBuyer1,
            ]);
            await contracts.metaDefender
                .connect(provider1)
                .certificateProviderEntrance(toBN('10000'));
            await expect(
                contracts.metaDefender
                    .connect(coverBuyer1)
                    .buyPolicy(
                        await coverBuyer1.getAddress(),
                        toBN('100'),
                        '365',
                    ),
            ).to.be.revertedWithCustomError(
                contracts.metaDefender,
                'CoverageTooLarge',
            );
        });
        it('will successfully buy a policy', async () => {
            // first we deposit some capital into the pool
            await seedTestSystem(deployer, contracts, 100000, [
                provider1,
                coverBuyer1,
            ]);
            await contracts.metaDefender
                .connect(provider1)
                .certificateProviderEntrance(toBN('10100'));

            await fastForward(86400);

            await contracts.metaDefender
                .connect(coverBuyer1)
                .buyPolicy(await coverBuyer1.getAddress(), toBN('100'), '365');

            // check the policy
            expect(await contracts.policy.belongsTo('0')).to.be.equal(
                await coverBuyer1.getAddress(),
            );

            const policy = await contracts.policy.getPolicyInfo('0');

            expect(policy.beneficiary).to.be.equal(
                await coverBuyer1.getAddress(),
            );
            expect(policy.coverage).to.be.equal(toBN('100'));
            expect(policy.fee).to.be.equal(toBN('0.05'));
            expect(policy.enteredEpochIndex).to.be.equal('2');
            expect(policy.duration).to.be.equal('365');
            expect(policy.SPS).to.approximately(
                toBN(String(100 / 10100)),
                toBN(String((100 / 10100) * 0.0001)),
            );
            expect(
                await contracts.test.quoteToken.balanceOf(
                    await coverBuyer1.getAddress(),
                ),
            ).to.be.equal(toBN('99998.9'));
        });
    });

    describe('certificateProvider exit', async () => {
        it('should revert if the certificate is invalid', async () => {
            await expect(
                contracts.metaDefender.certificateProviderExit('7777'),
            ).to.be.revertedWith('ERC721: invalid token ID');
        });
        it('should revert if the certificate not belongs to the msg.sender', async () => {
            await seedTestSystem(deployer, contracts, 100000, [
                provider1,
                provider2,
                coverBuyer1,
            ]);
            await contracts.metaDefender
                .connect(provider1)
                .certificateProviderEntrance(toBN('10100'));
            await fastForward(86400);
            await contracts.metaDefender
                .connect(provider1)
                .signalCertificateProviderExit('0');
            await fastForward(86400);
            await expect(
                contracts.metaDefender
                    .connect(provider2)
                    .certificateProviderExit('0'),
            ).to.be.revertedWithCustomError(
                contracts.metaDefender,
                'InsufficientPrivilege',
            );
        });
        it('should revert if withdrawing the certificate without signalWithdraw', async () => {
            await seedTestSystem(deployer, contracts, 100000, [
                provider1,
                provider2,
                coverBuyer1,
            ]);
            await contracts.metaDefender
                .connect(provider1)
                .certificateProviderEntrance(toBN('10100'));
            await expect(
                contracts.metaDefender
                    .connect(provider1)
                    .certificateProviderExit('0'),
            ).to.be.revertedWithCustomError(
                contracts.metaDefender,
                'CertificateNotSignalWithdraw',
            );
        });
        it('should revert if the withdraw epoch is the same as the signalWithdraw epoch', async () => {
            await seedTestSystem(deployer, contracts, 100000, [
                provider1,
                provider2,
                coverBuyer1,
            ]);
            await contracts.metaDefender
                .connect(provider1)
                .certificateProviderEntrance(toBN('10100'));
            await fastForward(86400);
            await contracts.metaDefender
                .connect(provider1)
                .signalCertificateProviderExit('0');
            await expect(
                contracts.metaDefender
                    .connect(provider1)
                    .certificateProviderExit('0'),
            ).to.be.revertedWithCustomError(
                contracts.metaDefender,
                'SignalWithdrawEpochEqualsCurrentEpoch',
            );
        });
        it('should get the liquidity back except the locked value', async () => {
            await seedTestSystem(deployer, contracts, 100000, [
                provider1,
                provider2,
                coverBuyer1,
            ]);

            await contracts.metaDefender
                .connect(provider1)
                .certificateProviderEntrance(toBN('10100'));

            await fastForward(86400);

            await contracts.metaDefender
                .connect(coverBuyer1)
                .buyPolicy(await coverBuyer1.getAddress(), toBN('100'), '365');
            await fastForward(86400);
            await contracts.metaDefender
                .connect(provider1)
                .signalCertificateProviderExit('0');
            await fastForward(86400);
            await contracts.metaDefender
                .connect(provider1)
                .certificateProviderExit('0');
            // reward = 1, locked = 100, withdraw = 10100 - 100 + 1 = 10001 balance = 100000 - 10100 + 10001 = 99901;
            expect(
                await contracts.test.quoteToken.balanceOf(
                    await provider1.getAddress(),
                ),
            ).to.approximately(toBN('99901'), toBN(String(99901 * 0.0001)));
            await fastForward(86400 * 365);
        });
    });

    describe('claim rewards', async () => {
        it('will revert if certificateId does not exist', async () => {
            await expect(
                contracts.metaDefender.claimRewards('7777'),
            ).to.be.revertedWith('ERC721: invalid token ID');
        });
        it('will revert if not the provider owner', async () => {
            await seedTestSystem(deployer, contracts, 100000, [
                provider1,
                coverBuyer1,
            ]);
            await contracts.metaDefender
                .connect(provider1)
                .certificateProviderEntrance(toBN('10000'));
            await expect(
                contracts.metaDefender.connect(provider2).claimRewards('0'),
            ).to.be.revertedWithCustomError(
                contracts.metaDefender,
                'InsufficientPrivilege',
            );
        });
        it('will successfully claim rewards', async () => {
            await seedTestSystem(deployer, contracts, 100000, [
                provider1,
                coverBuyer1,
            ]);
            // provider asset
            await contracts.metaDefender
                .connect(provider1)
                .certificateProviderEntrance(toBN('10100'));
            await fastForward(86400);
            // buy cover
            await contracts.metaDefender
                .connect(coverBuyer1)
                .buyPolicy(await coverBuyer1.getAddress(), toBN('100'), '365');
            await fastForward(86400);
            // in this case provider's reward = 1
            await contracts.metaDefender.connect(provider1).claimRewards('0');
            // provider's balance = 100000 - 10100 + 1 = 89901
            expect(
                await contracts.test.quoteToken.balanceOf(
                    await provider1.getAddress(),
                ),
            ).to.approximately(toBN('89901'), toBN(String(89901 * 0.0001)));
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
            await seedTestSystem(deployer, contracts, 100000, [
                provider1,
                coverBuyer1,
            ]);
            await contracts.metaDefender
                .connect(provider1)
                .certificateProviderEntrance(toBN('10100'));
            await fastForward(86400);
            await contracts.metaDefender
                .connect(coverBuyer1)
                .buyPolicy(await coverBuyer1.getAddress(), toBN('100'), '365');
            await contracts.metaDefender.connect(deployer).teamClaim();
            // team's balance = 1 * 0.05 = 0.05
            expect(
                await contracts.test.quoteToken.balanceOf(
                    await deployer.getAddress(),
                ),
            ).to.be.equal(toBN('100000.05'));
        });
    });

    describe('policy claim apply', async () => {
        it('should revert if the policy is expired', async () => {
            await seedTestSystem(deployer, contracts, 100000, [
                provider1,
                coverBuyer1,
            ]);
            await contracts.metaDefender
                .connect(provider1)
                .certificateProviderEntrance(toBN('10100'));
            await fastForward(86400);
            await contracts.metaDefender
                .connect(coverBuyer1)
                .buyPolicy(await coverBuyer1.getAddress(), toBN('100'), '365');
            // in this case, the policy is expired
            await fastForward(380 * 86400);
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
            await seedTestSystem(deployer, contracts, 100000, [
                provider1,
                coverBuyer1,
            ]);
            await contracts.metaDefender
                .connect(provider1)
                .certificateProviderEntrance(toBN('10100'));
            await fastForward(86400);
            await contracts.metaDefender
                .connect(coverBuyer1)
                .buyPolicy(await coverBuyer1.getAddress(), toBN('100'), '365');
            await fastForward(180 * 86400);
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
            await seedTestSystem(deployer, contracts, 100000, [
                provider1,
                coverBuyer1,
            ]);
            await contracts.metaDefender
                .connect(provider1)
                .certificateProviderEntrance(toBN('10100'));
            await fastForward(86400);
            await contracts.metaDefender
                .connect(coverBuyer1)
                .buyPolicy(await coverBuyer1.getAddress(), toBN('100'), '365');
            await fastForward(180 * 86400);
            await expect(
                contracts.metaDefender
                    .connect(coverBuyer2)
                    .policyClaimApply('0'),
            ).to.be.revertedWithCustomError(
                contracts.metaDefender,
                'SenderNotBeneficiary',
            );
        });
        it('should revert if the policy has been claimed', async () => {
            await seedTestSystem(deployer, contracts, 100000, [
                provider1,
                coverBuyer1,
            ]);
            await contracts.mockRiskReserve.mockMint(toBN('10000'));
            await contracts.metaDefender
                .connect(provider1)
                .certificateProviderEntrance(toBN('10100'));
            await fastForward(86400);
            await contracts.metaDefender
                .connect(coverBuyer1)
                .buyPolicy(await coverBuyer1.getAddress(), toBN('100'), '365');
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
            await seedTestSystem(deployer, contracts, 100000, [
                provider1,
                coverBuyer1,
            ]);
            await contracts.metaDefender
                .connect(provider1)
                .certificateProviderEntrance(toBN('10100'));
            await fastForward(86400);
            await contracts.metaDefender
                .connect(coverBuyer1)
                .buyPolicy(await coverBuyer1.getAddress(), toBN('100'), '365');
            await expect(
                contracts.metaDefender.connect(deployer).refuseApply('0'),
            ).to.be.revertedWithCustomError(
                contracts.metaDefender,
                'ClaimNotUnderProcessing',
            );
        });
        it('should successfully refuse the claim apply', async () => {
            await seedTestSystem(deployer, contracts, 100000, [
                provider1,
                coverBuyer1,
            ]);
            await contracts.metaDefender
                .connect(provider1)
                .certificateProviderEntrance(toBN('10100'));
            await fastForward(86400);
            await contracts.metaDefender
                .connect(coverBuyer1)
                .buyPolicy(await coverBuyer1.getAddress(), toBN('100'), '365');
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
            await seedTestSystem(deployer, contracts, 100000, [
                provider1,
                coverBuyer1,
            ]);
            await contracts.metaDefender
                .connect(provider1)
                .certificateProviderEntrance(toBN('10100'));
            await fastForward(86400);
            await contracts.metaDefender
                .connect(coverBuyer1)
                .buyPolicy(await coverBuyer1.getAddress(), toBN('100'), '365');
            await expect(
                contracts.metaDefender.connect(deployer).approveApply('0'),
            ).to.be.revertedWithCustomError(
                contracts.metaDefender,
                'ClaimNotUnderProcessing',
            );
        });
        it('should pay exact the coverage when there are enough funds in risk reserve contract', async () => {
            await seedTestSystem(deployer, contracts, 100000, [
                provider1,
                coverBuyer1,
            ]);
            await contracts.mockRiskReserve.mockMint(toBN('10000'));
            await contracts.metaDefender
                .connect(provider1)
                .certificateProviderEntrance(toBN('10100'));
            await fastForward(86400);
            await contracts.metaDefender
                .connect(coverBuyer1)
                .buyPolicy(await coverBuyer1.getAddress(), toBN('100'), '365');
            await contracts.metaDefender
                .connect(coverBuyer1)
                .policyClaimApply('0');
            await contracts.metaDefender.connect(deployer).approveApply('0');
            // coverBuyer1 should get 100 tokens: 100000 - 1 - 0.10 + 100 = 10098.9
            expect(
                await contracts.test.quoteToken.balanceOf(
                    await coverBuyer1.getAddress(),
                ),
            ).to.be.equal(toBN('100098.95'));
            expect(
                await contracts.test.quoteToken.balanceOf(
                    contracts.mockRiskReserve.address,
                ),
            ).to.be.equal(toBN('9900'));
        });
        it('should pay exact the coverage and not change the accSPS when there are not enough funds in the risk reserve contract', async () => {
            await seedTestSystem(deployer, contracts, 100000, [
                provider1,
                provider2,
                coverBuyer1,
            ]);
            await contracts.mockRiskReserve.mockMint(toBN('50'));
            await contracts.metaDefender
                .connect(provider1)
                .certificateProviderEntrance(toBN('10100'));
            await fastForward(86400);
            await contracts.metaDefender
                .connect(coverBuyer1)
                .buyPolicy(await coverBuyer1.getAddress(), toBN('100'), '365');
            const globalInfoBefore =
                await contracts.metaDefender.getGlobalInfo();
            await contracts.metaDefender
                .connect(coverBuyer1)
                .policyClaimApply('0');
            await contracts.metaDefender.connect(deployer).approveApply('0');
            // coverBuyer1 should get 100 tokens and all these tokens will be paid from the pool.
            expect(
                await contracts.test.quoteToken.balanceOf(
                    await coverBuyer1.getAddress(),
                ),
            ).to.be.equal(toBN('100098.95'));
            expect(
                await contracts.test.quoteToken.balanceOf(
                    contracts.mockRiskReserve.address,
                ),
            ).to.be.equal(toBN('50'));
            // 10100 + 1 + 0.10 - 100 - 0.05 = 10001.05
            expect(
                await contracts.test.quoteToken.balanceOf(
                    contracts.metaDefender.address,
                ),
            ).to.be.equal(toBN('10001.05'));
            // in this case the accSPS will remain the same.
            const globalInfoAfter =
                await contracts.metaDefender.getGlobalInfo();
            expect(globalInfoAfter.accSPS).to.be.equal(globalInfoBefore.accSPS);
        });
    });

    describe('provider withdraw', async () => {
        it('should revert if the certificateId is not exist', async () => {
            await expect(
                contracts.metaDefender
                    .connect(provider1)
                    .withdrawAfterExit('7777'),
            ).to.be.revertedWith('ERC721: invalid token ID');
        });
        it('should revert if the certificateId is not belong to the msg.sender', async () => {
            await seedTestSystem(deployer, contracts, 100000, [
                provider1,
                provider2,
                coverBuyer1,
            ]);
            await contracts.metaDefender
                .connect(provider1)
                .certificateProviderEntrance(toBN('10100'));
            await fastForward(86400);
            await contracts.metaDefender
                .connect(coverBuyer1)
                .buyPolicy(await coverBuyer1.getAddress(), toBN('100'), '365');
            await fastForward(86400);
            await contracts.metaDefender
                .connect(provider1)
                .signalCertificateProviderExit('0');
            await fastForward(86400);
            await contracts.metaDefender
                .connect(provider1)
                .certificateProviderExit('0');
            await expect(
                contracts.metaDefender
                    .connect(coverBuyer1)
                    .withdrawAfterExit('0'),
            ).to.be.revertedWithCustomError(
                contracts.metaDefender,
                'InsufficientPrivilege',
            );
        });
        it('should successfully get withdraw after exit from the pool', async () => {
            await seedTestSystem(deployer, contracts, 100000, [
                provider1,
                provider2,
                coverBuyer1,
            ]);
            await contracts.metaDefender
                .connect(provider1)
                .certificateProviderEntrance(toBN('10100'));
            await fastForward(86400);
            await contracts.metaDefender
                .connect(coverBuyer1)
                .buyPolicy(await coverBuyer1.getAddress(), toBN('100'), '365');
            await fastForward(86400);
            await contracts.metaDefender
                .connect(provider1)
                .signalCertificateProviderExit('0');
            await fastForward(86400);
            await contracts.metaDefender
                .connect(provider1)
                .certificateProviderExit('0');
            await fastForward(380 * 86400);
            const tokenBefore = await contracts.test.quoteToken.balanceOf(
                await provider1.getAddress(),
            );
            await contracts.metaDefender.connect(coverBuyer1).settlePolicy('0');
            await contracts.metaDefender
                .connect(provider1)
                .withdrawAfterExit('0');
            const tokenAfter = await contracts.test.quoteToken.balanceOf(
                await provider1.getAddress(),
            );
            // 99901
            expect(tokenBefore).to.be.approximately(
                toBN('99901'),
                toBN(String(99901 * 0.0001)),
            );
            // 100001
            expect(tokenAfter).to.be.approximately(
                toBN('100001'),
                toBN(String(100001 * 0.0001)),
            );
        });
    });

    describe('settle policy', async () => {
        it('should revert if the policyHolder try to settle the policy which is not expired', async () => {
            await seedTestSystem(deployer, contracts, 100000, [
                provider1,
                provider2,
                coverBuyer1,
            ]);
            await contracts.metaDefender
                .connect(provider1)
                .certificateProviderEntrance(toBN('10100'));
            await fastForward(86400);
            await contracts.metaDefender
                .connect(coverBuyer1)
                .buyPolicy(await coverBuyer1.getAddress(), toBN('100'), '365');
            await fastForward(86400 * 364);
            await expect(
                contracts.metaDefender.connect(coverBuyer1).settlePolicy('0'),
            ).to.be.revertedWith('policy is not expired');
        });
        it('should revert if one try to settle others policy within 3 days', async () => {
            await seedTestSystem(deployer, contracts, 100000, [
                provider1,
                provider2,
                coverBuyer1,
            ]);
            await contracts.metaDefender
                .connect(provider1)
                .certificateProviderEntrance(toBN('10100'));
            await fastForward(86400);
            await contracts.metaDefender
                .connect(coverBuyer1)
                .buyPolicy(await coverBuyer1.getAddress(), toBN('100'), '365');
            await fastForward(86400 * 366);
            expect(
                await contracts.metaDefender
                    .connect(coverBuyer2)
                    .settlePolicy('0'),
            ).to.be.revertedWith(
                'Only policy holder can settle the policy in 3 days',
            );
        });
        it('will successfully cancel the policy in 3 days', async () => {
            await seedTestSystem(deployer, contracts, 100000, [
                provider1,
                coverBuyer1,
            ]);
            await contracts.metaDefender
                .connect(provider1)
                .certificateProviderEntrance(toBN('10100'));
            await fastForward(86400);
            await contracts.metaDefender
                .connect(coverBuyer1)
                .buyPolicy(await coverBuyer1.getAddress(), toBN('100'), '365');
            // after 90 day and a half
            await fastForward(366 * 86400);
            await contracts.metaDefender.connect(coverBuyer1).settlePolicy('0');
            // 100000 - 1 - 0.05 - 0.05 + 0.05 = 99998.95
            expect(
                await contracts.test.quoteToken.balanceOf(
                    await coverBuyer1.getAddress(),
                ),
            ).to.be.equal(toBN('99998.95'));
        });
        it('will successfully cancel the policy after one day by another', async () => {
            await seedTestSystem(deployer, contracts, 100000, [
                provider1,
                provider2,
                coverBuyer1,
            ]);
            await contracts.metaDefender
                .connect(provider1)
                .certificateProviderEntrance(toBN('10100'));
            await fastForward(86400);
            await contracts.metaDefender
                .connect(coverBuyer1)
                .buyPolicy(await coverBuyer1.getAddress(), toBN('100'), '365');
            await fastForward(86400 * 370);
            await contracts.metaDefender.connect(coverBuyer2).settlePolicy('0');
            expect(
                await contracts.test.quoteToken.balanceOf(
                    await coverBuyer2.getAddress(),
                ),
            ).to.be.equal(toBN('0.05'));
        });
        it('will revert if the policy is already cancelled', async () => {
            await seedTestSystem(deployer, contracts, 100000, [
                provider1,
                provider2,
                coverBuyer1,
            ]);
            await contracts.metaDefender
                .connect(provider1)
                .certificateProviderEntrance(toBN('10100'));
            await fastForward(86400);
            await contracts.metaDefender
                .connect(coverBuyer1)
                .buyPolicy(await coverBuyer1.getAddress(), toBN('100'), '365');
            await fastForward(86400 * 370);
            await contracts.metaDefender.connect(coverBuyer2).settlePolicy('0');
            expect(
                await contracts.test.quoteToken.balanceOf(
                    await coverBuyer2.getAddress(),
                ),
            ).to.be.equal(toBN('0.05'));
            await expect(
                contracts.metaDefender.connect(coverBuyer2).settlePolicy('0'),
            ).to.be.revertedWith('policy is already cancelled');
        });
    });

    describe('mine', async () => {
        it('will revert if msg.sender is not the owner', async () => {
            await seedTestSystem(deployer, contracts, 100000, [provider1]);
            await expect(
                contracts.metaDefender.connect(provider1).mine(0, ZERO_ADDRESS),
            ).to.be.revertedWithCustomError(
                contracts.metaDefender,
                'InsufficientPrivilege',
            );
        });
        it('will revert if the address is ZEOR_ADDRESS', async () => {
            await seedTestSystem(deployer, contracts, 100000, [provider1]);
            await expect(
                contracts.metaDefender.mine(0, ZERO_ADDRESS),
            ).to.be.revertedWithCustomError(
                contracts.metaDefender,
                'InvalidAddress',
            );
        });
        it('will revert if the mining address is valid', async () => {
            await seedTestSystem(deployer, contracts, 100000, [provider1]);
            await expect(
                contracts.metaDefender.mine(
                    0,
                    '0x0000000000000000000000000000000000000001',
                ),
            ).to.be.revertedWithCustomError(
                contracts.metaDefender,
                'InvalidMiningProxy',
            );
        });
        it('will successfully set the mining address', async () => {
            await seedTestSystem(deployer, contracts, 100000, [provider1]);
            await contracts.metaDefender.certificateProviderEntrance(
                toBN('10100'),
            );
            // set the 0x1 as the valid mining address.
            await contracts.metaDefender.validMiningProxyManage(
                MOCK_MINING_ADDRESS,
                true,
            );
            await contracts.metaDefender.mine(toBN('1'), MOCK_MINING_ADDRESS);
            expect(
                await contracts.test.quoteToken.balanceOf(MOCK_MINING_ADDRESS),
            ).to.be.equal(toBN('1'));
        });
    });

    describe('validMiningProxyManage', async () => {
        it('will revert if msg.sender is not the owner', async () => {
            await expect(
                contracts.metaDefender
                    .connect(provider1)
                    .validMiningProxyManage(ZERO_ADDRESS, true),
            ).to.be.revertedWithCustomError(
                contracts.metaDefender,
                'InsufficientPrivilege',
            );
        });
        it('will successfully change the proxy status', async () => {
            expect(
                await contracts.metaDefender.validMiningProxy(ZERO_ADDRESS),
            ).to.be.equal(false);
            await contracts.metaDefender.validMiningProxyManage(
                MOCK_PROXY_ADDRESS,
                true,
            );
            expect(
                await contracts.metaDefender.validMiningProxy(
                    MOCK_PROXY_ADDRESS,
                ),
            ).to.be.equal(true);
        });
    });
});
