
const { config } = require('./src/config/app');
const fs = require('fs');
const path = require('path');

console.log('UPLOAD_DIR:', config.uploadDir);
console.log('Exists:', fs.existsSync(config.uploadDir));
if (fs.existsSync(config.uploadDir)) {
    console.log('Files:', fs.readdirSync(config.uploadDir).slice(0, 5));
}
