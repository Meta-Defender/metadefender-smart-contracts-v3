import { Signer } from 'ethers';
import { ethers } from 'hardhat';
import { toBN } from '../../scripts/util/web3utils';
import { fastForward, restoreSnapshot, takeSnapshot } from '../utils';
import {
    deployTestSystem,
    TestSystemContractsType,
} from '../utils/deployTestSystem';
import { seedTestSystem } from '../utils/seedTestSystem';
import { expect } from 'chai';
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
        // we will design an initial state for the system.
        // -------P1-----0:00------B1------P2-----0:00------B2---------
        // in this scenario
        // 1) P1 and P2 are providers, B1 and B2 are cover buyers.
        // 2) P1 covers B1 and B2 while P2 covers B2 only.
        await seedTestSystem(deployer, contracts, 50000, [
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
            .buyPolicy(await coverBuyer1.getAddress(), toBN('1000'), '365');
        // P2 enters the market
        await contracts.metaDefender
            .connect(provider2)
            .certificateProviderEntrance(toBN('40000'));
        // pass the 0:00
        await fastForward(86400);
        // B2 buys a cover
        await contracts.metaDefender
            .connect(coverBuyer2)
            .buyPolicy(await coverBuyer2.getAddress(), toBN('1000'), '365');
        snapshotId = await takeSnapshot();
    });

    beforeEach(async function () {
        await restoreSnapshot(snapshotId);
        snapshotId = await takeSnapshot();
    });

    describe('rewards/shadow check', async () => {
        // we will design an initial state for the system.
        // -(0:00)------P1-----0:00-----B1-----P2-----0:00-----B2----0:00-------
        //                                                                  |  |
        //                                                                  R(1)=Premium(1)+Premium(2)*P1/(P1+P2) = 1+1/, R(2)=Premium(2) * P2/(P1+P2)
        // epoch        1(0,0)        2(1,100)                 3(2,200)
        it('should get the rewards correctly', async () => {
            await fastForward(86400);
            await contracts.metaDefender.connect(provider1).epochCheck();
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
            const premium1 = americanBinaryOptions(
                tAnnualised,
                initialRisk + (1000 / standardRisk) * 0.01,
                spotPrice,
                strikePrice,
                freeRate,
            );
            const premium2 = americanBinaryOptions(
                tAnnualised,
                initialRisk +
                    (1000 / standardRisk) * 0.01 +
                    (1000 / standardRisk) * 0.01,
                spotPrice,
                strikePrice,
                freeRate,
            );
            expect(tokenAfter1.sub(tokenBefore1)).to.approximately(
                toBN(String(premium1 + premium2 * 0.2)),
                toBN(String((premium1 + premium2 * 0.2) * 0.001)),
            );
            expect(tokenAfter2.sub(tokenBefore2)).to.approximately(
                toBN(String(premium2 * 0.8)),
                toBN(String(premium2 * 0.8 * 0.001)),
            );
        });
        it('should get the shadow correctly', async () => {
            // In certificate0, there are B1 and B2 locked, SPS = 1000/10000 + 1000/50000 = 0.12
            const sw0 =
                await contracts.metaDefender.getSPSLockedByCertificateId('0');
            expect(sw0[0]).to.be.equal(toBN('0.12'));
            // In certificate1, there are B2 locked, SPS = 1000/5000 = 0.0002
            const sw1 =
                await contracts.metaDefender.getSPSLockedByCertificateId('1');
            expect(sw1[0]).to.be.equal(toBN('0.02'));
        });
    });

    describe('settlement', async () => {
        it('should calculate the SPS correctly after settle policy1', async () => {
            // we will design an initial state for the system.
            // -(0:00)------P1-----0:00-----B1-----P2-----0:00-----B2----(.. long time passed)-----S1---------
            //                                                                                         |   |
            //                                                                                        S(1)=S(2)=1000/50000=0.02
            // epoch        1               2                                                      3
            await fastForward(86400 * 380);
            await contracts.metaDefender.settlePolicy('0');
            const sw0 =
                await contracts.metaDefender.getSPSLockedByCertificateId('0');
            expect(sw0[0]).to.be.equal(toBN('0.02'));
            const sw1 =
                await contracts.metaDefender.getSPSLockedByCertificateId('1');
            expect(sw1[0]).to.be.equal(toBN('0.02'));
        });
        it('should calculate the SPS correctly after settle policy2', async () => {
            // we will design an initial state for the system.
            // -(0:00)------P1-----0:00-----B1-----P2-----0:00-----B2----(.. long time passed)-----S2------------
            //                                                                                         |   |
            //                                                                                        S(1)=100/10000=0.01 S(2)=0
            // epoch        1               2                                                      3
            await fastForward(86400 * 380);
            await contracts.metaDefender.settlePolicy('1');
            const sw0 =
                await contracts.metaDefender.getSPSLockedByCertificateId('0');
            expect(sw0[0]).to.be.equal(toBN('0.1'));
            const sw1 =
                await contracts.metaDefender.getSPSLockedByCertificateId('1');
            expect(sw1[0]).to.be.equal(toBN('0'));
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
            const sw0 =
                await contracts.metaDefender.getSPSLockedByCertificateId('0');
            expect(sw0[0]).to.be.equal(toBN('0'));
            const sw1 =
                await contracts.metaDefender.getSPSLockedByCertificateId('1');
            expect(sw1[0]).to.be.equal(toBN('0'));
        });
        it('should withdraw correctly, scenario1: w1,w2,s1', async () => {
            //                                             (1: change the liquidity, 2: DO S2, 3: change the accRPS and accSPS)
            //                                                                                    |
            // -(0:00)----P1----0:00----B1----P2-----0:00-----B2----(.. long time passed)----|----S2----0:00----W1-----W2----S1
            //                                                                                                         |      |
            //                                                                                                         W(1)+R = (10000-1000) * 0.997 + premium1 + 0.2* premium2 = 9901.2 W(2) = 40000 * 0.997 + 0.80 * premium2 = 39880 + 0.8 * premium2
            // epoch      1             2                     3                                                 4
            await fastForward(86400 * 380);
            await contracts.metaDefender.settlePolicy('1');
            const tokenBefore1 = await contracts.test.quoteToken.balanceOf(
                await provider1.getAddress(),
            );
            const tokenBefore2 = await contracts.test.quoteToken.balanceOf(
                await provider2.getAddress(),
            );
            await fastForward(86400);
            await contracts.metaDefender
                .connect(provider1)
                .certificateProviderExit('0', false);
            await contracts.metaDefender
                .connect(provider2)
                .certificateProviderExit('1', false);
            await fastForward(86400);
            await contracts.metaDefender.settlePolicy('0');
            const tokenAfter1 = await contracts.test.quoteToken.balanceOf(
                await provider1.getAddress(),
            );
            const tokenAfter2 = await contracts.test.quoteToken.balanceOf(
                await provider2.getAddress(),
            );
            const premium1 = americanBinaryOptions(
                tAnnualised,
                initialRisk + (1000 / standardRisk) * 0.01,
                spotPrice,
                strikePrice,
                freeRate,
            );
            const premium2 = americanBinaryOptions(
                tAnnualised,
                initialRisk +
                    (1000 / standardRisk) * 0.01 +
                    (1000 / standardRisk) * 0.01,
                spotPrice,
                strikePrice,
                freeRate,
            );
            expect(tokenAfter1.sub(tokenBefore1)).to.approximately(
                toBN(
                    String((10000 - 1000) * 0.997 + premium1 + 0.2 * premium2),
                ),
                toBN(
                    String(
                        ((10000 - 1000) * 0.997 + premium1 + 0.2 * premium2) *
                            0.001,
                    ),
                ),
            );
            expect(tokenAfter2.sub(tokenBefore2)).to.approximately(
                toBN(String(40000 * 0.997 + 0.8 * premium2)),
                toBN(String((40000 * 0.997 + 0.8 * premium2) * 0.001)),
            );
        });
        it('should withdraw correctly, scenario3: s1,w1,w2', async () => {
            // -(0:00)----P1----0:00----B1----P2----0:00----B2----(.. long time passed)----S2----0:00-----S1----0:00-----W1----W2----
            //                                                                                                           |      |
            //                                                                                                           W(1)+R=10000*0.997+premium1+0.2*premium2 W(2)=40000+0.8*premium
            // epoch      1             2                   3                                             4              5
            await fastForward(86400 * 380);
            await contracts.metaDefender.settlePolicy('1');
            const tokenBefore1 = await contracts.test.quoteToken.balanceOf(
                await provider1.getAddress(),
            );
            const tokenBefore2 = await contracts.test.quoteToken.balanceOf(
                await provider2.getAddress(),
            );
            await fastForward(86400);
            await contracts.metaDefender.settlePolicy('0');
            await fastForward(86400);
            await contracts.metaDefender
                .connect(provider1)
                .certificateProviderExit('0', false);
            await contracts.metaDefender
                .connect(provider2)
                .certificateProviderExit('1', false);
            const tokenAfter1 = await contracts.test.quoteToken.balanceOf(
                await provider1.getAddress(),
            );
            const tokenAfter2 = await contracts.test.quoteToken.balanceOf(
                await provider2.getAddress(),
            );
            const premium1 = americanBinaryOptions(
                tAnnualised,
                initialRisk + (1000 / standardRisk) * 0.01,
                spotPrice,
                strikePrice,
                freeRate,
            );
            const premium2 = americanBinaryOptions(
                tAnnualised,
                initialRisk +
                    (1000 / standardRisk) * 0.01 +
                    (1000 / standardRisk) * 0.01,
                spotPrice,
                strikePrice,
                freeRate,
            );
            expect(tokenAfter1.sub(tokenBefore1)).to.approximately(
                toBN(String(10000 * 0.997 + premium1 + 0.2 * premium2)),
                toBN(
                    String((10000 * 0.997 + premium1 + 0.2 * premium2) * 0.001),
                ),
            );
            expect(tokenAfter2.sub(tokenBefore2)).to.approximately(
                toBN(String(40000 * 0.997 + 0.8 * premium2)),
                toBN(String((40000 * 0.997 + 0.8 * premium2) * 0.001)),
            );
        });
    });
    describe('withdraw after exit', async () => {
        it('should withdraw correctly after exit', async () => {
            //                                             (1: change the liquidity, 2: DO S2, 3: change the accRPS and accSPS)     W(1) = 1000 * 0.997 W(2) = 0
            //                                                                             |                                        |      |
            // -(0:00)----P1----0:00----B1----P2----0:00----B2----(.. long time passed)----S2----0:00----W1----W2----0:00----S1----WA1----WA2----
            //                                                                                           |     |
            //                                                                                           W(1)+R = (10000-1000) * 0.997 + premium1 + 0.2* premium2 = 9901.2 W(2) = 40000 * 0.997 + 0.80 * premium2 = 39880 + 0.8 * premium2
            // epoch      1             2                   3                                    4                   5
            await fastForward(86400 * 380);
            await contracts.metaDefender.settlePolicy('1');
            const tokenBefore1 = await contracts.test.quoteToken.balanceOf(
                await provider1.getAddress(),
            );
            const tokenBefore2 = await contracts.test.quoteToken.balanceOf(
                await provider2.getAddress(),
            );
            await fastForward(86400);
            await contracts.metaDefender
                .connect(provider1)
                .certificateProviderExit('0', false);
            await contracts.metaDefender
                .connect(provider2)
                .certificateProviderExit('1', false);
            await fastForward(86400);
            await contracts.metaDefender.settlePolicy('0');
            await contracts.metaDefender
                .connect(provider1)
                .withdrawAfterExit('0');
            await contracts.metaDefender
                .connect(provider2)
                .withdrawAfterExit('1');
            const tokenAfter1 = await contracts.test.quoteToken.balanceOf(
                await provider1.getAddress(),
            );
            const tokenAfter2 = await contracts.test.quoteToken.balanceOf(
                await provider2.getAddress(),
            );
            const premium1 = americanBinaryOptions(
                tAnnualised,
                initialRisk + (1000 / standardRisk) * 0.01,
                spotPrice,
                strikePrice,
                freeRate,
            );
            const premium2 = americanBinaryOptions(
                tAnnualised,
                initialRisk +
                    (1000 / standardRisk) * 0.01 +
                    (1000 / standardRisk) * 0.01,
                spotPrice,
                strikePrice,
                freeRate,
            );
            expect(tokenAfter1.sub(tokenBefore1)).to.approximately(
                toBN(String(10000 * 0.997 + premium1 + 0.2 * premium2)),
                toBN(
                    String((10000 * 0.997 + premium1 + 0.2 * premium2) * 0.001),
                ),
            );
            expect(tokenAfter2.sub(tokenBefore2)).to.approximately(
                toBN(String(40000 * 0.997 + 0.8 * premium2)),
                toBN(String((40000 * 0.997 + 0.8 * premium2) * 0.001)),
            );
        });
    });
});
