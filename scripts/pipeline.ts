import { deploy } from './deploy';
import { initialize } from './initialize';
import chalk from 'chalk';
import { execute } from './execute';

async function main() {
    // instance
    console.log(chalk.green('deploy and instancing'));
    const instances = await deploy();

    console.log(chalk.green('initializing'));
    await initialize(instances);

    console.log(chalk.green('executing'));
    await execute(instances);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
