import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT   = path.resolve(__dirname, '../../config');
const HOME           = process.env.HOME || os.homedir();
const VSCODE_USER    = process.env.VSCODE_TARGET_DIR || (
    process.platform === 'win32'
        ? path.join(process.env.APPDATA || path.join(HOME, 'AppData/Roaming'), 'Code/User')
        : path.join(HOME, 'Library/Application Support/Code/User')
);
const getKeybindingsFilename = () => {
    if (process.platform === 'win32') {
        return 'keybindings-windows.jsonc';
    } else if (process.platform === 'darwin') {
        return 'keybindings-macos.jsonc';
    } else {
        return 'keybindings.jsonc';
    }
};

// Default destination — can be overridden at call-time
const DEFAULT_DEST_VSCODE = path.join(PROJECT_ROOT, 'vscode');

// ─── helpers ────────────────────────────────────────────────────────────────

function copyFile(src, dest) {
    if (!fs.existsSync(src)) return false;
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
    return true;
}

function copyDir(src, dest) {
    if (!fs.existsSync(src)) return false;
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
        const srcPath  = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            copyDir(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
    return true;
}

/** Generate extensions.json in the same format as the repo (array of identifier objects). */
function buildExtensionsJson(extensionIds) {
    return extensionIds.map(id => ({ identifier: { id } }));
}

/** List installed extensions via `code --list-extensions` (optionally with --profile). */
function listExtensions(profileName = null) {
    try {
        const args = ['code', '--list-extensions'];
        if (profileName) args.push('--profile', profileName);
        const raw = execSync(args.join(' '), { encoding: 'utf8' });
        return raw.trim().split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    } catch {
        return null; // code CLI not available
    }
}

/** Read profiles registered in storage.json → returns [{ name, location }] */
function readRegisteredProfiles() {
    const storageFile = path.join(VSCODE_USER, 'globalStorage/storage.json');
    if (!fs.existsSync(storageFile)) return [];
    try {
        const storage = JSON.parse(fs.readFileSync(storageFile, 'utf8'));
        return Array.isArray(storage.userDataProfiles) ? storage.userDataProfiles : [];
    } catch {
        return [];
    }
}

// ─── export functions ────────────────────────────────────────────────────────

function exportGlobalSettings(opts, destDir) {
    p.log.info(pc.cyan('[EXPORT] Global settings...'));

    if (opts.settings) {
        const ok = copyFile(
            path.join(VSCODE_USER, 'settings.json'),
            path.join(destDir, 'settings.json'),
        );
        p.log[ok ? 'success' : 'warn'](
            ok ? pc.green('[EXPORT] settings.json → OK') : pc.yellow('[EXPORT] settings.json → not found'),
        );
    }

    if (opts.keybindings) {
        const keybindingsFile = getKeybindingsFilename();
        const ok = copyFile(
            path.join(VSCODE_USER, 'keybindings.json'),
            path.join(destDir, keybindingsFile),
        );
        p.log[ok ? 'success' : 'warn'](
            ok ? pc.green(`[EXPORT] keybindings.json → ${keybindingsFile} OK`) : pc.yellow('[EXPORT] keybindings.json → not found'),
        );
    }

    if (opts.snippets) {
        const ok = copyDir(
            path.join(VSCODE_USER, 'snippets'),
            path.join(destDir, 'snippets'),
        );
        p.log[ok ? 'success' : 'warn'](
            ok ? pc.green('[EXPORT] snippets/ → OK') : pc.yellow('[EXPORT] snippets/ → not found'),
        );
    }
}

function exportGlobalExtensions(opts, destDir) {
    if (!opts.extensions) return;

    p.log.info(pc.cyan('[EXPORT] Global extensions...'));
    const ids = listExtensions();

    if (ids === null) {
        p.log.warn(pc.yellow('[EXPORT] extensions → "code" CLI not found, skipping'));
        return;
    }
    if (ids.length === 0) {
        p.log.warn(pc.yellow('[EXPORT] extensions → no extensions installed'));
        return;
    }

    const dest = path.join(destDir, 'extensions.json');
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, JSON.stringify(buildExtensionsJson(ids), null, 4), 'utf8');
    p.log.success(pc.green(`[EXPORT] extensions.json → OK (${ids.length} extensions)`));
}

function exportProfiles(opts, destDir) {
    if (!opts.profiles) return;

    const registered = readRegisteredProfiles();
    if (registered.length === 0) {
        p.log.info(pc.gray('[EXPORT] No custom profiles found in storage.json'));
        return;
    }

    p.log.info(pc.cyan(`[EXPORT] Found ${registered.length} profile(s): ${registered.map(r => r.name).join(', ')}`));

    for (const { name: profileName, location } of registered) {
        p.log.info(pc.blue(`[EXPORT] Profile: ${profileName}`));

        const srcProfileDir  = path.join(VSCODE_USER, 'profiles', location);
        const destProfileDir = path.join(destDir, 'profiles', profileName);

        if (!fs.existsSync(srcProfileDir)) {
            p.log.warn(pc.yellow(`[EXPORT] Profile folder not found: ${srcProfileDir}`));
            continue;
        }

        // Mirror the entire profile directory so nothing is missed.
        // extensions.json is already in the correct format — no CLI needed.
        const entries = fs.readdirSync(srcProfileDir, { withFileTypes: true });

        for (const entry of entries) {
            let entryName = entry.name;
            let destName = entry.name;

            if (entry.name === 'keybindings.json') {
                if (!opts.keybindings) continue;
                destName = getKeybindingsFilename();
            } else if (entry.name === 'settings.json' && !opts.settings) {
                continue;
            } else if (entry.name === 'snippets' && !opts.snippets) {
                continue;
            } else if (entry.name === 'extensions.json' && !opts.extensions) {
                continue;
            }

            const srcPath  = path.join(srcProfileDir, entryName);
            const destPath = path.join(destProfileDir, destName);

            try {
                if (entry.isDirectory()) {
                    copyDir(srcPath, destPath);
                } else {
                    copyFile(srcPath, destPath);
                }
                p.log.success(pc.green(`[EXPORT] ${profileName}/${destName} → OK`));
            } catch (err) {
                p.log.error(pc.red(`[EXPORT] ${profileName}/${destName} → FAILED: ${err.message}`));
            }
        }
    }
}

// ─── main export entry ───────────────────────────────────────────────────────

export async function exportVSCode(options = {}, destDir = DEFAULT_DEST_VSCODE) {
    const opts = {
        settings:    true,
        keybindings: true,
        snippets:    true,
        extensions:  true,
        profiles:    true,
        ...options,
    };

    if (process.platform !== 'darwin' && process.platform !== 'win32') {
        p.log.warn(pc.yellow('[EXPORT] Warning: This script is optimized for macOS and Windows 11.'));
    }

    if (!fs.existsSync(VSCODE_USER)) {
        p.log.error(pc.red(`[EXPORT] VS Code user directory not found: ${VSCODE_USER}`));
        return;
    }

    p.log.info(pc.magenta(`[EXPORT] Source : ${VSCODE_USER}`));
    p.log.info(pc.magenta(`[EXPORT] Dest   : ${destDir}`));

    exportGlobalSettings(opts, destDir);
    exportGlobalExtensions(opts, destDir);
    exportProfiles(opts, destDir);

    p.log.success(pc.green(`\n[EXPORT] Done — ${destDir} is up to date.`));
}
