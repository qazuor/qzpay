/**
 * QZPay CLI - Scaffold billing setups
 */
import { program } from 'commander';
import { initCommand } from './commands/init.js';

const VERSION = '0.0.1';

program.name('qzpay').description('CLI for scaffolding QZPay billing setups').version(VERSION);

program
    .command('init')
    .description('Scaffold a complete QZPay billing setup')
    .option('-d, --dir <directory>', 'Output directory', '.')
    .option('-y, --yes', 'Skip prompts and use defaults')
    .action(initCommand);

program.parse();
