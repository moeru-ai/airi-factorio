import fs from 'fs';
import readline from 'readline';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const ask = (query) => new Promise(resolve => rl.question(`\x1b[36m?\x1b[0m ${query}`, resolve));

async function runSetup() {
    console.log('\x1b[32m=== AIRI Factorio Auto-Configurator ===\x1b[0m\n');

    const factorioPath = await ask('Absolute path to factorio.exe: ');
    const savePath = await ask('Absolute path to save file (.zip): ');
    const rconPass = await ask('RCON Password (default: airi_secret_pass): ') || 'airi_secret_pass';
    const isPirate = (await ask('Enable LAN/Pirate mode? (y/n): ')).toLowerCase() === 'y';

    const envContent = `FACTORIO_PATH='${factorioPath}'
FACTORIO_SAVE_PATH='${savePath}'
FACTORIO_RCON_PASSWORD='${rconPass}'
FACTORIO_RCON_PORT=27015

WS_SERVER_PORT=8080
WS_SERVER_HOST='localhost'`;

    // Write .env.local for agent and wrapper
    const agentEnvPath = path.join(__dirname, 'packages', 'agent', '.env.local');
    const wrapperEnvPath = path.join(__dirname, 'packages', 'factorio-wrapper', '.env.local');
    
    fs.writeFileSync(agentEnvPath, envContent);
    fs.writeFileSync(wrapperEnvPath, envContent);

    // Update server-settings.json
    const settingsPath = path.join(__dirname, 'packages', 'factorio-wrapper', 'server-settings.json');
    let settings = {};
    if (fs.existsSync(settingsPath)) {
        settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    }
    
    settings.lan = isPirate;
    settings.require_user_verification = !isPirate;
    settings.steam = !isPirate;
    
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));

    console.log('\n\x1b[32m[OK] Configuration generated successfully!\x1b[0m');
    console.log(' - Updated packages/agent/.env.local');
    console.log(' - Updated packages/factorio-wrapper/.env.local');
    console.log(' - Updated packages/factorio-wrapper/server-settings.json\n');
    rl.close();
}

runSetup();