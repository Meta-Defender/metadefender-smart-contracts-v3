import { Approval, LiquidityCertificate, Policy, Transaction } from '../types';
import { AcalaEvmEvent, AcalaEvmCall } from '@subql/acala-evm-processor';
import { BigNumber, utils } from 'ethers';
import { toBigInt } from '@nomicfoundation/hardhat-network-helpers/dist/src/utils';

// Setup types from ABI
type TransferEventArgs = [string, string, BigNumber] & {
    from: string;
    to: string;
    value: BigNumber;
};
type ApproveCallArgs = [string, BigNumber] & {
    _spender: string;
    _value: BigNumber;
};

export async function handlePolicyClaimed(event: AcalaEvmEvent) {
    const hashId = utils.keccak256(
        utils.toUtf8Bytes(
            event.address.toString() + event.args.policyId.toString(),
        ),
    );
    const policy = await Policy.get(hashId);
    if (policy) {
        policy.isClaimed = true;
        await policy.save();
    }
}

export async function handlePolicySettled(event: AcalaEvmEvent) {
    const hashId = utils.keccak256(
        utils.toUtf8Bytes(
            event.address.toString() + event.args.policyId.toString(),
        ),
    );
    const policy = await Policy.get(hashId);
    if (policy) {
        policy.isSettled = true;
        await policy.save();
    }
}

export async function handlePolicyUnderClaimApplying(event: AcalaEvmEvent) {
    const hashId = utils.keccak256(
        utils.toUtf8Bytes(
            event.address.toString() + event.args.policyId.toString(),
        ),
    );
    const policy = await Policy.get(hashId);
    if (policy) {
        policy.isClaimApplying = true;
        await policy.save();
    }
}

export async function handleNewPolicyMinted(event: AcalaEvmEvent) {
    const hashId = utils.keccak256(
        utils.toUtf8Bytes(
            event.address.toString() + event.args.policyId.toString(),
        ),
    );
    const policy = new Policy(hashId);
    policy.epochManage = event.args.epochManage.toHexString();
    policy.protocol = event.args.protocol.toHexString();
    policy.beneficiary = event.args.beneficiary.toHexString();
    policy.policyId = event.args.policyId;
    policy.timestamp = event.args.timestamp;
    policy.coverage = event.args.coverage;
    policy.fee = event.args.fee;
    policy.duration = event.args.duration;
    policy.standardRisk = event.args.standardRisk;
    policy.enteredEpochIndex = event.args.enteredEpochIndex;
    policy.SPS = event.args.SPS;
    policy.isClaimed = false;
    policy.isClaimApplying = false;
    policy.isSettled = false;
    await policy.save();
}

export async function handleLPTransfer(event: AcalaEvmEvent) {
    const hashId = utils.keccak256(
        utils.toUtf8Bytes(
            event.address.toString() + event.args.policyId.toString(),
        ),
    );
    const lp = await LiquidityCertificate.get(hashId);
    if (lp == null) {
        throw new Error('LP does not exist');
    } else {
        if (lp.owner != event.args.to.toHexString()) {
            lp.owner = event.args.to.toHexString();
            await lp.save();
        }
    }
}

export async function handleLPExpired(event: AcalaEvmEvent) {
    const hashId = utils.keccak256(
        utils.toUtf8Bytes(
            event.address.toString() + event.args.policyId.toString(),
        ),
    );
    const lp = await LiquidityCertificate.get(hashId);
    if (lp == null) {
        throw new Error('LP does not exist');
    } else {
        lp.isValid = false;
        await lp.save();
    }
}

export async function handleNewLPMinted(event: AcalaEvmEvent) {
    const hashId = utils.keccak256(
        utils.toUtf8Bytes(
            event.address.toString() + event.args.certificateId.toString(),
        ),
    );
    const lp = new LiquidityCertificate(hashId);
    lp.protocol = event.args.protocol.toHexString();
    lp.owner = event.args.owner.toHexString();
    lp.certificateId = event.args.certificateId;
    lp.enteredEpochIndex = event.args.enteredEpochIndex;
    lp.exitedEpochIndex = toBigInt(0);
    lp.rewardDebtEpochIndex = event.args.enteredEpochIndex;
    lp.liquidity = event.args.liquidity;
    lp.SPSLocked = toBigInt(0);
    lp.isValid = true;
    await lp.save();
}

export async function handleAcalaEvmEvent(event: AcalaEvmEvent): Promise<void> {
    const transaction = new Transaction(event.transactionHash);

    transaction.value = event.args.value.toBigInt();
    transaction.from = event.args.from;
    transaction.to = event.args.to;
    transaction.contractAddress = event.address;

    await transaction.save();
}

export async function handleAcalaEvmCall(
    event: AcalaEvmCall<ApproveCallArgs>,
): Promise<void> {
    const approval = new Approval(event.hash);

    approval.owner = event.from;
    approval.value = event.args._value.toBigInt();
    approval.spender = event.args._spender;
    approval.contractAddress = event.to;

    await approval.save();
}
