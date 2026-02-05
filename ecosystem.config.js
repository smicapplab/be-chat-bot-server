module.exports = {
  apps: [
    {
      name: 'be-chat-bot-server',
      script: 'dist/src/main.js',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '1800M',
      min_uptime: '30s',
      autorestart: true,
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      env: {
        NODE_ENV: 'production',
        PORT: '4001',
        NODE_OPTIONS: '--max-old-space-size=1536 --enable-source-maps --heapsnapshot-signal=SIGUSR2'
      },
      out_file: '~/.pm2/logs/be-chat-bot-server-out.log',
      error_file: '~/.pm2/logs/be-chat-bot-server-error.log',
    },
  ],
};