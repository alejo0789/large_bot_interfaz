const fs = require('fs');
const content = fs.readFileSync('c:\\Users\\alejandro.carvajal\\Documents\\large\\chatbot\\large_bot_interfaz\\frontend\\src\\App.jsx', 'utf8');
const lines = content.split('\n');
lines.forEach((line, index) => {
    if (line.includes('activeTab') || line.includes('activeView')) {
        console.log(`${index + 1}: ${line.trim()}`);
    }
});
