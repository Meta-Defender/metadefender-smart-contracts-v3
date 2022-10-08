import { Signer } from 'ethers';
import { toBN } from '../../scripts/util/web3utils';
import { TestSystemContractsType } from './deployTestSystem';

export async function seedTestSystem(
    deployer: Signer,
    c: TestSystemContractsType,
    seedAmount: number,
    overrides?: Signer[],
) {
    const deployerAddr = await deployer.getAddress();

    // Mint tokens
    await c.test.quoteToken.mint(deployerAddr, toBN(String(seedAmount)));

    // Approve option market
    await c.test.quoteToken.approve(
        c.metaDefender.address,
        toBN(String(seedAmount)),
    );

    if (overrides) {
        for (const signer of overrides) {
            const signerAddr = await signer.getAddress();
            await c.test.quoteToken.mint(signerAddr, toBN(String(seedAmount)));
            await c.test.quoteToken
                .connect(signer)
                .approve(c.metaDefender.address, toBN(String(seedAmount)));
        }
    }

    await c.test.quoteToken.permitMint(c.mockRiskReserve.address, true);
}
