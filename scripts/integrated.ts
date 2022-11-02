import {
    deployTestSystem,
    TestSystemContractsType,
} from '../test/utils/deployTestSystem';
import { Signer } from 'ethers';
import { ethers } from 'hardhat';
import { toBN } from './util/web3utils';
import {
    GaussianDistributionInBuyCover,
    GaussianDistributionInProvide,
    PoissonDistribution,
} from './util/simulation';
import { seedTestSystem } from '../test/utils/seedTestSystem';
import { fastForward } from '../test/utils';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const poissonProcess = require('poisson-process');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const gaussian = require('gaussian');

async function main() {
    // instance
    // 1: env
    // 2: 10000 accounts
    const days = 365;
    let policyId = 0;

    // cn: capital count
    // mn: medal count
    // pn: policy count

    const [
        deployer,
        user1,
        user2,
        user3,
        user4,
        user5,
        user6,
        user7,
        user8,
        user9,
        user10,
        user11,
        user12,
        user13,
        user14,
        user15,
        user16,
        user17,
        user18,
        user19,
    ] = await ethers.getSigners();
    const c = await deployTestSystem(deployer);
    await seedTestSystem(deployer, c, 1000000000, [
        user1,
        user2,
        user3,
        user4,
        user5,
        user6,
        user7,
        user8,
        user9,
        user10,
        user11,
        user12,
        user13,
        user14,
        user15,
        user16,
        user17,
        user18,
        user19,
    ]);

    // initial deposit
    await c.metaDefender
        .connect(user1)
        .providerEntrance(await user1.getAddress(), toBN(String(100000000)));
    // mimic for one day
    for (let i = 1; i <= days; i++) {
        // mpc:mean provider count,mec mean exit count,mbc mean buy cover count
        const counts = await generatePoissonDistribution();
        await mimic(
            [
                user2,
                user3,
                user4,
                user5,
                user6,
                user7,
                user8,
                user9,
                user10,
                user11,
                user12,
                user13,
                user14,
                user15,
                user16,
                user17,
                user18,
                user19,
            ],
            counts[0],
            counts[1],
            counts[2],
            c,
        );
        console.log(
            'After' + i + ' days, usableCapital ',
            await c.metaDefender.getUsableCapital(),
        );
        console.log(
            'After' + i + ' days, fee ',
            (await c.metaDefender.globalInfo()).fee,
        );
        await fastForward(86400);
        policyId = await getThePolicyId(
            c,
            [
                user2,
                user3,
                user4,
                user5,
                user6,
                user7,
                user8,
                user9,
                user10,
                user11,
                user12,
                user13,
                user14,
                user15,
                user16,
                user17,
                user18,
                user19,
            ],
            policyId,
        );
        console.log('PolicyId is ', policyId);
    }
}

async function getThePolicyId(
    c: TestSystemContractsType,
    s: Signer[],
    policyId: number,
) {
    while (true) {
        try {
            const policyInfo = await c.policy.getPolicyInfo(policyId);
            for (let i = 0; i < s.length; i++) {
                if ((await s[i].getAddress()) == policyInfo.beneficiary) {
                    if (!policyInfo.isCancelled) {
                        try {
                            await c.metaDefender
                                .connect(s[i])
                                .cancelPolicy(policyId);
                        } catch (e) {
                            return policyId;
                        }
                    }
                }
            }
        } catch (e) {
            return policyId;
        }
        policyId += 1;
    }
}

// certificateNumber
//
async function mimic(
    // cn: capital count
    // mn: medal count
    // pn: policy count
    signers: Signer[],
    cn: number,
    mn: number,
    pn: number,
    c: TestSystemContractsType,
) {
    while (cn + mn + pn > 0) {
        const s = signers[Math.floor(18 * Math.random())];
        if (Math.random() < cn / (cn + mn + pn)) {
            if (cn > 0) {
                cn -= 1;
                const amountToProvide = gaussian(
                    GaussianDistributionInProvide.mean,
                    GaussianDistributionInProvide.variance,
                ).random();
                if (amountToProvide < 2) {
                    continue;
                }
                await c.metaDefender
                    .connect(s)
                    .providerEntrance(
                        await s.getAddress(),
                        toBN(String(amountToProvide)),
                    );
            }
        } else if (Math.random() < (cn + mn) / (cn + mn + pn)) {
            if (mn > 0) {
                mn -= 1;
                const providers =
                    await c.liquidityCertificate.getLiquidityProviders(
                        await s.getAddress(),
                    );
                const r = Math.floor(Math.random() * providers.length);
                if (Number(providers[r]) == 0) {
                    continue;
                }
                if (providers.length > 0) {
                    await c.metaDefender
                        .connect(s)
                        .certificateProviderExit(providers[r]);
                }
            }
        } else {
            if (pn > 0) {
                pn -= 1;
                const amountToBuyCover = gaussian(
                    GaussianDistributionInBuyCover.mean,
                    GaussianDistributionInBuyCover.variance,
                ).random();
                if (amountToBuyCover < 2) {
                    continue;
                }
                await c.metaDefender
                    .connect(s)
                    .buyCover(
                        await s.getAddress(),
                        toBN(String(amountToBuyCover[0])),
                    );
            }
        }
        // console.log((await c.metaDefender.globalInfo()).fee);
    }
}

async function generatePoissonDistribution(): Promise<number[]> {
    const mpc = Math.floor(
        poissonProcess.sample(PoissonDistribution.muDailyProvideCount),
    );
    const mec = Math.floor(
        poissonProcess.sample(PoissonDistribution.muDailyExitCount),
    );
    const mbc = Math.floor(
        poissonProcess.sample(PoissonDistribution.muDailyBuyCoverCount),
    );
    return [mpc, mec, mbc];
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
