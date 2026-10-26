require('./environment');

module.exports = {
  apps: [
    {
      name: process.env.APP_NAME,
      script: 'dist/main.js',
      interpreter: process.env.API_NODE_EXECUTABLE || process.execPath,
      autorestart: true,
    },
  ],
};
