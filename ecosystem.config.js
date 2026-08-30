module.exports = {
  apps: [
    {
      name: 'makedown-api',
      script: 'src/server.js',
      instances: 1,
      exec_mode: 'fork',
      env_production: {
        NODE_ENV: 'production',
      },
      max_memory_restart: '300M',
    },
  ],
};
