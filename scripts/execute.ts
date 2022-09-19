import chalk from 'chalk';
import { ethers } from 'hardhat';
import { Instances } from './deploy';
import { toBN } from './util/web3utils';
import { sleep } from '../test/utils';

export async function execute(instances: Instances): Promise<any> {
    const signers = await ethers.getSigners();
    const signer = signers[0];
    const userAddress = await signer.getAddress();
    console.log(chalk.green(`user address: ${userAddress}`));
    const riskReserve = signers[1];
    const riskReserveAddress = await riskReserve.getAddress();
    console.log(chalk.green(`risk reserve address: ${riskReserveAddress}`));

    // setting initialFee
    const initialFee = await instances.MetaDefenderGlobals.setInitialFee(
        instances.TestQuoteAsset.address,
        toBN('0.02'),
    );
    const minimumFee = await instances.MetaDefenderGlobals.setMinimumFee(
        instances.TestQuoteAsset.address,
        toBN('0.02'),
    );
    console.log(
        'successfully set initialFee and minimumFee',
        initialFee?.hash,
        minimumFee?.hash,
    );

    // mint for users
    const mint = await instances.TestQuoteAsset.mint(
        userAddress,
        toBN('1000000'),
    );
    console.log('successfully minted', mint?.hash);

    // permit MetaDefenderGlobals to mint the token;
    const permit = await instances.LiquidityToken.permitMint(
        instances.MetaDefender.address,
        true,
    );

    const approve = await instances.TestQuoteAsset.approve(
        instances.MetaDefender.address,
        toBN('1000000000000'),
    );
    const approveForRiskReserve = await instances.TestQuoteAsset.connect(
        riskReserve,
    ).approve(instances.MetaDefender.address, toBN('1000000000000'));
    console.log(
        'successfully approved with user and riskReserve:',
        approve?.hash,
        approveForRiskReserve?.hash,
    );

    const underwriter = await instances.MetaDefender.providerEntrance(
        toBN('10000'),
    );
    console.log('successfully underwriter entered', underwriter?.hash);
    // cannot underwriter for another time
    // const underwriter2 = await instances.MetaDefender.providerEntrance(toBN('10000'))
    console.log('liquidity', await instances.MetaDefender.liquidity());

    // we now begin to buy cover
    const buyCover = await instances.MetaDefender.buyCover(toBN('10'));
    console.log('successfully buy cover', buyCover?.hash);

    const getRewards = await instances.MetaDefender.getRewards(userAddress);
    console.log(getRewards);

    console.log(await instances.TestQuoteAsset.balanceOf(userAddress));

    const providerExit = await instances.MetaDefender.providerExit();
    console.log('successfully providerExit', providerExit?.hash);

    const getWithdrawalAndShadowHistorical =
        await instances.MetaDefender.getWithdrawalAndShadowHistorical(
            userAddress,
        );
    console.log(
        'successfully getWithdrawalAndShadowHistorical',
        getWithdrawalAndShadowHistorical,
    );

    console.log(await instances.TestQuoteAsset.balanceOf(userAddress));

    const policyClaimApply = await instances.MetaDefender.policyClaimApply(0);
    console.log('successfully policyClaimApply', policyClaimApply?.hash);

    const approvePolicy = await instances.MetaDefender.approveApply(0);
    console.log('successfully approve policy', approvePolicy?.hash);

    console.log('liquidity', await instances.MetaDefender.liquidity());
    console.log(chalk.greenBright('\n=== Success! ===\n'));
}
