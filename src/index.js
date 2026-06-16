#!/usr/bin/env node

if (process.platform === 'win32' && process.env.HOME) {
    delete process.env.HOME;
}

import * as p from '@clack/prompts';
import pc from 'picocolors';
import figlet from 'figlet';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { version } = require('../package.json');

import { injectVSCode, warnNoCodeCLI } from './modules/vscode.js';
import { injectAntigravity } from './modules/antigravity.js';
import { enableVimNavigation } from './utils/keymap.js';

enableVimNavigation();

function printBanner() {
    const line1 = figlet.textSync('IMPORT', {
        font: 'Coder Mini',
        horizontalLayout: 'default',
        width: 120,
    });
    const line2 = figlet.textSync('IDE    SETTINGS', {
        font: 'Coder Mini',
        horizontalLayout: 'default',
        width: 120,
    });

    const brand = pc.bold(pc.cyan('Dev by PAPANGKORN')) + ' · IDE Settings Installer';
    const ver   = `v${version}`;

    console.log('');
    console.log(pc.cyan(line1));
    console.log(pc.white(line2));
    console.log('');
    console.log(`${brand} | ${ver}`);
    console.log('');
}

async function main() {
    process.stdout.write('\x1Bc');
    printBanner();

    // options
    const selections = await p.multiselect({
        message: `SELECT ENVIRONMENTS TO INJECT:\t  ${pc.gray('[ Use Space to Toggle | Up/Down to Move | Enter to Confirm ]')} \n`,
        options: [
            { value: 'vscode', label: 'VS.CODE' },
            { value: 'antigravity', label: 'ANTIGRAVITY.IDE' },
        ],
        required: false,
    });

    // exit
    if (p.isCancel(selections)) {
        console.clear();

        const confirmExit = await p.confirm({
            message: pc.gray('Are you sure you want to exit the setup session?'),
            active: 'Yes, exit',
            inactive: 'No, stay',
            initialValue: false,
        });

        if (confirmExit === true || p.isCancel(confirmExit)) {
            process.stdout.write('\x1Bc');
            p.cancel(pc.dim('Session closed. No configurations were modified.'));
            process.exit(0);
        } else {
            return main();
        }
    }

    if (selections.includes('vscode')) {
        await injectVSCode();
    }
    if (selections.includes('antigravity')) {
        injectAntigravity();
    }


    p.note(
        selections.map(item => `[DEPLOY] ${item.toUpperCase()} -> SUCCESS`).join('\n') || 'NO MODULES SELECTED',
        'SYSTEM REPORT'
    );

    if (warnNoCodeCLI && selections.includes('vscode')) {
        p.note(
            `To enable automatic extension installations, make sure the "code" command is in your PATH:\n\n` +
            `  1. Open VS Code\n` +
            `  2. Open the Command Palette (${pc.bold('Cmd+Shift+P')})\n` +
            `  3. Select: ${pc.bold('Shell Command: Install "code" command in PATH')}`,
            'VS CODE CLI PATH SETUP REQUIRED'
        );
    }
}

main().catch(console.error);
