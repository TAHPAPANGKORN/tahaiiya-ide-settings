import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { copySync } from '../utils/fs.js';
import { installFont } from '../utils/font.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Project root is two levels up from src/modules/
const PROJECT_ROOT = path.resolve(__dirname, '../../');
const HOME = process.env.HOME;

// Detect if test/dry-run mode is enabled (via CLI flag --test or env var TEST_MODE=true)
const isTestMode = process.argv.includes('--test') || process.env.TEST_MODE === 'true';

// Live binding export to indicate if the code CLI warning should be shown post-install
export let warnNoCodeCLI = false;

// helper to install extensions from a JSON list (from VS Code's extensions.json)
function installExtensions(extensionsFilePath, profileName = null) {
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
        const actionLabel = isTestMode ? 'Simulating extension installation' : 'Installing extensions';
        
        const s = p.spinner();
        s.start(`${actionLabel} for ${label}...`);
        
        let installedCount = 0;
        let failedCount = 0;
        
        extensions.forEach(ext => {
            try {
                if (isTestMode) {
                    p.log.info(pc.yellow(`[DRY-RUN] Would install extension: ${ext}`));
                    installedCount++;
                } else {
                    const profileArg = profileName ? `--profile "${profileName}"` : '';
                    execSync(`code ${profileArg} --install-extension ${ext}`, { stdio: 'ignore' });
                    installedCount++;
                }
            } catch (err) {
                p.log.warn(pc.yellow(`[VSCODE] Failed to install extension: ${ext}`));
                failedCount++;
            }
        });
        
        const completionMessage = isTestMode
            ? `Simulated extension installation for ${label} (${installedCount} extensions).`
            : `Completed installing extensions for ${label} (${installedCount} success, ${failedCount} failed).`;
            
        s.stop(pc.green(completionMessage));
    } catch (err) {
        p.log.error(pc.red(`[VSCODE] Failed to parse or process extensions JSON: ${err.message}`));
    }
}

// injection for vscode
export function injectVSCode() {
    // 0. OS Compatibility Check
    if (process.platform !== 'darwin' && !isTestMode) {
        p.log.warn(pc.yellow(`[VSCODE] Warning: This script is optimized for macOS. Platform detected: ${process.platform}. Paths and permissions may differ.`));
    }

    // 0.1 Install FiraCode Nerd Font Mono
    installFont();

    // 1. Determine target directory based on mode
    const targetDir = isTestMode
        ? path.join(PROJECT_ROOT, 'test-output/Code/User')
        : path.join(HOME, 'Library/Application Support/Code/User');

    if (isTestMode) {
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
        if (!isTestMode) {
            p.log.warn(pc.yellow('[VSCODE] "code" command line tool not found in PATH. Extensions will not be installed automatically.'));
        }
    }

    // 3. Inject Global/Default settings, keybindings, and snippets
    const globalItems = ['settings.json', 'keybindings.json', 'snippets'];
    globalItems.forEach(item => {
        const sourcePath = path.join(PROJECT_ROOT, 'vscode', item);
        const targetPath = path.join(targetDir, item);

        if (fs.existsSync(sourcePath)) {
            try {
                copySync(sourcePath, targetPath);
                p.log.success(pc.green(`[VSCODE] Global ${item} -> SUCCESS`));
            } catch (err) {
                p.log.error(pc.red(`[VSCODE] Failed to copy global ${item}: ${err.message}`));
            }
        } else {
            p.log.warn(pc.yellow(`[VSCODE] Global ${item} -> NOT FOUND in repository`));
        }
    });

    // 4. Inject Global/Default Extensions
    if (hasCodeCLI || isTestMode) {
        const globalExtensionsFile = path.join(PROJECT_ROOT, 'vscode', 'extensions.json');
        if (fs.existsSync(globalExtensionsFile)) {
            installExtensions(globalExtensionsFile);
        } else {
            p.log.warn(pc.yellow('[VSCODE] Global extensions.json -> NOT FOUND in repository'));
        }
    }

    // 5. Inject Custom Profiles Settings & Extensions
    const profilesSourceDir = path.join(PROJECT_ROOT, 'vscode', 'profiles');
    if (fs.existsSync(profilesSourceDir)) {
        const profiles = fs.readdirSync(profilesSourceDir).filter(file => {
            return fs.statSync(path.join(profilesSourceDir, file)).isDirectory();
        });

        if (profiles.length > 0) {
            p.log.info(pc.cyan(`[VSCODE] Found ${profiles.length} profile(s) to inject: ${profiles.join(', ')}`));
            
            profiles.forEach(profileName => {
                p.log.info(pc.blue(`[VSCODE] Injecting profile: ${profileName}`));
                
                // B. Read and update storage.json to map profile name to folder hash
                const storageFile = path.join(targetDir, 'globalStorage/storage.json');
                let folderHash = null;

                if (isTestMode) {
                    // Generate a mock hash name for testing
                    folderHash = `mock-hash-${profileName.toLowerCase()}`;
                } else {
                    // Programmatic Profile Registration:
                    // Create storage.json if missing, or update it to register the profile.
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
                        // Generate a unique 8-character hex hash matching VS Code conventions (prefixed with '-')
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
                            // Ensure globalStorage directory exists
                            fs.mkdirSync(path.dirname(storageFile), { recursive: true });
                            fs.writeFileSync(storageFile, JSON.stringify(storage, null, 4), 'utf8');
                            p.log.success(pc.green(`[VSCODE] Registered new profile "${profileName}" in storage.json`));
                        } catch (err) {
                            p.log.error(pc.red(`[VSCODE] Failed to update storage.json: ${err.message}`));
                        }
                    }
                }

                // C. Copy the entire profile directory contents directly
                if (folderHash) {
                    const profileTargetDir = path.join(targetDir, 'profiles', folderHash);
                    const sourceProfileDir = path.join(profilesSourceDir, profileName);
                    
                    if (fs.existsSync(sourceProfileDir)) {
                        try {
                            fs.readdirSync(sourceProfileDir).forEach(item => {
                                const sourcePath = path.join(sourceProfileDir, item);
                                const targetPath = path.join(profileTargetDir, item);
                                copySync(sourcePath, targetPath);
                            });
                            p.log.success(pc.green(`[VSCODE] Profile "${profileName}" configurations -> SUCCESS`));
                        } catch (err) {
                            p.log.error(pc.red(`[VSCODE] Failed to copy Profile "${profileName}" configurations: ${err.message}`));
                        }
                    }
                } else {
                    p.log.error(pc.red(`[VSCODE] Could not resolve folder hash for profile "${profileName}". Settings were not copied.`));
                }

                // D. Install extensions for this profile
                if (hasCodeCLI || isTestMode) {
                    const profileExtensionsFile = path.join(profilesSourceDir, profileName, 'extensions.json');
                    if (fs.existsSync(profileExtensionsFile)) {
                        installExtensions(profileExtensionsFile, profileName);
                    }
                }
            });
        }
    }
}
