import chalk from 'chalk';
import { ethers } from 'hardhat';
import { Instances } from './deploy';

export async function initialize(i: Instances): Promise<any> {
    // initialize contracts
    console.log(chalk.green('Initializing contracts...'));
    console.log(chalk.yellow('Initializing MetaDefender...'));
    const signers = await ethers.getSigners();
    const deployer = signers[0];
    const deployAddr = await deployer.getAddress();
    const riskReserve = signers[1];
    const riskReserveAddr = await riskReserve.getAddress();

    const res = await i.MetaDefender.init(
        i.TestQuoteAsset.address,
        i.LiquidityToken.address,
        deployAddr,
        deployAddr,
        // mimic reserve
        riskReserveAddr,
        i.MetaDefenderGlobals.address,
        i.MetaDefenderGlobals.address,
    );

    console.log(chalk.green('MetaDefender initialized.', res?.hash));
    console.log(chalk.greenBright('\n=== Success! ===\n'));
}
