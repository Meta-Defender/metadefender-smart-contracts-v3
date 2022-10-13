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
} from './util/simulation';
import { seedTestSystem } from '../test/utils/seedTestSystem';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const poissonProcess = require('poisson-process');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const gaussian = require('gaussian');

async function main() {
    // instance
    // 1: env
    // 2: 10000 accounts
    const days = 365;

    const [deployer, user] = await ethers.getSigners();
    const c = await deployTestSystem(deployer);
    await seedTestSystem(deployer, c, 1000000, [user]);
    await mimic(user, 100, 10, 100, c);
}

async function getNFTCount() {
    // get certificate count
    // get medal count
    // get policy count
}

async function getKLast(c: TestSystemContractsType) {
    return (await c.metaDefender.globalInfo()).kLast;
}

// certificateNumber
//
async function mimic(
    // cn: capital count
    // mn: medal count
    // pn: policy count
    s: Signer,
    cn: number,
    mn: number,
    pn: number,
    c: TestSystemContractsType,
) {
    while (cn + mn + pn > 0) {
        if (Math.random() < cn / (cn + mn + pn)) {
            cn -= 1;
            if (cn > 0) {
                const amountToProvide = gaussian(
                    GaussianDistributionInProvide.mean,
                    GaussianDistributionInProvide.variance,
                ).random();
                console.log(amountToProvide[0]);
                await c.metaDefender
                    .connect(s)
                    .providerEntrance(
                        await s.getAddress(),
                        toBN(String(amountToProvide)),
                    );
            }
        } else if (Math.random() < (cn + mn) / (cn + mn + pn)) {
            mn -= 1;
            if (mn > 0) {
                // do something in mn
                // random select mn certificate to exit.
                const providers =
                    await c.liquidityCertificate.getLiquidityProviders(
                        await s.getAddress(),
                    );
                const r = Math.floor(Math.random() * providers.length);
                if (providers.length > 0) {
                    await c.metaDefender
                        .connect(s)
                        .certificateProviderExit(providers[r]);
                }
            }
        } else {
            pn -= 1;
            if (pn > 0) {
                const amountToBuyCover = gaussian(
                    GaussianDistributionInBuyCover.mean,
                    GaussianDistributionInBuyCover.variance,
                ).random();
                console.log(amountToBuyCover[0]);
                await c.metaDefender
                    .connect(s)
                    .buyCover(
                        await s.getAddress(),
                        toBN(String(amountToBuyCover[0])),
                    );
            }
        }
        console.log(await getKLast(c));
    }
}

async function generatePoissonDistribution(days: number) {
    // generate random data
    // in a day.
    for (let i = 0; i < days; i++) {
        const mpc = poissonProcess.sample(poissonProcess.muDailyProvideCount);
        const mec = poissonProcess.sample(poissonProcess.muDailyExitCount);
        const mbc = poissonProcess.sample(poissonProcess.muDailyBuyCoverCount);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
