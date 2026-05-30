import fs from 'fs';
import path from 'path';

/**
 * Recursively copies a file or directory from src to dest.
 * @param {string} src 
 * @param {string} dest 
 */
export function copySync(src, dest) {
    if (!fs.existsSync(src)) return;
    const stats = fs.statSync(src);
    if (stats.isDirectory()) {
        fs.mkdirSync(dest, { recursive: true });
        fs.readdirSync(src).forEach(child => {
            copySync(path.join(src, child), path.join(dest, child));
        });
    } else {
        const destDir = path.dirname(dest);
        if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
        }
        fs.copyFileSync(src, dest);
    }
}
