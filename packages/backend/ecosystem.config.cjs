// Load environment variables from .env file
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');
const envVars = {};

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        envVars[key.trim()] = valueParts.join('=').trim();
      }
    }
  });
}

module.exports = {
  apps: [{
    name: 'plukd-api',
    script: 'src/index.ts',
    interpreter: '/home/plukd/.bun/bin/bun',
    cwd: '/home/plukd/apps/plukd/packages/backend',
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      ...envVars,
    },
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    error_file: '/home/plukd/logs/plukd-error.log',
    out_file: '/home/plukd/logs/plukd-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
  }]
};
