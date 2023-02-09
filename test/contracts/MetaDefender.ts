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
import { americanBinaryOptions } from '../utils/americanBinaryOptions';

describe('MetaDefender - uint tests', async () => {
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
                contracts.metaDefender.init(
                    ZERO_ADDRESS,
                    ZERO_ADDRESS,
                    ZERO_ADDRESS,
                    ZERO_ADDRESS,
                    ZERO_ADDRESS,
                    ZERO_ADDRESS,
                    ZERO_ADDRESS,
                    ZERO_ADDRESS,
                    toBN('0.1'),
                    toBN('0.0'),
                    toBN('100'),
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

    describe('update standardRisk', async () => {
        it('should not allow update when the msg.sender is not the official', async () => {
            await expect(
                contracts.metaDefender
                    .connect(provider1)
                    .updateStandardRisk(toBN('100')),
            ).to.be.revertedWithCustomError(
                contracts.metaDefender,
                'InsufficientPrivilege',
            );
        });
        it('should update the standardRisk successfully', async () => {
            await contracts.metaDefender
                .connect(deployer)
                .updateStandardRisk(toBN('110'));
            const globalInfo = await contracts.metaDefender.getGlobalInfo();
            expect(globalInfo.standardRisk).to.be.equal(toBN('110'));
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
            await seedTestSystem(deployer, contracts, 20000, [provider1]);
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
            await seedTestSystem(deployer, contracts, 20000, [
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
            ).to.be.equal(toBN('10000'));
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

    describe('buyPolicy', async () => {
        it('will fail to buy a policy due to coverage too large', async () => {
            // first we deposit some capital into the pool
            await seedTestSystem(deployer, contracts, 20000, [
                provider1,
                coverBuyer1,
            ]);
            await contracts.metaDefender
                .connect(provider1)
                .certificateProviderEntrance(toBN('11000'));

            await fastForward(86400);

            await expect(
                contracts.metaDefender
                    .connect(coverBuyer1)
                    .buyPolicy(
                        await coverBuyer1.getAddress(),
                        toBN('1000000'),
                        '365',
                    ),
            ).to.be.revertedWithCustomError(
                contracts.metaDefender,
                'CoverageTooLarge',
            );
        });
        it('will successfully buy a policy', async () => {
            // first we deposit some capital into the pool
            await seedTestSystem(deployer, contracts, 20000, [
                provider1,
                coverBuyer1,
            ]);
            await contracts.metaDefender
                .connect(provider1)
                .certificateProviderEntrance(toBN('11000'));

            await fastForward(86400);

            await contracts.metaDefender
                .connect(coverBuyer1)
                .buyPolicy(await coverBuyer1.getAddress(), toBN('1000'), '365');

            // check the policy
            expect(await contracts.policy.belongsTo('0')).to.be.equal(
                await coverBuyer1.getAddress(),
            );
            const policy = await contracts.policy.getPolicyInfo('0');
            expect(policy.beneficiary).to.be.equal(
                await coverBuyer1.getAddress(),
            );
            expect(policy.coverage).to.be.equal(toBN('1000'));
            const premium = americanBinaryOptions(
                tAnnualised,
                initialRisk + (1000 / standardRisk) * 0.01,
                spotPrice,
                strikePrice,
                freeRate,
            );
            expect(policy.fee).to.be.equal(toBN('10'));
            expect(policy.enteredEpochIndex).to.be.equal('2');
            expect(policy.duration).to.be.equal('365');
            expect(policy.SPS).to.approximately(
                toBN(String(1000 / 11000)),
                toBN(String((1000 / 11000) * 0.0001)),
            );
            expect(
                await contracts.test.quoteToken.balanceOf(
                    await coverBuyer1.getAddress(),
                ),
            ).to.approximately(
                toBN(String(20000 - 10 - premium)),
                toBN(String((20000 - 10 - premium) * 0.001)),
            );
        });
    });

    describe('get real/loss liquidity', async () => {
        it('should revert if the liquidity is invalid', async () => {
            await seedTestSystem(deployer, contracts, 20000, [provider1]);
            await contracts.metaDefender
                .connect(provider1)
                .certificateProviderEntrance(toBN('10000'));
            await fastForward(86400);
            await contracts.metaDefender
                .connect(provider1)
                .certificateProviderExit('0', false);
            await expect(
                contracts.metaDefender.getRealAndLostLiquidityByCertificateId(
                    '0',
                ),
            ).to.be.revertedWithCustomError(
                contracts.metaDefender,
                'CertificateExit',
            );
        });
    });

    describe('certificateProvider exit', async () => {
        it('should revert if the certificate is invalid', async () => {
            await fastForward(86400);
            await expect(
                contracts.metaDefender.certificateProviderExit('7777', false),
            ).to.be.revertedWith('ERC721: invalid token ID');
        });
        it('should revert if the certificate not belongs to the msg.sender', async () => {
            await seedTestSystem(deployer, contracts, 20000, [
                provider1,
                provider2,
                coverBuyer1,
            ]);
            await contracts.metaDefender
                .connect(provider1)
                .certificateProviderEntrance(toBN('11000'));
            await fastForward(86400);
            await expect(
                contracts.metaDefender
                    .connect(provider2)
                    .certificateProviderExit('0', false),
            ).to.be.revertedWithCustomError(
                contracts.metaDefender,
                'InsufficientPrivilege',
            );
        });
        it('should get the liquidity back except the locked value', async () => {
            await seedTestSystem(deployer, contracts, 20000, [
                provider1,
                provider2,
                coverBuyer1,
            ]);
            await contracts.metaDefender
                .connect(provider1)
                .certificateProviderEntrance(toBN('11000'));
            await fastForward(86400);
            await contracts.metaDefender
                .connect(coverBuyer1)
                .buyPolicy(await coverBuyer1.getAddress(), toBN('1000'), '365');
            await fastForward(86400);
            await contracts.metaDefender
                .connect(provider1)
                .certificateProviderExit('0', false);
            const premium = americanBinaryOptions(
                tAnnualised,
                initialRisk + (1000 / standardRisk) * 0.01,
                spotPrice,
                strikePrice,
                freeRate,
            );
            // reward = premium, locked = 1000, fee = (11000 - 1000) * 0.003 = 30,  balance = 20000 - 11000 + 10000 - 30 + premium = 18970 + premium
            expect(
                await contracts.test.quoteToken.balanceOf(
                    await provider1.getAddress(),
                ),
            ).to.approximately(
                toBN(String(18970 + premium)),
                toBN(String((18970 + premium) * 0.0001)),
            );
            await fastForward(86400 * 365);
        });
        it('should get the error if one withdraw just after buying the policy', async () => {
            // ----P1----0:00----B1----B2----W1
            await seedTestSystem(deployer, contracts, 20000, [
                provider1,
                coverBuyer1,
                coverBuyer2,
            ]);
            await contracts.metaDefender
                .connect(provider1)
                .certificateProviderEntrance(toBN('10000'));
            await fastForward(86400);
            await contracts.metaDefender.epochCheck();
            await contracts.metaDefender
                .connect(coverBuyer1)
                .buyPolicy(await coverBuyer1.getAddress(), toBN('1000'), '365');
            const res = await contracts.metaDefender
                .connect(provider1)
                .getSPSLockedByCertificateId('0');
            expect(res[0]).to.be.equal(toBN('0.1'));
            expect(res[1]).to.be.equal(toBN('9000'));
            // if now the provider1 withdraw, he will get what he exactly put in.
            await contracts.metaDefender
                .connect(provider1)
                .certificateProviderExit('0', false);
            expect(
                await contracts.test.quoteToken.balanceOf(
                    await provider1.getAddress(),
                ),
            ).to.approximately(toBN('18973'), toBN('1'));
        });
    });

    describe('get rewards', async () => {
        it('will return 0 rewards when enter epoch == exit epoch', async () => {
            await seedTestSystem(deployer, contracts, 20000, [
                provider1,
                provider2,
                coverBuyer1,
            ]);
            await contracts.metaDefender
                .connect(provider1)
                .certificateProviderEntrance(toBN('11000'));
            await fastForward(86400);
            await contracts.metaDefender
                .connect(provider2)
                .certificateProviderEntrance(toBN('1000'));
            await contracts.metaDefender
                .connect(provider2)
                .certificateProviderExit('1', false);
            const rewards = await contracts.metaDefender.getRewards('1', false);
            expect(rewards).to.be.equal(toBN('0'));
        });
        it('will return 0 rewards when the certificate is expired', async () => {
            await seedTestSystem(deployer, contracts, 20000, [
                provider1,
                coverBuyer1,
            ]);
            await contracts.metaDefender
                .connect(provider1)
                .certificateProviderEntrance(toBN('11000'));
            await fastForward(86400);
            await contracts.metaDefender.epochCheck();
            await contracts.metaDefender
                .connect(provider1)
                .certificateProviderExit('0', false);
            const rewards = await contracts.metaDefender.getRewards('0', false);
            expect(rewards).to.be.equal(toBN('0'));
        });
    });

    describe('claim rewards', async () => {
        it('will revert if certificateId does not exist', async () => {
            await expect(
                contracts.metaDefender.claimRewards('7777'),
            ).to.be.revertedWith('ERC721: invalid token ID');
        });
        it('will revert if not the provider owner', async () => {
            await seedTestSystem(deployer, contracts, 20000, [
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
            await seedTestSystem(deployer, contracts, 20000, [
                provider1,
                coverBuyer1,
            ]);
            // provider asset
            await contracts.metaDefender
                .connect(provider1)
                .certificateProviderEntrance(toBN('11000'));
            await fastForward(86400);
            // buy cover
            await contracts.metaDefender
                .connect(coverBuyer1)
                .buyPolicy(await coverBuyer1.getAddress(), toBN('1000'), '365');
            await fastForward(86400);
            // in this case provider's reward = 1
            await contracts.metaDefender.connect(provider1).claimRewards('0');
            // provider's balance = 20000 - 11000 + premium = 9000 + premium
            const premium = americanBinaryOptions(
                tAnnualised,
                initialRisk + (1000 / standardRisk) * 0.01,
                spotPrice,
                strikePrice,
                freeRate,
            );
            expect(
                await contracts.test.quoteToken.balanceOf(
                    await provider1.getAddress(),
                ),
            ).to.approximately(
                toBN(String(9000 + premium)),
                toBN(String((9000 + premium) * 0.0001)),
            );
        });

        it('will claim revert if the rewars is 0', async () => {
            await seedTestSystem(deployer, contracts, 20000, [
                provider1,
                coverBuyer1,
            ]);
            // provider asset
            await contracts.metaDefender
                .connect(provider1)
                .certificateProviderEntrance(toBN('11000'));
            await fastForward(86400);
            // buy cover
            await contracts.metaDefender
                .connect(coverBuyer1)
                .buyPolicy(await coverBuyer1.getAddress(), toBN('1000'), '365');
            await fastForward(86400);
            // in this case provider's reward = 1
            await contracts.metaDefender.connect(provider1).claimRewards('0');
            await expect(
                contracts.metaDefender.connect(provider1).claimRewards('0'),
            ).to.be.revertedWithCustomError(
                contracts.metaDefender,
                'NoRewards',
            );
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
            // in this case, the team will get nothing.
            await seedTestSystem(deployer, contracts, 20000, [
                provider1,
                coverBuyer1,
            ]);
            await contracts.metaDefender
                .connect(provider1)
                .certificateProviderEntrance(toBN('11000'));
            await fastForward(86400);
            await contracts.metaDefender
                .connect(coverBuyer1)
                .buyPolicy(await coverBuyer1.getAddress(), toBN('1000'), '365');
            await contracts.metaDefender.connect(deployer).teamClaim();
            expect(
                await contracts.test.quoteToken.balanceOf(
                    await deployer.getAddress(),
                ),
            ).to.be.equal(toBN('20000'));
        });
    });

    describe('policy claim apply', async () => {
        it('should revert if the policy is expired', async () => {
            await seedTestSystem(deployer, contracts, 20000, [
                provider1,
                coverBuyer1,
            ]);
            await contracts.metaDefender
                .connect(provider1)
                .certificateProviderEntrance(toBN('11000'));
            await fastForward(86400);
            await contracts.metaDefender
                .connect(coverBuyer1)
                .buyPolicy(await coverBuyer1.getAddress(), toBN('1000'), '365');
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
            await seedTestSystem(deployer, contracts, 20000, [
                provider1,
                coverBuyer1,
            ]);
            await contracts.metaDefender
                .connect(provider1)
                .certificateProviderEntrance(toBN('11000'));
            await fastForward(86400);
            await contracts.metaDefender
                .connect(coverBuyer1)
                .buyPolicy(await coverBuyer1.getAddress(), toBN('1000'), '365');
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
            await seedTestSystem(deployer, contracts, 20000, [
                provider1,
                coverBuyer1,
            ]);
            await contracts.metaDefender
                .connect(provider1)
                .certificateProviderEntrance(toBN('11000'));
            await fastForward(86400);
            await contracts.metaDefender
                .connect(coverBuyer1)
                .buyPolicy(await coverBuyer1.getAddress(), toBN('1000'), '365');
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
            await seedTestSystem(deployer, contracts, 20000, [
                provider1,
                coverBuyer1,
            ]);
            await contracts.mockRiskReserve.mockMint(toBN('10000'));
            await contracts.metaDefender
                .connect(provider1)
                .certificateProviderEntrance(toBN('11000'));
            await fastForward(86400);
            await contracts.metaDefender
                .connect(coverBuyer1)
                .buyPolicy(await coverBuyer1.getAddress(), toBN('1000'), '365');
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
            await seedTestSystem(deployer, contracts, 20000, [
                provider1,
                coverBuyer1,
            ]);
            await contracts.metaDefender
                .connect(provider1)
                .certificateProviderEntrance(toBN('11000'));
            await fastForward(86400);
            await contracts.metaDefender
                .connect(coverBuyer1)
                .buyPolicy(await coverBuyer1.getAddress(), toBN('1000'), '365');
            await expect(
                contracts.metaDefender.connect(deployer).refuseApply('0'),
            ).to.be.revertedWithCustomError(
                contracts.metaDefender,
                'ClaimNotUnderProcessing',
            );
        });
        it('should successfully refuse the claim apply', async () => {
            await seedTestSystem(deployer, contracts, 20000, [
                provider1,
                coverBuyer1,
            ]);
            await contracts.metaDefender
                .connect(provider1)
                .certificateProviderEntrance(toBN('11000'));
            await fastForward(86400);
            await contracts.metaDefender
                .connect(coverBuyer1)
                .buyPolicy(await coverBuyer1.getAddress(), toBN('1000'), '365');
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
            await seedTestSystem(deployer, contracts, 20000, [
                provider1,
                coverBuyer1,
            ]);
            await contracts.metaDefender
                .connect(provider1)
                .certificateProviderEntrance(toBN('11000'));
            await fastForward(86400);
            await contracts.metaDefender
                .connect(coverBuyer1)
                .buyPolicy(await coverBuyer1.getAddress(), toBN('1000'), '365');
            await expect(
                contracts.metaDefender.connect(deployer).approveApply('0'),
            ).to.be.revertedWithCustomError(
                contracts.metaDefender,
                'ClaimNotUnderProcessing',
            );
        });
        it('should pay exact the coverage when there are enough funds in risk reserve contract', async () => {
            await seedTestSystem(deployer, contracts, 20000, [
                provider1,
                coverBuyer1,
            ]);
            await contracts.mockRiskReserve.mockMint(toBN('10000'));
            await contracts.metaDefender
                .connect(provider1)
                .certificateProviderEntrance(toBN('11000'));
            await fastForward(86400);
            await contracts.metaDefender
                .connect(coverBuyer1)
                .buyPolicy(await coverBuyer1.getAddress(), toBN('1000'), '365');
            await contracts.metaDefender
                .connect(coverBuyer1)
                .policyClaimApply('0');
            await contracts.metaDefender.connect(deployer).approveApply('0');
            const premium = americanBinaryOptions(
                tAnnualised,
                initialRisk + (1000 / standardRisk) * 0.01,
                spotPrice,
                strikePrice,
                freeRate,
            );
            // coverBuyer1 should get 1000 tokens: 20000 - premium - 10 + 1000 + 10 = 21000 - premium
            expect(
                await contracts.test.quoteToken.balanceOf(
                    await coverBuyer1.getAddress(),
                ),
            ).to.approximately(
                toBN(String(21000 - premium)),
                toBN(String((21000 - premium) * 0.001)),
            );
            expect(
                await contracts.test.quoteToken.balanceOf(
                    contracts.mockRiskReserve.address,
                ),
            ).to.be.equal(toBN('9000'));
        });
        it('should pay exact the coverage and not change the accSPS when there are not enough funds in the risk reserve contract', async () => {
            await seedTestSystem(deployer, contracts, 20000, [
                provider1,
                provider2,
                coverBuyer1,
            ]);
            await contracts.mockRiskReserve.mockMint(toBN('50'));
            await contracts.metaDefender
                .connect(provider1)
                .certificateProviderEntrance(toBN('11000'));
            await fastForward(86400);
            await contracts.metaDefender
                .connect(coverBuyer1)
                .buyPolicy(await coverBuyer1.getAddress(), toBN('1000'), '365');
            const globalInfoBefore =
                await contracts.metaDefender.getGlobalInfo();
            await contracts.metaDefender
                .connect(coverBuyer1)
                .policyClaimApply('0');
            await contracts.metaDefender.connect(deployer).approveApply('0');
            // coverBuyer1 should get 1000 tokens and all these tokens will be paid from the pool.
            // 20000 - premium - 10 + 1000 + 10 = 21000 - premium
            const premium = americanBinaryOptions(
                tAnnualised,
                initialRisk + (1000 / standardRisk) * 0.01,
                spotPrice,
                strikePrice,
                freeRate,
            );
            expect(
                await contracts.test.quoteToken.balanceOf(
                    await coverBuyer1.getAddress(),
                ),
            ).to.be.approximately(
                toBN(String(21000 - premium)),
                toBN(String((21000 - premium) * 0.001)),
            );
            expect(
                await contracts.test.quoteToken.balanceOf(
                    contracts.mockRiskReserve.address,
                ),
            ).to.be.equal(toBN('50'));
            // 11000 + premium + 10 - 1000 - 10 = 10000 + premium
            expect(
                await contracts.test.quoteToken.balanceOf(
                    contracts.metaDefender.address,
                ),
            ).to.approximately(
                toBN(String(10000 + premium)),
                toBN(String((10000 + premium) * 0.001)),
            );
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
            ).to.be.revertedWith('certificate does not exist');
        });
        it('should revert if the certificateId is not belong to the msg.sender', async () => {
            await seedTestSystem(deployer, contracts, 20000, [
                provider1,
                provider2,
                coverBuyer1,
            ]);
            await contracts.metaDefender
                .connect(provider1)
                .certificateProviderEntrance(toBN('11000'));
            await fastForward(86400);
            await contracts.metaDefender
                .connect(coverBuyer1)
                .buyPolicy(await coverBuyer1.getAddress(), toBN('1000'), '365');
            await fastForward(86400);
            await contracts.metaDefender
                .connect(provider1)
                .certificateProviderExit('0', false);
            await expect(
                contracts.metaDefender
                    .connect(coverBuyer1)
                    .withdrawAfterExit('0'),
            ).to.be.revertedWithCustomError(
                contracts.metaDefender,
                'InsufficientPrivilege',
            );
        });
        it('should revert if the certificateId is not expired', async () => {
            await seedTestSystem(deployer, contracts, 20000, [
                provider1,
                coverBuyer1,
            ]);
            await contracts.metaDefender
                .connect(provider1)
                .certificateProviderEntrance(toBN('11000'));
            await fastForward(86400);
            await contracts.metaDefender
                .connect(coverBuyer1)
                .buyPolicy(await coverBuyer1.getAddress(), toBN('1000'), '365');
            await fastForward(86400);
            await expect(
                contracts.metaDefender
                    .connect(provider1)
                    .withdrawAfterExit('0'),
            ).to.be.revertedWithCustomError(
                contracts.metaDefender,
                'CertificateNotExit',
            );
        });
        it('should successfully get withdraw after exit from the pool', async () => {
            await seedTestSystem(deployer, contracts, 20000, [
                provider1,
                provider2,
                coverBuyer1,
            ]);
            await contracts.metaDefender
                .connect(provider1)
                .certificateProviderEntrance(toBN('11000'));
            await fastForward(86400);
            await contracts.metaDefender
                .connect(coverBuyer1)
                .buyPolicy(await coverBuyer1.getAddress(), toBN('1000'), '365');
            await fastForward(86400);
            await contracts.metaDefender
                .connect(provider1)
                .certificateProviderExit('0', false);
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
            const premium = americanBinaryOptions(
                tAnnualised,
                initialRisk + (1000 / standardRisk) * 0.01,
                spotPrice,
                strikePrice,
                freeRate,
            );
            //fee = 10000 * 0.003 = 30;  20000 - 11000 + 10000 - 30 + premium = 18970 + premium
            expect(tokenBefore).to.be.approximately(
                toBN(String(18970 + premium)),
                toBN(String((18970 + premium) * 0.001)),
            );
            // 1000 * 0.997 = 997
            expect(tokenAfter).to.be.approximately(
                toBN(String(19967 + premium)),
                toBN(String((19967 + premium) * 0.001)),
            );
        });
    });

    describe('settle policy', async () => {
        it('should revert if the policyHolder try to settle the policy which is not expired', async () => {
            await seedTestSystem(deployer, contracts, 20000, [
                provider1,
                provider2,
                coverBuyer1,
            ]);
            await contracts.metaDefender
                .connect(provider1)
                .certificateProviderEntrance(toBN('11000'));
            await fastForward(86400);
            await contracts.metaDefender
                .connect(coverBuyer1)
                .buyPolicy(await coverBuyer1.getAddress(), toBN('1000'), '365');
            await fastForward(86400 * 350);
            await expect(
                contracts.metaDefender.connect(coverBuyer1).settlePolicy('0'),
            ).to.be.revertedWith('policy is not expired');
        });
        it('should revert if one try to settle others policy within 3 days', async () => {
            await seedTestSystem(deployer, contracts, 20000, [
                provider1,
                provider2,
                coverBuyer1,
            ]);
            await contracts.metaDefender
                .connect(provider1)
                .certificateProviderEntrance(toBN('11000'));
            await fastForward(86400);
            await contracts.metaDefender
                .connect(coverBuyer1)
                .buyPolicy(await coverBuyer1.getAddress(), toBN('1000'), '365');
            await fastForward(86400 * 366);
            await expect(
                contracts.metaDefender.connect(coverBuyer2).settlePolicy('0'),
            ).to.be.revertedWith(
                'Only policy holder can settle the policy in 3 days',
            );
        });
        it('should successfully settle his own policy in 3 days', async () => {
            await seedTestSystem(deployer, contracts, 20000, [
                provider1,
                provider2,
                coverBuyer1,
            ]);
            await contracts.metaDefender
                .connect(provider1)
                .certificateProviderEntrance(toBN('11000'));
            await fastForward(86400);
            await contracts.metaDefender
                .connect(coverBuyer1)
                .buyPolicy(await coverBuyer1.getAddress(), toBN('1000'), '365');
            await fastForward(86400 * 366);
            const settleBefore = await contracts.test.quoteToken.balanceOf(
                await coverBuyer1.getAddress(),
            );
            await contracts.metaDefender.connect(coverBuyer1).settlePolicy('0');
            const settleAfter = await contracts.test.quoteToken.balanceOf(
                await coverBuyer1.getAddress(),
            );
            expect(settleAfter.sub(settleBefore)).to.be.equal(toBN('10'));
        });
        it('will successfully cancel the policy in 3 days', async () => {
            await seedTestSystem(deployer, contracts, 20000, [
                provider1,
                coverBuyer1,
            ]);
            await contracts.metaDefender
                .connect(provider1)
                .certificateProviderEntrance(toBN('11000'));
            await fastForward(86400);
            await contracts.metaDefender
                .connect(coverBuyer1)
                .buyPolicy(await coverBuyer1.getAddress(), toBN('1000'), '365');
            // after 90 day and a half
            await fastForward(86400 * 365);
            await fastForward(86400);
            await contracts.metaDefender.connect(coverBuyer1).settlePolicy('0');
            // 20000 - premium - 10 + 10 = 20000 - premium
            const premium = americanBinaryOptions(
                tAnnualised,
                initialRisk + (1000 / standardRisk) * 0.01,
                spotPrice,
                strikePrice,
                freeRate,
            );
            expect(
                await contracts.test.quoteToken.balanceOf(
                    await coverBuyer1.getAddress(),
                ),
            ).to.approximately(
                toBN(String(20000 - premium)),
                toBN(String((20000 - premium) * 0.001)),
            );
        });
        it('will successfully cancel the policy after one day by another', async () => {
            await seedTestSystem(deployer, contracts, 20000, [
                provider1,
                provider2,
                coverBuyer1,
            ]);
            await contracts.metaDefender
                .connect(provider1)
                .certificateProviderEntrance(toBN('11000'));
            await fastForward(86400);
            await contracts.metaDefender
                .connect(coverBuyer1)
                .buyPolicy(await coverBuyer1.getAddress(), toBN('1000'), '365');
            await fastForward(86400 * 370);
            await contracts.metaDefender.connect(coverBuyer2).settlePolicy('0');
            expect(
                await contracts.test.quoteToken.balanceOf(
                    await coverBuyer2.getAddress(),
                ),
            ).to.be.equal(toBN('10'));
        });
        it('will revert if the policy is already cancelled', async () => {
            await seedTestSystem(deployer, contracts, 20000, [
                provider1,
                provider2,
                coverBuyer1,
            ]);
            await contracts.metaDefender
                .connect(provider1)
                .certificateProviderEntrance(toBN('11000'));
            await fastForward(86400);
            await contracts.metaDefender
                .connect(coverBuyer1)
                .buyPolicy(await coverBuyer1.getAddress(), toBN('1000'), '365');
            await fastForward(86400 * 370);
            await contracts.metaDefender.connect(coverBuyer2).settlePolicy('0');
            expect(
                await contracts.test.quoteToken.balanceOf(
                    await coverBuyer2.getAddress(),
                ),
            ).to.be.equal(toBN('10'));
            await expect(
                contracts.metaDefender.connect(coverBuyer2).settlePolicy('0'),
            ).to.be.revertedWith('policy is already cancelled');
        });
    });

    describe('mine', async () => {
        it('will revert if msg.sender is not the owner', async () => {
            await seedTestSystem(deployer, contracts, 20000, [provider1]);
            await expect(
                contracts.metaDefender.connect(provider1).mine(0, ZERO_ADDRESS),
            ).to.be.revertedWithCustomError(
                contracts.metaDefender,
                'InsufficientPrivilege',
            );
        });
        it('will revert if the address is ZEOR_ADDRESS', async () => {
            await seedTestSystem(deployer, contracts, 20000, [provider1]);
            await expect(
                contracts.metaDefender.mine(0, ZERO_ADDRESS),
            ).to.be.revertedWithCustomError(
                contracts.metaDefender,
                'InvalidAddress',
            );
        });
        it('will revert if the mining address is valid', async () => {
            await seedTestSystem(deployer, contracts, 20000, [provider1]);
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
            await seedTestSystem(deployer, contracts, 20000, [provider1]);
            await contracts.metaDefender.certificateProviderEntrance(
                toBN('11000'),
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
