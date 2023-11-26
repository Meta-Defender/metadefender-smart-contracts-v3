import { LeaderBoard, LiquidityCertificate, Market, Policy } from "../types";
import { logger, utils } from "ethers";
import { MarketAddedEvent } from '../types/contracts/MetaDefenderMarketsRegistry';
import { NewPolicyBoughtEvent, RewardsClaimedEvent, CoverageClaimedAndTransferredEvent } from "../types/contracts/MetaDefender";
import {
    ExpiredEvent,
    NewLPMintedEvent,
    TransferEvent,
} from '../types/contracts/LiquidityCertificate';
import {
    NewPolicyMintedEvent,
    PolicyClaimedEvent,
    PolicySettledEvent,
} from '../types/contracts/Policy';

export async function handleLPExpired(event: ExpiredEvent) {
    const hashId = utils.keccak256(
        utils.toUtf8Bytes(
            event.address.toString() + event.args.certificateId.toString(),
        ),
    );
    const entity = await LiquidityCertificate.get(hashId);
    if (entity == null) {
        throw new Error('Certificate does not exist');
    }
    entity.isValid = false;
    await entity.save();
    return;
}

export async function handleLPTransfer(event: TransferEvent) {
    const to = event.args.to;
    const hashId = utils.keccak256(
      utils.toUtf8Bytes(
        event.address.toString() + event.args.tokenId.toString(),
      ),
    );
    const entity = await LiquidityCertificate.get(hashId);
    if (entity != null) {
        if (entity.owner != to.toString()) {
            entity.owner = to.toString();
            await entity.save();
        }
    }
    return;
}

export async function handleNewLPMinted_glimmer(event: NewLPMintedEvent) {
    const hashId = utils.keccak256(
        utils.toUtf8Bytes(
            event.address.toString() + event.args.certificateId.toString(),
        ),
    );
    const LP = LiquidityCertificate.create({
        id: hashId,
        protocol: event.args.metaDefender,
        owner: event.args.owner,
        liquidity: event.args.liquidity.toBigInt(),
        certificateId: event.args.certificateId.toBigInt(),
        enteredEpochIndex: event.args.enteredEpochIndex.toBigInt(),
        exitedEpochIndex: BigInt(0),
        rewardDebtEpochIndex: event.args.enteredEpochIndex.toBigInt(),
        SPSLocked: BigInt(0),
        isValid: true,
        risk: 'glimmer'
    });

    await LP.save();
}

export async function handleNewLPMinted_flame(event: NewLPMintedEvent) {
    const hashId = utils.keccak256(
      utils.toUtf8Bytes(
        event.address.toString() + event.args.certificateId.toString(),
      ),
    );
    const LP = LiquidityCertificate.create({
        id: hashId,
        protocol: event.args.metaDefender,
        owner: event.args.owner,
        liquidity: event.args.liquidity.toBigInt(),
        certificateId: event.args.certificateId.toBigInt(),
        enteredEpochIndex: event.args.enteredEpochIndex.toBigInt(),
        exitedEpochIndex: BigInt(0),
        rewardDebtEpochIndex: event.args.enteredEpochIndex.toBigInt(),
        SPSLocked: BigInt(0),
        isValid: true,
        risk: 'flame'
    });

    await LP.save();
}

export async function handleNewLPMinted_blaze(event: NewLPMintedEvent) {
    const hashId = utils.keccak256(
      utils.toUtf8Bytes(
        event.address.toString() + event.args.certificateId.toString(),
      ),
    );
    const LP = LiquidityCertificate.create({
        id: hashId,
        protocol: event.args.metaDefender,
        owner: event.args.owner,
        liquidity: event.args.liquidity.toBigInt(),
        certificateId: event.args.certificateId.toBigInt(),
        enteredEpochIndex: event.args.enteredEpochIndex.toBigInt(),
        exitedEpochIndex: BigInt(0),
        rewardDebtEpochIndex: event.args.enteredEpochIndex.toBigInt(),
        SPSLocked: BigInt(0),
        isValid: true,
        risk: 'blaze'
    });

    await LP.save();
}

export async function handleMarketAdded(event: MarketAddedEvent) {
    const hashId = utils.keccak256(
        utils.toUtf8Bytes(
            event.args.metaDefender.toString() +
            event.args.marketName.toString(),
        ),
    );
    const market = Market.create({
        id: hashId,
        protocol: event.args.metaDefender,
        liquidityCertificate: event.args.liquidityCertificate,
        policy: event.args.policy,
        epochManage: event.args.epochManage,
        marketName: event.args.marketName,
        marketDescription: event.args.marketDescription,
        marketPaymentToken: event.args.marketPaymentToken,
        marketProtectionType: event.args.marketProtectionType,
        network: event.args.network,
        isValid: true,
        timestamp: event.args.timestamp.toBigInt(),
    });

    await market.save();
}

export async function handleCoverageClaimedAndTransferred(event: CoverageClaimedAndTransferredEvent) {
    const owner = event.args.policyBuyer;
    if (await LeaderBoard.get(owner) == null) {
        const entity = LeaderBoard.create({
            id: owner,
            user: owner,
            pnl: event.args.coverage.toBigInt(),
            isNegative: false,
        })
    } else {
        const entity = await LeaderBoard.get(owner);
        if (entity.isNegative) {
            if (entity.pnl > event.args.coverage.toBigInt()) {
                entity.pnl = entity.pnl - event.args.coverage.toBigInt();
            } else {
                entity.pnl = event.args.coverage.toBigInt() - entity.pnl;
                entity.isNegative = false;
            }
        } else {
            entity.pnl = entity.pnl + event.args.coverage.toBigInt();
        }
        await entity.save();
    }
}


export async function handleRewardsClaimed(event: RewardsClaimedEvent) {
    const owner = event.args.provider;
    if (await LeaderBoard.get(owner) == null) {
        const entity = LeaderBoard.create({
            id: owner,
            user: owner,
            pnl: event.args.amount.toBigInt(),
            isNegative: false,
        })
    } else {
        const entity = await LeaderBoard.get(owner);
        if (entity.isNegative) {
            if (entity.pnl > event.args.amount.toBigInt()) {
                entity.pnl = entity.pnl - event.args.amount.toBigInt();
            } else {
                entity.pnl = event.args.amount.toBigInt() - entity.pnl;
                entity.isNegative = false;
            }
        } else {
            entity.pnl = entity.pnl + event.args.amount.toBigInt();
        }
        await entity.save();
    }
}

export async function handleNewPolicyBuyer_MetaDefender(event: NewPolicyBoughtEvent) {
    const owner = event.args.policyBuyer;
    if (await LeaderBoard.get(owner) == null) {
       const entity = LeaderBoard.create({
           id: owner,
           user: owner,
           pnl: event.args.amount.toBigInt(),
           isNegative: true,
       })
       await entity.save();
    } else {
        const entity = await LeaderBoard.get(owner);
        if (entity.isNegative) {
            entity.pnl = entity.pnl + event.args.amount.toBigInt();
        } else {
            if (entity.pnl > event.args.amount.toBigInt()) {
                entity.pnl = entity.pnl - event.args.amount.toBigInt();
            } else {
                entity.pnl = event.args.amount.toBigInt() - entity.pnl;
                entity.isNegative = true;
            }
        }
        await entity.save();
    }
}

export async function handleNewPolicyMinted_glimmer(event: NewPolicyMintedEvent) {
    const hashId = utils.keccak256(
        utils.toUtf8Bytes(
            event.address.toString() + event.args.policyId.toString(),
        ),
    );
    const entity = Policy.create({
        id: hashId,
        epochManage: event.args.epochManage,
        protocol: event.args.protocol,
        beneficiary: event.args.beneficiary,
        policyId: event.args.policyId.toBigInt(),
        timestamp: event.args.timestamp.toBigInt(),
        coverage: event.args.coverage.toBigInt(),
        fee: event.args.fee.toBigInt(),
        duration: event.args.duration.toBigInt(),
        standardRisk: event.args.standardRisk.toBigInt(),
        enteredEpochIndex: event.args.enteredEpochIndex.toBigInt(),
        SPS: event.args.SPS.toBigInt(),
        isClaimed: false,
        isClaimApplying: false,
        isSettled: false,
        risk: 'glimmer'
    });
    await entity.save();
}

export async function handleNewPolicyMinted_flame(event: NewPolicyMintedEvent) {
    const hashId = utils.keccak256(
      utils.toUtf8Bytes(
        event.address.toString() + event.args.policyId.toString(),
      ),
    );
    const entity = Policy.create({
        id: hashId,
        epochManage: event.args.epochManage,
        protocol: event.args.protocol,
        beneficiary: event.args.beneficiary,
        policyId: event.args.policyId.toBigInt(),
        timestamp: event.args.timestamp.toBigInt(),
        coverage: event.args.coverage.toBigInt(),
        fee: event.args.fee.toBigInt(),
        duration: event.args.duration.toBigInt(),
        standardRisk: event.args.standardRisk.toBigInt(),
        enteredEpochIndex: event.args.enteredEpochIndex.toBigInt(),
        SPS: event.args.SPS.toBigInt(),
        isClaimed: false,
        isClaimApplying: false,
        isSettled: false,
        risk: 'flame'
    });
    await entity.save();
}

export async function handleNewPolicyMinted_blaze(event: NewPolicyMintedEvent) {
    const hashId = utils.keccak256(
      utils.toUtf8Bytes(
        event.address.toString() + event.args.policyId.toString(),
      ),
    );
    const entity = Policy.create({
        id: hashId,
        epochManage: event.args.epochManage,
        protocol: event.args.protocol,
        beneficiary: event.args.beneficiary,
        policyId: event.args.policyId.toBigInt(),
        timestamp: event.args.timestamp.toBigInt(),
        coverage: event.args.coverage.toBigInt(),
        fee: event.args.fee.toBigInt(),
        duration: event.args.duration.toBigInt(),
        standardRisk: event.args.standardRisk.toBigInt(),
        enteredEpochIndex: event.args.enteredEpochIndex.toBigInt(),
        SPS: event.args.SPS.toBigInt(),
        isClaimed: false,
        isClaimApplying: false,
        isSettled: false,
        risk: 'blaze'
    });
    await entity.save();
}

export async function handlePolicyClaimed(event: PolicyClaimedEvent) {
    const hashId = utils.keccak256(
        utils.toUtf8Bytes(
            event.address.toString() + event.args.policyId.toString(),
        ),
    );
    const entity = await Policy.get(hashId);
    if (entity == null) {
        throw new Error('Policy does not exist');
    }
    entity.isClaimed = true;
    await entity.save();
    return;
}

export async function handlePolicySettled(event: PolicySettledEvent) {
    const hashId = utils.keccak256(
        utils.toUtf8Bytes(
            event.address.toString() + event.args.policyId.toString(),
        ),
    );
    const entity = await Policy.get(hashId);
    if (entity == null) {
        throw new Error('Policy does not exist');
    }
    entity.isSettled = true;
    await entity.save();
    return;
}