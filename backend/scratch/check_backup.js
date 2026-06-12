const fs = require('fs');
const path = require('path');

const files = [
    'c:\\Users\\alejandro.carvajal\\Documents\\large\\chatbot\\large_bot_interfaz\\backend\\db_backup_before_merge.sql',
    'c:\\Users\\alejandro.carvajal\\Documents\\large\\chatbot\\large_bot_interfaz\\backend\\backup_cali_data_only.sql',
    'c:\\Users\\alejandro.carvajal\\Documents\\large\\chatbot\\large_bot_interfaz\\backend\\backup_tenant_prod.sql'
];

for (const file of files) {
    if (fs.existsSync(file)) {
        const stats = fs.statSync(file);
        console.log(`File: ${path.basename(file)}`);
        console.log(`- Size: ${(stats.size / (1024 * 1024)).toFixed(2)} MB`);
        console.log(`- Mtime (Last modified): ${stats.mtime}`);
        console.log(`- Ctime: ${stats.ctime}`);
        console.log(`- Birthtime (Created): ${stats.birthtime}`);
    } else {
        console.log(`File: ${path.basename(file)} does not exist.`);
    }
}
