/**
 * Package script for creating distributable zip file
 * Run with: pnpm run package
 */

import { createWriteStream, mkdirSync, existsSync, rmSync, copyFileSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import archiver from 'archiver';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

const PLUGIN_NAME = 'xone-driver-manager';
const VERSION = process.env.npm_package_version || '1.0.0';

// Files and directories to include in the package
const includeFiles = [
    'plugin.json',
    'package.json',
    'main.py',
    'README.md',
    'LICENSE'
];

const includeDirs = [
    'dist',
    'defaults'
];

async function copyRecursive(src, dest) {
    if (!existsSync(src)) return;

    const stat = statSync(src);
    if (stat.isDirectory()) {
        mkdirSync(dest, { recursive: true });
        const entries = readdirSync(src);
        for (const entry of entries) {
            await copyRecursive(join(src, entry), join(dest, entry));
        }
    } else {
        mkdirSync(dirname(dest), { recursive: true });
        copyFileSync(src, dest);
    }
}

async function createPackage() {
    const outDir = join(projectRoot, 'out');
    const pluginDir = join(outDir, PLUGIN_NAME);
    const zipPath = join(outDir, `${PLUGIN_NAME}-v${VERSION}.zip`);

    console.log(`Creating package: ${PLUGIN_NAME}-v${VERSION}.zip`);

    // Clean and create output directory
    if (existsSync(outDir)) {
        rmSync(outDir, { recursive: true });
    }
    mkdirSync(pluginDir, { recursive: true });

    // Copy files
    for (const file of includeFiles) {
        const src = join(projectRoot, file);
        const dest = join(pluginDir, file);
        if (existsSync(src)) {
            copyFileSync(src, dest);
            console.log(`  Copied: ${file}`);
        }
    }

    // Copy directories
    for (const dir of includeDirs) {
        const src = join(projectRoot, dir);
        const dest = join(pluginDir, dir);
        if (existsSync(src)) {
            await copyRecursive(src, dest);
            console.log(`  Copied: ${dir}/`);
        }
    }

    // Create zip file
    const output = createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    return new Promise((resolve, reject) => {
        output.on('close', () => {
            console.log(`\nPackage created: out/${PLUGIN_NAME}-v${VERSION}.zip (${archive.pointer()} bytes)`);
            resolve();
        });

        archive.on('error', reject);
        archive.pipe(output);
        archive.directory(pluginDir, PLUGIN_NAME);
        archive.finalize();
    });
}

createPackage().catch(console.error);
