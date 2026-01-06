const { PORT } = require('./src/config/config');
const app = require('./src/app');

let server = null;

const serverManager = {
    start: () => {
        return new Promise((resolve, reject) => {
            if (server) {
                console.log('Sunucu zaten açık.');
                resolve(true);
                return;
            }
            server = app.listen(PORT, '0.0.0.0', () => {
                console.log(`Server Started: http://0.0.0.0:${PORT}`);
                resolve(true);
            });
            
            server.on('error', (err) => {
                reject(err);
            });
        });
    },

    stop: () => {
        return new Promise((resolve, reject) => {
            if (!server) {
                resolve(false);
                return;
            }
            server.close((err) => {
                if (err) {
                    reject(err);
                    return;
                }
                console.log('Server Stopped.');
                server = null;
                resolve(false);
            });
        });
    },

    isRunning: () => {
        return !!server;
    }
};

module.exports = serverManager;
