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
    const signer = await signers[0];
    const signerAddress = await signers[0].getAddress();

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

    const prompt = inquirer.createPromptModule();
    const choices = [
        'Provide Liquidity',
        'Liquidity Withdraw',
        'Buy Policy',
        'Settle Policy',
        'Query',
        'Time Travel',
        'Get Me Some Test Token',
        'Approve',
        'Exit',
    ];

    const answers = await prompt({
        type: 'list',
        name: 'operation',
        message: 'What do you want to do?',
        choices,
    });

    switch (answers.operation) {
        case 'Query':
            const balance = await quoteToken.balanceOf(
                await signer.getAddress(),
            );
            console.log(
                'You have the balance of ' + Number(balance) / 1e18 + ' USDTs',
            );
            const certificates =
                await liquidityCertificate.getLiquidityProviders(
                    await signer.getAddress(),
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
                await signer.getAddress(),
            );
            console.log(chalk.red('Here are your policies'));
            for (let i = 0; i < policies.length; i++) {
                console.log(await policy.getPolicyInfo(policies[i]));
            }
            break;
        case 'Get Me Some Test Token':
            await quoteToken
                .connect(signer)
                .mint(await signer.getAddress(), toBN('10000'));
            break;
        case 'Approve':
            await quoteToken
                .connect(signer)
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
                    .connect(signer)
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
                    await signer.getAddress(),
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
                .connect(signer)
                .certificateProviderExit(String(toBeWithdrawn.certificateId));
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
                    .connect(signer)
                    .buyPolicy(
                        signerAddress,
                        toBN(String(policyCoverage.coverage)),
                        String(policyDuration.duration),
                    );
            }
            break;
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
