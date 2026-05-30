import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import os from 'os';

const HOME = process.env.HOME || os.homedir();
const isTestMode = process.argv.includes('--test');

// helper to install FiraCode Nerd Font Mono on macOS
export function installFont() {
    const fontsDir = path.join(HOME, 'Library/Fonts');
    fs.mkdirSync(fontsDir, { recursive: true });

    const fontFiles = [
        {
            name: 'FiraCodeNerdFontMono-Regular.ttf',
            url: 'https://github.com/ryanoasis/nerd-fonts/raw/HEAD/patched-fonts/FiraCode/Regular/FiraCodeNerdFontMono-Regular.ttf'
        },
        {
            name: 'FiraCodeNerdFontMono-Bold.ttf',
            url: 'https://github.com/ryanoasis/nerd-fonts/raw/HEAD/patched-fonts/FiraCode/Bold/FiraCodeNerdFontMono-Bold.ttf'
        }
    ];

    const s = p.spinner();
    s.start('Installing FiraCode Nerd Font Mono...');

    // Try Homebrew Cask first
    try {
        execSync('which brew', { stdio: 'ignore' });
        
        // Check if already installed
        const checkBrew = execSync('brew list --cask', { encoding: 'utf8' });
        if (checkBrew.includes('font-fira-code-nerd-font')) {
            s.stop(pc.green('FiraCode Nerd Font Mono is already installed via Homebrew.'));
            return;
        }

        s.message('Installing font-fira-code-nerd-font via Homebrew Cask...');
        if (isTestMode) {
            p.log.info(pc.yellow('[DRY-RUN] Would run: brew install --cask font-fira-code-nerd-font'));
        } else {
            execSync('brew install --cask font-fira-code-nerd-font', { stdio: 'ignore' });
        }
        s.stop(pc.green(isTestMode ? 'Simulated Homebrew font installation.' : 'FiraCode Nerd Font Mono installed via Homebrew Cask.'));
    } catch (e) {
        // Fallback: Direct download using curl
        s.message('Homebrew not found or cask failed. Downloading font files directly...');
        
        let successCount = 0;
        fontFiles.forEach(file => {
            const destPath = path.join(fontsDir, file.name);
            if (fs.existsSync(destPath)) {
                successCount++;
                return;
            }
            try {
                if (isTestMode) {
                    p.log.info(pc.yellow(`[DRY-RUN] Would download font from ${file.url} to ${destPath}`));
                    successCount++;
                } else {
                    execSync(`curl -fsSL "${file.url}" -o "${destPath}"`, { stdio: 'ignore' });
                    successCount++;
                }
            } catch (err) {
                p.log.warn(pc.yellow(`Failed to download font style: ${file.name}`));
            }
        });
        
        if (successCount === fontFiles.length) {
            s.stop(pc.green(isTestMode ? 'Simulated FiraCode Nerd Font Mono installation.' : 'FiraCode Nerd Font Mono successfully installed.'));
        } else {
            s.stop(pc.red('Failed to install FiraCode Nerd Font Mono.'));
        }
    }
}
