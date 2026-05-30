#!/usr/bin/env node

import * as p from '@clack/prompts';
import pc from 'picocolors';

import { injectVSCode, warnNoCodeCLI } from './modules/vscode.js';
import { injectAntigravity } from './modules/antigravity.js';


async function main() {
    process.stdout.write('\x1Bc');

    // hearder
    p.intro(pc.cyan('// IMPORT PAPANGKORN SETTINGS //'));

    // options
    const selections = await p.multiselect({
        message: `SELECT ENVIRONMENTS TO INJECT:\t  ${pc.gray('[ Use Space to Toggle | Up/Down to Move | Enter to Confirm ]')} \n`,
        options: [
            { value: 'vscode', label: 'VS.CODE', hint: 'Profiles & Extensions' },
            { value: 'antigravity', label: 'ANTIGRAVITY.IDE', hint: 'Core IDE configuration' },
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
