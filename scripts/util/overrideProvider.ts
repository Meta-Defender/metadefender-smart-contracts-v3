import {
    calcEthereumTransactionParams,
    EvmRpcProvider,
} from '@acala-network/eth-providers';
import { Overrides, Signer } from 'ethers';
import { gasConstantDependencies } from 'mathjs';
const { ethers } = require('hardhat');

export type OverrideProvider = {
    provider: EvmRpcProvider;
    signers: Signer[];
};

export async function calculateGasLimitAndGasPrice(): Promise<Overrides> {
    const txFeePerGas = '199999946752';
    const storageByteDeposit = '100000000000000'; // for Mandala/Karura
    // const storageByteDeposit = '300000000000000';   // for Acala

    const ethParams = calcEthereumTransactionParams({
        gasLimit: 21000000,
        validUntil: 2000000, // or hardcode a very big number
        storageLimit: 64001,
        txFeePerGas,
        storageByteDeposit,
    });

    return {
        gasLimit: ethParams.txGasLimit.toNumber(),
        gasPrice: ethParams.txGasPrice.toNumber(),
    };
}

export async function providerOverrides(
    networkName: string,
): Promise<OverrideProvider> {
    let ENDPOINT_URL: string;
    if (networkName == 'mandala_localhost') {
        ENDPOINT_URL = process.env.ENDPOINT_URL || 'ws://localhost:9944';
    } else {
        ENDPOINT_URL =
            process.env.ENDPOINT_URL ||
            'wss://mandala-rpc.aca-staging.network/ws';
    }
    const MNEMONIC =
        process.env.MNEMONIC ||
        'fox sight canyon orphan hotel grow hedgehog build bless august weather swarm';
    const provider = EvmRpcProvider.from(ENDPOINT_URL);
    await provider.isReady();
    const gasPriceOverrides = (await provider._getEthGas()).gasPrice;

    provider.getFeeData = async () => ({
        maxFeePerGas: null,
        maxPriorityFeePerGas: null,
        lastBaseFeePerGas: null,
        gasPrice: gasPriceOverrides,
    });

    const testSigner: Signer =
        ethers.Wallet.fromMnemonic(MNEMONIC).connect(provider);

    const signer: Signer = new ethers.Wallet(
        '7e8444e3b47e706d2190801a32c568edeaeab2fe16e9dafdb774a6fdc5a211b8',
        provider,
    );

    return {
        provider: provider,
        signers: [testSigner, signer],
    };
}
