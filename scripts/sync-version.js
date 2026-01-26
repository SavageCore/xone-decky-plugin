import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

const packageJsonPath = join(projectRoot, 'package.json');
const pluginJsonPath = join(projectRoot, 'plugin.json');

try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
    const version = packageJson.version;

    console.log(`Syncing version ${version} to plugin.json...`);

    const pluginJson = JSON.parse(readFileSync(pluginJsonPath, 'utf8'));
    pluginJson.version = version;

    writeFileSync(pluginJsonPath, JSON.stringify(pluginJson, null, 4) + '\n');
    console.log('Successfully updated plugin.json');
} catch (error) {
    console.error('Error syncing version:', error.message);
    process.exit(1);
}
