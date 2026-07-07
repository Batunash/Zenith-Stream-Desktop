const path = require('path');
const os = require('os');
require('dotenv').config({
  path: path.resolve(__dirname, '../.env'),
});

const config = {
  MEDIA_DIR: process.env.MEDIA_DIR
    ? path.resolve(process.env.MEDIA_DIR)
    : path.join(os.homedir(), 'Desktop', 'Archive'),
};

module.exports = config;
