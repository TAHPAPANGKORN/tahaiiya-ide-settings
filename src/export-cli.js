#!/usr/bin/env node

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { exportVSCode } from './modules/export.js';
import { enableVimNavigation } from './utils/keymap.js';

enableVimNavigation();

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const DEFAULT_DEST = path.resolve(__dirname, '../config/vscode');

async function main() {
    process.stdout.write('\x1Bc');
    p.intro(pc.cyan('// EXPORT VS CODE CONFIG //'));

    // ── 1. Choose destination ────────────────────────────────────────────────
    const destChoice = await p.select({
        message: 'Select export destination:',
        options: [
            {
                value: 'repo',
                label: 'This repo  (config/vscode/)',
                hint: DEFAULT_DEST,
            },
            {
                value: 'cwd',
                label: 'Current working directory',
                hint: path.join(process.cwd(), 'vscode'),
            },
            {
                value: 'custom',
                label: 'Custom path…',
            },
        ],
    });

    if (p.isCancel(destChoice)) {
        p.cancel(pc.dim('Export cancelled.'));
        process.exit(0);
    }

    let destDir;

    if (destChoice === 'repo') {
        destDir = DEFAULT_DEST;
    } else if (destChoice === 'cwd') {
        destDir = path.join(process.cwd(), 'vscode');
    } else {
        const customPath = await p.text({
            message: 'Enter destination path:',
            placeholder: '/path/to/output/vscode',
            validate(value) {
                if (!value || value.trim() === '') return 'Path cannot be empty.';
            },
        });

        if (p.isCancel(customPath)) {
            p.cancel(pc.dim('Export cancelled.'));
            process.exit(0);
        }

        destDir = path.resolve(customPath.trim());
    }

    // ── 2. Choose what to export ─────────────────────────────────────────────
    const parts = await p.multiselect({
        message: 'What to export?',
        options: [
            { value: 'settings',    label: 'settings.json',    hint: 'Global settings' },
            { value: 'keybindings', label: 'keybindings.json', hint: 'Global keybindings' },
            { value: 'snippets',    label: 'snippets/',         hint: 'Global snippets' },
            { value: 'extensions',  label: 'extensions.json',  hint: 'Installed extensions list' },
            { value: 'profiles',    label: 'profiles/',         hint: 'All custom profiles' },
        ],
        initialValues: ['settings', 'keybindings', 'snippets', 'extensions', 'profiles'],
    });

    if (p.isCancel(parts)) {
        p.cancel(pc.dim('Export cancelled.'));
        process.exit(0);
    }

    // ── 3. Confirm ───────────────────────────────────────────────────────────
    const confirmed = await p.confirm({
        message: `Export to ${pc.bold(destDir)}?`,
        active: 'Yes, export',
        inactive: 'No, cancel',
        initialValue: true,
    });

    if (!confirmed || p.isCancel(confirmed)) {
        p.cancel(pc.dim('Export cancelled.'));
        process.exit(0);
    }

    // ── 4. Run export ────────────────────────────────────────────────────────
    fs.mkdirSync(destDir, { recursive: true });

    await exportVSCode(
        {
            settings:    parts.includes('settings'),
            keybindings: parts.includes('keybindings'),
            snippets:    parts.includes('snippets'),
            extensions:  parts.includes('extensions'),
            profiles:    parts.includes('profiles'),
        },
        destDir,
    );

    p.outro(pc.green('Export complete!'));
}

main().catch(console.error);
