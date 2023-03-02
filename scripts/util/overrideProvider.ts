import { EvmRpcProvider } from '@acala-network/eth-providers';
import { Signer } from 'ethers';
const { ethers } = require('hardhat');

export type overrideProvider = {
    provider: EvmRpcProvider;
    signers: Signer[];
};

export async function providerOverrides(): Promise<overrideProvider> {
    const ENDPOINT_URL = process.env.ENDPOINT_URL || 'ws://localhost:9944';
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
        'ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
        provider,
    );

    return {
        provider: provider,
        signers: [testSigner, signer],
    };
}
