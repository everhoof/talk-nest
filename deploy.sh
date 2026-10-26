set -e

export NVM_DIR=~/.nvm
source ~/.nvm/nvm.sh

find . -maxdepth 1 ! -name node_modules ! -name artifacts.tgz ! -name .env.local ! -name . ! -name .. -exec rm -rf {} \;
tar -xvf artifacts.tgz
rm artifacts.tgz

api_pm2_executable="$(command -v pm2)"
"$api_pm2_executable" stop ecosystem.config.js
nvm install
nvm use
corepack enable
corepack install
pnpm install --frozen-lockfile --prod
pnpm typeorm:prod migration:run
pnpm seeder:prod migration:run
API_NODE_EXECUTABLE="$(command -v node)" "$api_pm2_executable" start ecosystem.config.js
"$api_pm2_executable" save
