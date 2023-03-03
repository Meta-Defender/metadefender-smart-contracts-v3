import { EvmRpcProvider } from '@acala-network/eth-providers';
import { Signer } from 'ethers';
const { ethers } = require('hardhat');

export type overrideProvider = {
    provider: EvmRpcProvider;
    signers: Signer[];
};

export async function providerOverrides(): Promise<overrideProvider> {
    //localhost:9944 for local test
    const ENDPOINT_URL =
        process.env.ENDPOINT_URL || 'wss://mandala-rpc.aca-staging.network/ws';
    // const ENDPOINT_URL = process.env.ENDPOINT_URL || 'ws://localhost:9944';
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
