const fs = require('fs');
const path = require('path');

const ENV_PATH = path.join(process.cwd(), '.env');

const parseEnv = () => {
  if (!fs.existsSync(ENV_PATH)) return {};
  const content = fs.readFileSync(ENV_PATH, 'utf8');
  const lines = content.split('\n');
  const config = {};
  lines.forEach((line) => {
    const [key, value] = line.split('=');
    if (key && value) config[key.trim()] = value.trim();
  });
  return config;
};

const saveEnv = (newConfig) => {
  const currentConfig = parseEnv();
  const finalConfig = { ...currentConfig, ...newConfig };
  const content = Object.entries(finalConfig)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  fs.writeFileSync(ENV_PATH, content);
};

module.exports = {
  parseEnv,
  saveEnv,
};
