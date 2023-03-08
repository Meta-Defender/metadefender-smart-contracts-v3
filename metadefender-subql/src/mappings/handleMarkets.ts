import {
    createLiquidityCertificateDatasource,
    createPolicyDatasource,
    Market,
} from '../types';
import { AcalaEvmEvent, AcalaEvmCall } from '@subql/acala-evm-processor';
import { BigNumber } from 'ethers';

export async function handleMarketAdded(event: AcalaEvmEvent): Promise<void> {
    // first create the template of the certain market.
    await createLiquidityCertificateDatasource(event.args.liquidityCertificate);
    await createPolicyDatasource(event.args.policy);
    // then create the market entity.
    const market = new Market(event.args.metaDefender.toHexString());
    market.protocol = event.args.metaDefender.toHexString();
    market.liquidityCertificate = event.args.liquidityCertificate.toHexString();
    market.policy = event.args.policy.toHexString();
    market.epochManage = event.args.epochManage.toHexString();
    market.marketName = event.args.marketName;
    market.marketDescription = event.args.marketDescription;
    market.marketPaymentToken = event.args.marketPaymentToken;
    market.marketProtectionType = event.args.marketProtectionType;
    market.network = event.args.network;
    market.isValid = true;
    await market.save();
    return;
}
