import * as fs from 'fs-extra';
import hre from 'hardhat';
import { providerOverrides } from './util/overrideProvider';

async function main(marketName: string) {
    if (fs.existsSync('./.env.json')) {
        const deployedContracts = JSON.parse(
            fs.readFileSync('./.env.json', 'utf8'),
        );
        if (
            String(hre.network.name) == 'mandala' ||
            String(hre.network.name) == 'mandala_localhost'
        ) {
            const res = await providerOverrides(String(hre.network.name));
            for (const market of deployedContracts.markets) {
                if (market.marketName == marketName) {
                    await res.provider.api.tx.evm.selfdestruct(
                        market.metaDefender,
                    );
                    await res.provider.api.tx.evm.sefldestruct(
                        market.liquidityCertificate,
                    );
                    await res.provider.api.tx.evm.selfdestruct(market.policy);
                    await res.provider.api.tx.evm.selfdestruct(
                        market.mockRiskReserve,
                    );
                    await res.provider.api.tx.evm.selfdestruct(
                        market.epochManage,
                    );
                }
            }
        }
    }
}

main('Test_Stable_Coins_')
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
