import * as readline from 'readline';
import hre from 'hardhat';
import { toBN } from '../util/web3utils';

import * as dotenv from 'dotenv';

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

async function main() {
    dotenv.config();

    const signers = await hre.ethers.getSigners();
    const signer = await signers[0];
    const signerAddress = await signers[0].getAddress();

    const _metaDefender = await hre.ethers.getContractFactory('MetaDefender');
    const metaDefender = await _metaDefender.attach(
        String(process.env.MetaDefenderAddress),
    );

    const _quoteToken = await hre.ethers.getContractFactory('TestERC20');
    const quoteToken = await _quoteToken.attach(
        String(process.env.TestERC20Address),
    );

    const option = String(
        await operation(
            'The operation [(P)rovideCertificate/(W)ithdrawCertificate/(B)uyPolicy]: ',
        ),
    );
    switch (option.toLowerCase()) {
        case 'p':
            const provideAmount = await operation(
                'how much money do u want to deposit:(you are rich and you can deposit as much as you can:))',
            );
            if (!isNaN(Number(provideAmount))) {
                await quoteToken
                    .connect(signer)
                    .mint(signerAddress, toBN(String(provideAmount)));
                await quoteToken
                    .connect(signer)
                    .approve(metaDefender.address, toBN(String(provideAmount)));
                await metaDefender
                    .connect(signer)
                    .certificateProviderEntrance(toBN(String(provideAmount)));
            } else {
                throw new Error('invalid number');
            }
            break;
        case 'w':
            const certificateId = await operation(
                'which certificate do you want to withdraw:',
            );
            if (!isNaN(Number(certificateId))) {
                await metaDefender
                    .connect(signer)
                    .certificateProviderExit(String(certificateId));
            } else {
                throw new Error('invalid number');
            }
            break;
        case 'b':
            const buyCoverAmount = await operation(
                'how much coverage(in USDT) do u want to buy:(suppose you are a DeFi whale:))',
            );
            const duration = await operation(
                'how long do you want to buy the coverage:(in days)',
            );
            if (!isNaN(Number(buyCoverAmount))) {
                await quoteToken
                    .connect(signer)
                    .mint(
                        signerAddress,
                        toBN(String(Number(buyCoverAmount) * 0.1)),
                    );
                await quoteToken
                    .connect(signer)
                    .approve(
                        metaDefender.address,
                        toBN(String(Number(buyCoverAmount) * 0.1)),
                    );
                await metaDefender
                    .connect(signer)
                    .buyPolicy(
                        signerAddress,
                        toBN(String(buyCoverAmount)),
                        String(duration),
                    );
            }
            break;
        default:
            throw new Error('invalid operation');
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
