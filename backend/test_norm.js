const { normalizePhone } = require('./src/utils/phoneUtils');

const testCases = [
    '233049237246111',
    '6601515733148',
    '231408710758539',
    '30155183550673@lid'
];

for (const t of testCases) {
    console.log(`${t} -> ${normalizePhone(t)}`);
}
