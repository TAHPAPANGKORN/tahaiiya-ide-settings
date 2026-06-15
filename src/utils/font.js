import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import os from 'os';

const HOME = process.env.HOME || os.homedir();

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

    let spinnerStopped = false;

    // Try Homebrew Cask first
    try {
        execSync('which brew', { stdio: 'ignore' });
        
        // Check if already installed
        const checkBrew = execSync('brew list --cask', { encoding: 'utf8' });
        if (checkBrew.includes('font-fira-code-nerd-font')) {
            s.stop(pc.green('FiraCode Nerd Font Mono is already installed via Homebrew.'));
            spinnerStopped = true;
            return;
        }

        s.stop(pc.cyan('Homebrew found. Preparing to install font-fira-code-nerd-font...'));
        spinnerStopped = true;

        p.log.info(pc.cyan('Installing font-fira-code-nerd-font via Homebrew Cask. Progress will be displayed below:'));
        execSync('brew install --cask font-fira-code-nerd-font', { stdio: 'inherit' });
        p.log.success(pc.green('FiraCode Nerd Font Mono installed via Homebrew Cask.'));
    } catch (e) {
        // Fallback: Direct download using curl
        const fallbackSpinner = spinnerStopped ? p.spinner() : s;
        if (spinnerStopped) {
            fallbackSpinner.start('Homebrew cask installation failed. Downloading font files directly...');
        } else {
            fallbackSpinner.message('Homebrew not found or cask failed. Downloading font files directly...');
        }
        
        let successCount = 0;
        fontFiles.forEach(file => {
            const destPath = path.join(fontsDir, file.name);
            if (fs.existsSync(destPath)) {
                successCount++;
                return;
            }
            try {
                execSync(`curl -fsSL "${file.url}" -o "${destPath}"`, { stdio: 'ignore' });
                successCount++;
            } catch (err) {
                p.log.warn(pc.yellow(`Failed to download font style: ${file.name}`));
            }
        });
        
        if (successCount === fontFiles.length) {
            fallbackSpinner.stop(pc.green('FiraCode Nerd Font Mono successfully installed.'));
        } else {
            fallbackSpinner.stop(pc.red('Failed to install FiraCode Nerd Font Mono.'));
        }
    }
}
