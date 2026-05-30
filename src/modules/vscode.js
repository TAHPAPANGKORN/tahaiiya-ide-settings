import fs from 'fs';
import path from 'path';
import { execSync, spawn } from 'child_process';
import { fileURLToPath } from 'url';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { copySync } from '../utils/fs.js';
import { installFont } from '../utils/font.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Project root is two levels up from src/modules/
const PROJECT_ROOT = path.resolve(__dirname, '../../config');
const HOME = process.env.HOME;

// Detect if dry-run mode is enabled
const isDryRun = process.env.DRY_RUN === 'true';

// Live binding export to indicate if the code CLI warning should be shown post-install
export let warnNoCodeCLI = false;

// helper to install extensions from a JSON list (from VS Code's extensions.json)
async function installExtensions(extensionsFilePath, profileName = null) {
    if (!fs.existsSync(extensionsFilePath)) return;
    
    try {
        const fileContent = fs.readFileSync(extensionsFilePath, 'utf8');
        const parsed = JSON.parse(fileContent);
        
        if (!Array.isArray(parsed)) {
            p.log.warn(pc.yellow(`[VSCODE] Invalid format in: ${extensionsFilePath}. Expected a JSON array.`));
            return;
        }

        // Extract identifier.id from the extensions.json array
        const extensions = parsed
            .map(item => item?.identifier?.id)
            .filter(id => typeof id === 'string' && id.length > 0);
            
        if (extensions.length === 0) return;
        
        const label = profileName ? `profile "${profileName}"` : 'Default profile';
        const actionLabel = isDryRun ? 'Simulating extension installation' : 'Installing extensions';
        
        const s = p.spinner();
        s.start(`${actionLabel} for ${label}...`);
        
        let installedCount = 0;
        let failedCount = 0;
        
        if (isDryRun) {
            extensions.forEach(ext => {
                p.log.info(pc.yellow(`[DRY-RUN] Would install extension: ${ext}`));
                installedCount++;
            });
            s.stop(pc.green(`Simulated extension installation for ${label} (${installedCount} extensions).`));
        } else {
            const args = [];
            if (profileName) {
                args.push('--profile', profileName);
            }
            extensions.forEach(ext => {
                args.push('--install-extension', ext);
            });

            await new Promise((resolve, reject) => {
                const child = spawn('code', args, { shell: true });
                
                let completedCount = 0;
                let currentExt = '';
                const totalCount = extensions.length;

                const updateProgress = () => {
                    const percent = Math.min(100, Math.round((completedCount / totalCount) * 100));
                    const filledLength = Math.round((percent / 100) * 15);
                    const emptyLength = 15 - filledLength;
                    const progressBar = pc.green('█'.repeat(filledLength)) + pc.gray('░'.repeat(emptyLength));
                    
                    let msg = `${actionLabel} for ${label} [${progressBar}] ${percent}%`;
                    if (currentExt) {
                        msg += ` | Installing ${currentExt}`;
                    }
                    s.message(msg);
                };

                const parseLine = (line) => {
                    const installMatch = line.match(/Installing extension '([^'\s]+)'/i);
                    if (installMatch) {
                        currentExt = installMatch[1];
                        updateProgress();
                    }
                    
                    if (/successfully installed|already installed/i.test(line)) {
                        completedCount++;
                        installedCount++;
                        updateProgress();
                    } else if (/failed installing|not found/i.test(line)) {
                        completedCount++;
                        failedCount++;
                        updateProgress();
                    }
                };

                let stdoutRemainder = '';
                child.stdout.on('data', (data) => {
                    const lines = (stdoutRemainder + data.toString()).split('\n');
                    stdoutRemainder = lines.pop();
                    lines.forEach(parseLine);
                });

                let stderrRemainder = '';
                child.stderr.on('data', (data) => {
                    const lines = (stderrRemainder + data.toString()).split('\n');
                    stderrRemainder = lines.pop();
                    lines.forEach(parseLine);
                });

                child.on('close', (code) => {
                    if (stdoutRemainder) parseLine(stdoutRemainder);
                    if (stderrRemainder) parseLine(stderrRemainder);
                    
                    completedCount = totalCount;
                    currentExt = '';
                    
                    const completionMessage = `Completed installing extensions for ${label} (${installedCount} success, ${failedCount} failed).`;
                    s.stop(pc.green(completionMessage));
                    resolve();
                });

                child.on('error', (err) => {
                    s.stop(pc.red(`Failed to run VS Code CLI: ${err.message}`));
                    reject(err);
                });
            });
        }
    } catch (err) {
        p.log.error(pc.red(`[VSCODE] Failed to parse or process extensions JSON: ${err.message}`));
    }
}

// Copies settings.json from source to target directory.
export function copySettings(sourceDir, targetDir, label = 'Global') {
    const sourcePath = path.join(sourceDir, 'settings.json');
    const targetPath = path.join(targetDir, 'settings.json');
    if (fs.existsSync(sourcePath)) {
        try {
            copySync(sourcePath, targetPath);
            p.log.success(pc.green(`[VSCODE] ${label} settings.json -> SUCCESS`));
        } catch (err) {
            p.log.error(pc.red(`[VSCODE] Failed to copy ${label} settings.json: ${err.message}`));
        }
    } else {
        p.log.warn(pc.yellow(`[VSCODE] ${label} settings.json -> NOT FOUND in repository`));
    }
}

// Copies keybindings.json from source to target directory.
export function copyKeybindings(sourceDir, targetDir, label = 'Global') {
    const sourcePath = path.join(sourceDir, 'keybindings.json');
    const targetPath = path.join(targetDir, 'keybindings.json');
    if (fs.existsSync(sourcePath)) {
        try {
            copySync(sourcePath, targetPath);
            p.log.success(pc.green(`[VSCODE] ${label} keybindings.json -> SUCCESS`));
        } catch (err) {
            p.log.error(pc.red(`[VSCODE] Failed to copy ${label} keybindings.json: ${err.message}`));
        }
    } else {
        p.log.warn(pc.yellow(`[VSCODE] ${label} keybindings.json -> NOT FOUND in repository`));
    }
}

// Copies snippets directory recursively from source to target directory.
export function copySnippets(sourceDir, targetDir, label = 'Global') {
    const sourcePath = path.join(sourceDir, 'snippets');
    const targetPath = path.join(targetDir, 'snippets');
    if (fs.existsSync(sourcePath)) {
        try {
            copySync(sourcePath, targetPath);
            p.log.success(pc.green(`[VSCODE] ${label} snippets -> SUCCESS`));
        } catch (err) {
            p.log.error(pc.red(`[VSCODE] Failed to copy ${label} snippets: ${err.message}`));
        }
    } else {
        p.log.warn(pc.yellow(`[VSCODE] ${label} snippets -> NOT FOUND in repository`));
    }
}

// Registers a profile in storage.json and returns its folder hash.
export function registerProfile(targetDir, profileName) {
    const storageFile = path.join(targetDir, 'globalStorage/storage.json');
    let folderHash = null;

    let storage = { userDataProfiles: [] };
    if (fs.existsSync(storageFile)) {
        try {
            storage = JSON.parse(fs.readFileSync(storageFile, 'utf8'));
        } catch (err) {
            p.log.error(pc.red(`[VSCODE] Failed to parse storage.json, creating a fresh one: ${err.message}`));
        }
    }

    if (!storage.userDataProfiles) {
        storage.userDataProfiles = [];
    }

    const registeredProfiles = storage.userDataProfiles;
    const foundProfile = registeredProfiles.find(p => p.name === profileName);

    if (foundProfile) {
        folderHash = foundProfile.location;
    } else {
        const randomHash = '-' + Math.floor(Math.random() * 0xFFFFFFFF).toString(16);
        folderHash = randomHash;

        registeredProfiles.push({
            location: folderHash,
            name: profileName,
            useDefaultFlags: {
                settings: true,
                snippets: true,
                keybindings: true
            }
        });

        try {
            fs.mkdirSync(path.dirname(storageFile), { recursive: true });
            fs.writeFileSync(storageFile, JSON.stringify(storage, null, 4), 'utf8');
            p.log.success(pc.green(`[VSCODE] Registered new profile "${profileName}" in storage.json`));
        } catch (err) {
            p.log.error(pc.red(`[VSCODE] Failed to update storage.json: ${err.message}`));
            return null;
        }
    }
    return folderHash;
}

// Injects Custom Profiles Settings & Extensions
export async function injectCustomProfiles(targetDir, hasCodeCLI, opts) {
    const profilesSourceDir = path.join(PROJECT_ROOT, 'vscode', 'profiles');
    if (!fs.existsSync(profilesSourceDir)) return;

    const profiles = fs.readdirSync(profilesSourceDir).filter(file => {
        return fs.statSync(path.join(profilesSourceDir, file)).isDirectory();
    });

    if (profiles.length === 0) return;

    p.log.info(pc.cyan(`[VSCODE] Found ${profiles.length} profile(s) to inject: ${profiles.join(', ')}`));

    for (const profileName of profiles) {
        p.log.info(pc.blue(`[VSCODE] Injecting profile: ${profileName}`));

        const folderHash = registerProfile(targetDir, profileName);
        if (!folderHash) {
            p.log.error(pc.red(`[VSCODE] Could not resolve folder hash for profile "${profileName}". Settings were not copied.`));
            continue;
        }

        const profileTargetDir = path.join(targetDir, 'profiles', folderHash);
        const sourceProfileDir = path.join(profilesSourceDir, profileName);

        if (fs.existsSync(sourceProfileDir)) {
            const label = `Profile "${profileName}"`;

            // Selective copies based on options
            if (opts.settings) {
                copySettings(sourceProfileDir, profileTargetDir, label);
            }
            if (opts.keybindings) {
                copyKeybindings(sourceProfileDir, profileTargetDir, label);
            }
            if (opts.snippets) {
                copySnippets(sourceProfileDir, profileTargetDir, label);
            }

            // Also copy other non-special files that might exist in the profile folder (excluding special config files)
            try {
                fs.readdirSync(sourceProfileDir).forEach(item => {
                    if (['settings.json', 'keybindings.json', 'snippets', 'extensions.json'].includes(item)) {
                        return;
                    }
                    const sourcePath = path.join(sourceProfileDir, item);
                    const targetPath = path.join(profileTargetDir, item);
                    copySync(sourcePath, targetPath);
                });
            } catch (err) {
                p.log.error(pc.red(`[VSCODE] Failed to copy custom files for profile "${profileName}": ${err.message}`));
            }
        }

        // Install profile extensions
        if (opts.extensions && (hasCodeCLI || isDryRun)) {
            const profileExtensionsFile = path.join(profilesSourceDir, profileName, 'extensions.json');
            if (fs.existsSync(profileExtensionsFile)) {
                await installExtensions(profileExtensionsFile, profileName);
            }
        }
    }
}

// injection for vscode
export async function injectVSCode(options = {}) {
    const opts = {
        settings: true,
        keybindings: true,
        snippets: true,
        extensions: true,
        profiles: true,
        font: true,
        ...options
    };

    // 0. OS Compatibility Check
    if (process.platform !== 'darwin' && !isDryRun) {
        p.log.warn(pc.yellow(`[VSCODE] Warning: This script is optimized for macOS. Platform detected: ${process.platform}. Paths and permissions may differ.`));
    }

    // 0.1 Install FiraCode Nerd Font Mono
    if (opts.font) {
        installFont();
    }

    // 1. Determine target directory based on mode
    const targetDir = process.env.VSCODE_TARGET_DIR || path.join(HOME, 'Library/Application Support/Code/User');

    if (isDryRun) {
        p.log.info(pc.magenta('\n=== RUNNING IN SAFE TEST / DRY-RUN MODE ==='));
        p.log.info(pc.magenta(`Redirecting all settings output to: ${targetDir}\n`));
    }

    if (!fs.existsSync(targetDir)) {
        p.log.warn(pc.yellow(`Target directory not found. Creating: ${targetDir}`));
        fs.mkdirSync(targetDir, { recursive: true });
    }

    // 2. Check if code CLI is available
    let hasCodeCLI = false;
    try {
        execSync('which code', { stdio: 'ignore' });
        hasCodeCLI = true;
    } catch (e) {
        warnNoCodeCLI = true;
        if (!isDryRun) {
            p.log.warn(pc.yellow('[VSCODE] "code" command line tool not found in PATH. Extensions will not be installed automatically.'));
        }
    }

    // 3. Inject Global/Default settings, keybindings, and snippets
    const sourceDir = path.join(PROJECT_ROOT, 'vscode');

    if (opts.settings) {
        copySettings(sourceDir, targetDir, 'Global');
    }
    if (opts.keybindings) {
        copyKeybindings(sourceDir, targetDir, 'Global');
    }
    if (opts.snippets) {
        copySnippets(sourceDir, targetDir, 'Global');
    }

    // 4. Inject Global/Default Extensions
    if (opts.extensions && (hasCodeCLI || isDryRun)) {
        const globalExtensionsFile = path.join(PROJECT_ROOT, 'vscode', 'extensions.json');
        if (fs.existsSync(globalExtensionsFile)) {
            await installExtensions(globalExtensionsFile);
        } else {
            p.log.warn(pc.yellow('[VSCODE] Global extensions.json -> NOT FOUND in repository'));
        }
    }

    // 5. Inject Custom Profiles Settings & Extensions
    if (opts.profiles) {
        await injectCustomProfiles(targetDir, hasCodeCLI, opts);
    }
}
