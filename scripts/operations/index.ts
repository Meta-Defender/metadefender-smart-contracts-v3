import * as readline from 'readline';
import hre, { ethers } from 'hardhat';
import { toBN } from '../util/web3utils';
import inquirer from 'inquirer';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

function question(query: string) {
    return new Promise((resolve) =>
        rl.question(query, (answ) => resolve(answ)),
    );
}

function operation(query: string) {
    return new Promise((resolve) =>
        rl.question(query, (answ) => resolve(answ)),
    );
}

function send(method: string, params?: Array<any>) {
    return hre.ethers.provider.send(method, params === undefined ? [] : params);
}

function mineBlock() {
    return send('evm_mine', []);
}

async function fastForward(seconds: number) {
    const method = 'evm_increaseTime';
    const params = [seconds];
    await send(method, params);
    await mineBlock();
}

async function currentTime() {
    const { timestamp } = await ethers.provider.getBlock('latest');
    return timestamp;
}

async function main() {
    dotenv.config();

    const signers = await hre.ethers.getSigners();
    const _metaDefender = await hre.ethers.getContractFactory('MetaDefender');
    const metaDefender = await _metaDefender.attach(
        String(process.env.MetaDefenderAddress),
    );

    const _liquidityCertificate = await hre.ethers.getContractFactory(
        'LiquidityCertificate',
    );
    const liquidityCertificate = await _liquidityCertificate.attach(
        String(process.env.LiquidityCertificateAddress),
    );

    const _policy = await hre.ethers.getContractFactory('Policy');
    const policy = await _policy.attach(String(process.env.PolicyAddress));

    const _quoteToken = await hre.ethers.getContractFactory('TestERC20');
    const quoteToken = await _quoteToken.attach(
        String(process.env.TestERC20Address),
    );

    const _globalsViewer = await hre.ethers.getContractFactory('GlobalsViewer');
    const globalsViewer = await _globalsViewer.attach(
        String(process.env.GlobalsViewerAddress),
    );

    let currentSigner = await signers[0];

    const prompt = inquirer.createPromptModule();
    const choices = [
        'Provide Liquidity',
        'Liquidity Withdraw',
        'Buy Policy',
        'Settle Policy',
        'Query My Account',
        'Query Insurance Price',
        'Query Global Views',
        'Calculate Premium',
        'Register Market',
        'Query Market Addresses',
        'Time Travel',
        'Give Me Some Test Token',
        'Approve',
        'My Address',
        'Choose Address',
        'Exit',
    ];

    while (true) {
        const answers = await prompt({
            type: 'list',
            name: 'operation',
            message: 'What do you want to do?',
            choices,
        });

        switch (answers.operation) {
            case 'Calculate Premium': {
                const policyCoverageQuery = await prompt({
                    type: 'input',
                    name: 'coverage',
                    message: 'How much coverage do you want to buy?',
                });
                const policyDurationQuery = await prompt({
                    type: 'input',
                    name: 'duration',
                    message: 'How long do you want to buy? (in days)',
                });
                const premium = await globalsViewer
                    .connect(currentSigner)
                    .getPremium(
                        toBN(String(policyCoverageQuery.coverage)),
                        String(policyDurationQuery.duration),
                        metaDefender.address,
                    );
                console.log(premium);
                break;
            }
            case 'Query Global Views':
                const globals = await globalsViewer
                    .connect(currentSigner)
                    .getGlobals();
                console.log(globals);
                break;
            case 'Choose Address':
                const signers = await hre.ethers.getSigners();
                const addresses = [];
                for (let i = 0; i < signers.length; i++) {
                    addresses.push(await signers[i].getAddress());
                }
                const chooseAddress = await prompt({
                    type: 'list',
                    name: 'address',
                    message: 'Which address you want to choose:)',
                    choices: addresses,
                });
                for (let i = 0; i < signers.length; i++) {
                    if (
                        chooseAddress.address ===
                        (await signers[i].getAddress())
                    ) {
                        currentSigner = signers[i];
                    }
                }
                break;
            case 'My Address':
                console.log(chalk.green(await currentSigner.getAddress()));
                break;
            case 'Query Insurance Price':
                const policyCoverageQuery = await prompt({
                    type: 'input',
                    name: 'coverage',
                    message: 'How much coverage do you want to buy?',
                });
                const policyDurationQuery = await prompt({
                    type: 'input',
                    name: 'duration',
                    message: 'How long do you want to buy? (in days)',
                });
                if (
                    !isNaN(Number(policyCoverageQuery.coverage)) &&
                    !isNaN(Number(policyDurationQuery.duration))
                ) {
                    const price = await globalsViewer
                        .connect(currentSigner)
                        .getPremium(
                            toBN(String(policyCoverageQuery.coverage)),
                            String(policyDurationQuery.duration),
                            metaDefender.address,
                        );
                    console.log(chalk.green('Price: ' + price));
                }
                break;
            case 'Query My Account':
                const balance = await quoteToken.balanceOf(
                    await currentSigner.getAddress(),
                );
                console.log(
                    'You have the balance of ' +
                        Number(balance) / 1e18 +
                        ' USDTs',
                );
                const certificates =
                    await liquidityCertificate.getLiquidityProviders(
                        await currentSigner.getAddress(),
                    );
                console.log(
                    chalk.green(
                        'Here are your certificates(including expired ones):',
                    ),
                );
                for (let i = 0; i < certificates.length; i++) {
                    console.log(
                        await liquidityCertificate.getCertificateInfo(
                            certificates[i],
                        ),
                    );
                }
                const policies = await policy.getPolicies(
                    await currentSigner.getAddress(),
                );
                console.log(chalk.red('Here are your policies'));
                for (let i = 0; i < policies.length; i++) {
                    console.log(await policy.getPolicyInfo(policies[i]));
                }
                break;
            case 'Give Me Some Test Token':
                const res = await quoteToken
                    .connect(currentSigner)
                    .mint(await currentSigner.getAddress(), toBN('10000'));
                console.log(res.hash);
                break;
            case 'Approve':
                await quoteToken
                    .connect(currentSigner)
                    .approve(metaDefender.address, toBN('99999999'));
                break;
            case 'Provide Liquidity':
                const provideLiquidity = await prompt({
                    type: 'input',
                    name: 'amount',
                    message: 'how much USDTs do you want to provide',
                });
                if (isNaN(Number(provideLiquidity))) {
                    await metaDefender
                        .connect(currentSigner)
                        .certificateProviderEntrance(
                            String(toBN(provideLiquidity.amount)),
                        );
                } else {
                    throw new Error('invalid number');
                }
                break;
            case 'Time Travel':
                console.log('current time is ' + (await currentTime()));
                await fastForward(86400);
                console.log('current time is ' + (await currentTime()));
                break;
            case 'Liquidity Withdraw':
                const availableCertificate = [];
                const certificatesToWithdraw =
                    await liquidityCertificate.getLiquidityProviders(
                        await currentSigner.getAddress(),
                    );
                for (let i = 0; i < certificatesToWithdraw.length; i++) {
                    const certificateToWithdraw =
                        await liquidityCertificate.getCertificateInfo(
                            certificatesToWithdraw[i],
                        );
                    if (certificateToWithdraw.isValid) {
                        availableCertificate.push(
                            String(certificatesToWithdraw[i]),
                        );
                    }
                }
                const toBeWithdrawn = await prompt({
                    type: 'list',
                    name: 'certificateId',
                    message: 'Which certificate you want to withdraw:)',
                    choices: availableCertificate,
                });
                await metaDefender
                    .connect(currentSigner)
                    .certificateProviderExit(
                        String(toBeWithdrawn.certificateId),
                        false,
                    );
                break;
            case 'Buy Policy':
                const policyCoverage = await prompt({
                    type: 'input',
                    name: 'coverage',
                    message: 'How much coverage do you want to buy?',
                });
                const policyDuration = await prompt({
                    type: 'input',
                    name: 'duration',
                    message: 'How long do you want to buy? (in days)',
                });
                if (
                    !isNaN(Number(policyCoverage.coverage)) &&
                    !isNaN(Number(policyDuration.duration))
                ) {
                    await metaDefender
                        .connect(currentSigner)
                        .buyPolicy(
                            await currentSigner.getAddress(),
                            toBN(String(policyCoverage.coverage)),
                            String(policyDuration.duration),
                        );
                }
                break;
            case 'Exit':
                process.exit(0);
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
