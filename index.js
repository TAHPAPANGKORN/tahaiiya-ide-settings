#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

import * as p from '@clack/prompts';
import pc from 'picocolors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SOURCE_DIR = __dirname;
const HOME = process.env.HOME;

// injection for vscode
function injectVSCode() {

}

// injection for antigravity
function injectAntigravity() {

}

async function main() {
    console.clear();

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

    const s = p.spinner();
    s.start('INJECTING PROTOCOLS TO TARGET SYSTEM...');

    if (selections.includes('vscode')) {
        injectVSCode();
    }
    if (selections.includes('antigravity')) {
        injectAntigravity();
    }

    s.stop(pc.green('CORE INJECTION COMPLETED.'));


    p.note(
        selections.map(item => `[DEPLOY] ${item.toUpperCase()} -> SUCCESS`).join('\n') || 'NO MODULES SELECTED',
        'SYSTEM REPORT'
    );

    p.outro(pc.gray('// ALL INJECTION PROTOCOLS EXECUTED SUCCESSFULLY.'));
}

main().catch(console.error);
