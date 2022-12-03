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
import { seedTestSystem } from '../utils/seedTestSystem';
import { expect } from 'chai';
import { exp } from 'mathjs';

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
        // we will design an initial state for the system.
        // -------P1-----0:00------B1------P2-----0:00------B2---------
        // in this scenario
        // 1) P1 and P2 are providers, B1 and B2 are cover buyers.
        // 2) P1 covers B1 and B2 while P2 covers B2 only.
        await seedTestSystem(deployer, contracts, 100000, [
            provider1,
            provider2,
            coverBuyer1,
            coverBuyer2,
        ]);
        // P1 enters the market
        await contracts.metaDefender
            .connect(provider1)
            .certificateProviderEntrance(toBN('10000'));
        // pass the 0:00
        await fastForward(86400);
        // B1 buys a cover
        await contracts.metaDefender
            .connect(coverBuyer1)
            .buyPolicy(await coverBuyer1.getAddress(), toBN('100'), '365');
        // P2 enters the market
        await contracts.metaDefender
            .connect(provider2)
            .certificateProviderEntrance(toBN('40000'));
        // pass the 0:00
        await fastForward(86400);
        // B2 buys a cover
        await contracts.metaDefender
            .connect(coverBuyer2)
            .buyPolicy(await coverBuyer2.getAddress(), toBN('100'), '365');
        snapshotId = await takeSnapshot();
    });

    beforeEach(async function () {
        await restoreSnapshot(snapshotId);
        snapshotId = await takeSnapshot();
    });

    describe('rewards/shadow check', async () => {
        // we will design an initial state for the system.
        // -(0:00)------P1-----0:00-----B1-----P2-----0:00-----B2---------
        //                                                            |  |
        //                                                            R(1)=Premium(1)+Premium(2)*P1/(P1+P2) = 1+1/, R(2)=Premium(2) * P2/(P1+P2)
        // epoch        1(0,0)        2(1,100)                 3(2,200)
        it('should get the rewards correctly', async () => {
            const tokenBefore1 = await contracts.test.quoteToken.balanceOf(
                await provider1.getAddress(),
            );
            const tokenBefore2 = await contracts.test.quoteToken.balanceOf(
                await provider2.getAddress(),
            );
            await contracts.metaDefender.connect(provider1).claimRewards('0');
            await contracts.metaDefender.connect(provider2).claimRewards('1');
            const tokenAfter1 = await contracts.test.quoteToken.balanceOf(
                await provider1.getAddress(),
            );
            const tokenAfter2 = await contracts.test.quoteToken.balanceOf(
                await provider2.getAddress(),
            );
            expect(tokenAfter1.sub(tokenBefore1)).to.be.equal(toBN('1.2'));
            expect(tokenAfter2.sub(tokenBefore2)).to.be.equal(toBN('0.8'));
        });
        it('should get the shadow correctly', async () => {
            // In certificate0, there are B1 and B2 locked, SPS = 100/10000 + 100/50000 = 0.0012
            expect(
                await contracts.metaDefender.getSPSLockedByCertificateId('0'),
            ).to.be.equal(toBN('0.012'));
            // In certificate1, there are B2 locked, SPS = 100/50000 = 0.0002
            expect(
                await contracts.metaDefender.getSPSLockedByCertificateId('1'),
            ).to.be.equal(toBN('0.002'));
        });
    });

    describe('settlement', async () => {
        it('should calculate the SPS correctly after settle policy1', async () => {
            // we will design an initial state for the system.
            // -(0:00)------P1-----0:00-----B1-----P2-----0:00-----B2----(.. long time passed)-----S1---------
            //                                                                                         |   |
            //                                                                                        S(1)=S(2)=100/50000=0.002
            // epoch        1               2                                                      3
            await fastForward(86400 * 380);
            await contracts.metaDefender.settlePolicy('0');
            expect(
                await contracts.metaDefender.getSPSLockedByCertificateId('0'),
            ).to.be.equal(toBN('0.002'));
            expect(
                await contracts.metaDefender.getSPSLockedByCertificateId('1'),
            ).to.be.equal(toBN('0.002'));
        });
        it('should calculate the SPS correctly after settle policy2', async () => {
            // we will design an initial state for the system.
            // -(0:00)------P1-----0:00-----B1-----P2-----0:00-----B2----(.. long time passed)-----S2------------
            //                                                                                         |   |
            //                                                                                        S(1)=100/10000=0.01 S(2)=0
            // epoch        1               2                                                      3
            await fastForward(86400 * 380);
            await contracts.metaDefender.settlePolicy('1');
            expect(
                await contracts.metaDefender.getSPSLockedByCertificateId('0'),
            ).to.be.equal(toBN('0.01'));
            expect(
                await contracts.metaDefender.getSPSLockedByCertificateId('1'),
            ).to.be.equal(toBN('0'));
        });
        it('should calculate the SPS correctly after settle policy1 and policy2', async () => {
            // we will design an initial state for the system.
            //                                                                                                            S(1)=S(2)=0
            //                      (1: change the liquidity, 2: DO S2, 3: change the accRPS and accSPS)                    |   |
            // -(0:00)------P1-----0:00-----B1-----P2-----0:00-----B2----(.. long time passed)-----S2----------0:00-----S1-----------
            //                                                                                         |   |
            //                                                                                        S(1)=100/10000=0.01 S(2)=0
            // epoch        1               2                                                      3
            await fastForward(86400 * 380);
            await contracts.metaDefender.settlePolicy('1');
            await fastForward(86400);
            await contracts.metaDefender.settlePolicy('0');
            expect(
                await contracts.metaDefender.getSPSLockedByCertificateId('0'),
            ).to.be.equal(toBN('0'));
            expect(
                await contracts.metaDefender.getSPSLockedByCertificateId('1'),
            ).to.be.equal(toBN('0'));
        });

        it('should withdraw correctly, scenario1', async () => {
            // we will design an initial state for the system.
            //
            //                                             (1: change the liquidity, 2: DO S2, 3: change the accRPS and accSPS)
            //                                                                                         |
            // -(0:00)------P1-----0:00-----B1-----P2-----0:00-----B2----(.. long time passed)----|----S2----SW1----SW2-----0:00-----W1-----W2----
            //                                                                                                                       |      |
            //                                                                                                                       W(1)+R=10000-10000*0.01+1+0.2=9901.2 W(2)=40000+0.8=40000.8
            // epoch        1               2                                                          3                     4
            await fastForward(86400 * 380);
            await contracts.metaDefender.settlePolicy('1');
            const tokenBefore1 = await contracts.test.quoteToken.balanceOf(
                await provider1.getAddress(),
            );
            const tokenBefore2 = await contracts.test.quoteToken.balanceOf(
                await provider2.getAddress(),
            );
            await contracts.metaDefender
                .connect(provider1)
                .signalCertificateProviderExit('0');
            await contracts.metaDefender
                .connect(provider2)
                .signalCertificateProviderExit('1');
            await fastForward(86400);
            await contracts.metaDefender
                .connect(provider1)
                .certificateProviderExit('0');
            await contracts.metaDefender
                .connect(provider2)
                .certificateProviderExit('1');
            const tokenAfter1 = await contracts.test.quoteToken.balanceOf(
                await provider1.getAddress(),
            );
            const tokenAfter2 = await contracts.test.quoteToken.balanceOf(
                await provider2.getAddress(),
            );
            expect(tokenAfter1.sub(tokenBefore1)).to.be.equal(toBN('9901.2'));
            expect(tokenAfter2.sub(tokenBefore2)).to.be.equal(toBN('40000.8'));
        });

        it('should withdraw correctly, scenario2', async () => {
            // we will design an initial state for the system.
            //
            //                                             (1: change the liquidity, 2: DO S2, 3: change the accRPS and accSPS)
            //                                                                                         |
            // -(0:00)------P1-----0:00-----B1-----P2-----0:00-----B2----(.. long time passed)----|----S2----SW1----SW2-----0:00-----W1----S1----W2----
            //                                                                                                                       |           |
            //                                                                                                                       W(1)+R=10000-10000*0.01+1+0.2=9901.2 W(2)=40000+0.8=40000.8
            // epoch        1               2                                                          3                     4
            await fastForward(86400 * 380);
            await contracts.metaDefender.settlePolicy('1');
            const tokenBefore1 = await contracts.test.quoteToken.balanceOf(
                await provider1.getAddress(),
            );
            const tokenBefore2 = await contracts.test.quoteToken.balanceOf(
                await provider2.getAddress(),
            );
            await contracts.metaDefender
                .connect(provider1)
                .signalCertificateProviderExit('0');
            await contracts.metaDefender
                .connect(provider2)
                .signalCertificateProviderExit('1');
            await fastForward(86400);
            await contracts.metaDefender
                .connect(provider1)
                .certificateProviderExit('0');
            await contracts.metaDefender.connect(provider1).settlePolicy('0');
            await contracts.metaDefender
                .connect(provider2)
                .certificateProviderExit('1');
            const tokenAfter1 = await contracts.test.quoteToken.balanceOf(
                await provider1.getAddress(),
            );
            const tokenAfter2 = await contracts.test.quoteToken.balanceOf(
                await provider2.getAddress(),
            );
            expect(tokenAfter1.sub(tokenBefore1)).to.be.equal(toBN('9901.25'));
            expect(tokenAfter2.sub(tokenBefore2)).to.be.equal(toBN('40000.8'));
        });
    });
});
