const path = require('path');
require('dotenv').config({ 
    path: path.resolve(__dirname, '.env') 
}); 
const config={
    MEDIA_DIR: path.resolve(process.env.MEDIA_DIR)
}

module.exports = config;