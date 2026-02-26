/**
 * PM2 Ecosystem Configuration
 * For production deployment on VPS/EC2
 * 
 * Usage:
 * - Development: pm2 start ecosystem.config.js
 * - Production: pm2 start ecosystem.config.js --env production
 * - Cluster mode: pm2 start ecosystem.config.js --env production -i max
 */

module.exports = {
  apps: [
    {
      name: 'crm-backend',
      script: './server.js',
      
      // Instances
      instances: process.env.PM2_INSTANCES || 1, // Use 'max' for cluster mode
      exec_mode: 'fork', // Use 'cluster' for multiple instances
      
      // Auto-restart
      autorestart: true,
      watch: false, // Don't watch in production
      max_memory_restart: '512M', // Restart if memory exceeds 512MB
      
      // Restart delay
      restart_delay: 4000, // Wait 4s before restart
      max_restarts: 10, // Max 10 restarts in 1 minute
      min_uptime: '10s', // Min uptime before considering stable
      
      // Logs
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      
      // Environment variables - Development
      env: {
        NODE_ENV: 'development',
        PORT: 3000
      },
      
      // Environment variables - Production
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      
      // Advanced options
      kill_timeout: 5000, // Time to wait before force kill
      listen_timeout: 3000, // Time to wait for app to be ready
      shutdown_with_message: true, // Enable graceful shutdown
      
      // Monitoring
      instance_var: 'INSTANCE_ID',
      
      // Source map support
      source_map_support: true,
      
      // Node.js options
      node_args: '--max-old-space-size=512', // Limit heap size
    }
  ],
  
  // Deployment configuration (optional)
  deploy: {
    production: {
      user: 'ubuntu',
      host: 'your-server-ip',
      ref: 'origin/main',
      repo: 'git@github.com:your-repo.git',
      path: '/var/www/crm',
      'post-deploy': 'cd backend && npm install --production && pm2 reload ecosystem.config.js --env production',
      'pre-setup': 'apt-get install git'
    }
  }
};
