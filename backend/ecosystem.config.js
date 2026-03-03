module.exports = {
    apps: [{
        name: 'superkafe-backend',
        script: './server.js',
        instances: 'max', // Use all available CPU cores
        exec_mode: 'cluster',
        watch: false,
        max_memory_restart: '1G',
        env: {
            NODE_ENV: 'production',
            PORT: 5001
        }
    }]
};
