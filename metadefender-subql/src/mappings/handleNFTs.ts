import { AcalaEvmEvent } from '@subql/acala-evm-processor';
import { LiquidityCertificate, Policy } from '../types';
import { keccak256 } from 'hardhat/internal/util/keccak';

export async function handleTransfer(event: AcalaEvmEvent): Promise<void> {
    const id = keccak256(
        Buffer.from(event.address.toString() + event.args.tokenId.toString()),
    ).toString('hex');
    const liquidityCertificate = await LiquidityCertificate.get(id);
    if (liquidityCertificate) {
        liquidityCertificate.owner = event.args.to.toHexString();
        await liquidityCertificate.save();
    }
    return;
}

export async function handleNewLPMinted(event: AcalaEvmEvent): Promise<void> {
    const id = keccak256(
        Buffer.from(event.address.toString() + event.args.tokenId.toString()),
    ).toString('hex');
    const newLiquidityCertificate = new LiquidityCertificate(id);
    newLiquidityCertificate.protocol = event.args.protocol.toHexString();
    newLiquidityCertificate.owner = event.args.owner.toHexString();
    newLiquidityCertificate.certificateId = event.args.certificateId;
    newLiquidityCertificate.enteredEpochIndex = event.args.enteredEpochIndex;
    newLiquidityCertificate.exitedEpochIndex = BigInt(0);
    newLiquidityCertificate.rewardDebtEpochIndex = event.args.enteredEpochIndex;
    newLiquidityCertificate.liquidity = event.args.liquidity;
    newLiquidityCertificate.SPSLocked = BigInt(0);
    newLiquidityCertificate.isValid = true;
    await newLiquidityCertificate.save();
    return;
}
export async function handleLPExpired(event: AcalaEvmEvent): Promise<void> {
    const id = keccak256(
        Buffer.from(event.address.toString() + event.args.tokenId.toString()),
    ).toString('hex');
    const liquidityCertificate = await LiquidityCertificate.get(id);
    if (liquidityCertificate) {
        liquidityCertificate.isValid = false;
        await liquidityCertificate.save();
    } else {
        throw new Error('Certificate does not exist');
    }
    return;
}

export async function handleNewPolicyMinted(
    event: AcalaEvmEvent,
): Promise<void> {
    const id = keccak256(
        Buffer.from(event.address.toString() + event.args.tokenId.toString()),
    ).toString('hex');
    const newPolicy = new Policy(id);
    newPolicy.protocol = event.args.protocol.toHexString();
    newPolicy.beneficiary = event.args.beneficiary.toHexString();
    newPolicy.policyId = event.args.policyId;
    newPolicy.timestamp = event.args.timestamp;
    newPolicy.coverage = event.args.coverage;
    newPolicy.fee = event.args.fee;
    newPolicy.duration = event.args.duration;
    newPolicy.standardRisk = event.args.standardRisk;
    newPolicy.enteredEpochIndex = event.args.enteredEpochIndex;
    newPolicy.SPS = event.args.SPS;
    newPolicy.isClaimed = false;
    newPolicy.isClaimApplying = false;
    newPolicy.isSettled = false;
    await newPolicy.save();
}

export async function handlePolicyUnderClaimApplying(
    event: AcalaEvmEvent,
): Promise<void> {
    const id = keccak256(
        Buffer.from(event.address.toString() + event.args.policyId.toString()),
    ).toString('hex');
    const policy = await Policy.get(id);
    if (policy) {
        policy.isClaimApplying = true;
        await policy.save();
    } else {
        throw new Error('Policy does not exist');
    }
    return;
}

export async function handlePolicyClaimed(event: AcalaEvmEvent): Promise<void> {
    const id = keccak256(
        Buffer.from(event.address.toString() + event.args.policyId.toString()),
    ).toString('hex');
    const policy = await Policy.get(id);
    if (policy) {
        policy.isClaimed = true;
        await policy.save();
    } else {
        throw new Error('Policy does not exist');
    }
    return;
}

export async function handlePolicySettled(event: AcalaEvmEvent): Promise<void> {
    const id = keccak256(
        Buffer.from(event.address.toString() + event.args.policyId.toString()),
    ).toString('hex');
    const policy = await Policy.get(id);
    if (policy) {
        policy.isSettled = true;
        await policy.save();
    } else {
        throw new Error('Policy does not exist');
    }
    return;
}
