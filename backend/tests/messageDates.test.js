// Run: node --test tests/messageDates.test.js. No database or network calls.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { parseMessageTimestamp } = require('../src/utils/messageTimestamp');

const instant = '2026-11-16T04:30:00.000Z'; // November 15, 23:30 in Colombia.
const seconds = Date.parse(instant) / 1000;

function frontendDates() {
    const NativeDate = Date;
    class FixedDate extends NativeDate {
        constructor(...args) { super(...(args.length ? args : ['2026-11-16T05:10:00Z'])); }
        static now() { return NativeDate.parse('2026-11-16T05:10:00Z'); }
    }
    const source = fs.readFileSync(path.join(__dirname, '../../frontend/src/utils/dateUtils.js'), 'utf8');
    const context = vm.createContext({ Date: FixedDate, Intl, console });
    vm.runInContext(source.replace(/export const /g, 'var '), context);
    return context;
}

test('provider seconds, milliseconds, strings, and protobuf Long preserve the same instant', () => {
    for (const value of [seconds, seconds * 1000, String(seconds), instant,
        '2026-11-15T23:30:00-05:00', '2026-11-16 04:30:00+00',
        { low: seconds, high: 0 }, new Date(instant)]) {
        assert.equal(parseMessageTimestamp(value).toISOString(), instant);
    }
});

test('legacy timestamps are UTC independently of the server zone; malformed values stay unknown', () => {
    assert.equal(parseMessageTimestamp('2026-11-16 04:30:00').toISOString(), instant);
    for (const value of [undefined, null, '', 'bad date', '23:30', {}, NaN, Infinity, -1]) {
        assert.equal(parseMessageTimestamp(value), null);
    }
});

test('chat clocks and date keys use Colombia around midnight', () => {
    const dates = frontendDates();
    assert.equal(dates.formatTime(instant), '23:30');
    assert.equal(dates.getDateKey(instant), '2026-11-15');
    assert.equal(dates.formatTime('2026-11-16T05:00:00Z'), '00:00');
    assert.equal(dates.getDateKey('2026-11-16T05:00:00Z'), '2026-11-16');
    assert.equal(dates.formatTime('2026-11-15T23:30:00-05:00'), '23:30');
});

test('Hoy, Ayer and sidebar dates share the Colombian calendar', () => {
    const dates = frontendDates();
    assert.equal(dates.formatDateGroup(instant), 'Ayer');
    assert.equal(dates.getShortDate(instant), 'Ayer');
    assert.equal(dates.formatDateGroup('2026-11-16T05:01:00Z'), 'Hoy');
    assert.equal(dates.getShortDate('2026-11-16T05:01:00Z'), '');
    assert.equal(dates.getShortDate('2026-11-15T04:30:00Z'), '14/11/26');
    assert.match(dates.formatDateGroup('2026-01-01T03:00:00Z'), /2025/);
});

test('date groups never combine different Colombian days within the same UTC day', () => {
    const dates = frontendDates();
    const grouped = dates.groupMessagesByDate([
        { id: 1, rawTimestamp: instant },
        { id: 2, rawTimestamp: '2026-11-16T04:59:00Z' },
        { id: 3, rawTimestamp: '2026-11-16T05:00:00Z' },
        { id: 4, timestamp: '23:30' }
    ]);
    assert.equal(grouped['2026-11-15'].messages.length, 2);
    assert.equal(grouped['2026-11-15'].label, 'Ayer');
    assert.equal(grouped['2026-11-16'].messages.length, 1);
    assert.equal(grouped['2026-11-16'].label, 'Hoy');
    assert.equal(grouped.unknown.label, 'Sin fecha');
});

test('frontend handles seconds and legacy UTC values without guessing a date from HH:MM', () => {
    const dates = frontendDates();
    for (const value of [seconds, seconds * 1000, String(seconds), '2026-11-16 04:30:00', '2026-11-16 04:30:00+00']) {
        assert.equal(dates.formatTime(value), '23:30');
    }
    assert.equal(dates.formatTime('23:30'), '');
    assert.equal(dates.getDateKey('invalid'), 'unknown');
});

function loadService(file, mocks) {
    const module = { exports: {} };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/services', file), 'utf8'), {
        module, exports: module.exports, Date, console,
        require: name => {
            assert.ok(Object.hasOwn(mocks, name), `Unexpected dependency: ${name}`);
            return mocks[name];
        }
    });
    return module.exports;
}

test('saved history displays the original instant and supports string pagination cursors', async () => {
    const service = loadService('messageService.js', {
        '../config/database': { pool: { query: async () => ({ rows: [{
            id: 1, timestamp: '2026-11-16 04:30:00+00', text_content: 'Hola', sender: 'user'
        }] }) } },
        '../utils/messageTimestamp': { parseMessageTimestamp }
    });
    const result = await service.getByConversation('573000000000');
    assert.equal(result.data[0].timestamp, '23:30');
    assert.equal(result.data[0].rawTimestamp, instant);
    assert.equal(result.pagination.oldestCursor, instant);
});

test('message writes normalize provider seconds and reject invalid timestamps', async () => {
    let savedParams;
    const service = loadService('messageService.js', {
        '../config/database': { pool: { query: async (_, params) => {
            savedParams = params;
            return { rows: [{ id: 1, timestamp: instant }] };
        } } }, '../utils/messageTimestamp': { parseMessageTimestamp }
    });
    await service.create({ phone: '573000000000', sender: 'user', text: 'Hola', timestamp: seconds });
    assert.equal(savedParams[7], instant);
    await assert.rejects(service.create({ timestamp: 'invalid' }), /Invalid message timestamp/);
});

test('conversation preview uses event time and protects newer previews from history imports', async () => {
    let query, params;
    const service = loadService('conversationService.js', {
        '../config/database': { pool: { query: async (sql, args) => { query = sql; params = args; } } },
        './settingsService': {}, '../utils/phoneUtils': { normalizePhone: value => value }
    });
    await service.updateLastMessage('573000000000', 'Hola', false, instant);
    assert.equal(params[3], instant);
    assert.match(query, /last_message_timestamp = COALESCE\(\$4::timestamptz, NOW\(\)\)/);
    assert.match(query, /last_message_timestamp <= COALESCE/);
});

test('delayed Evolution webhooks keep provider time in storage, preview and live events', async () => {
    let handler, saved, preview;
    const emitted = [], errors = [];
    const conversation = { contact_name: 'Cliente', ai_enabled: false };
    const mocks = {
        express: { Router: () => ({ post: (_, callback) => { handler = callback; } }) },
        '../utils/messageTimestamp': { parseMessageTimestamp },
        '../services/messageService': {
            getMessageById: async () => null,
            create: async message => { saved = message; return { id: 1, timestamp: message.timestamp }; }
        },
        '../services/conversationService': {
            getByPhone: async () => conversation, upsert: async () => conversation,
            updateLastMessage: async (...args) => { preview = args; }, incrementUnread: async () => {}
        },
        '../services/whatsappFactory': {}, '../services/n8nService': {},
        '../services/settingsService': {}, '../services/tagService': {}, '../utils/fileUtils': {},
        '../utils/phoneUtils': {
            normalizePhone: value => value.split('@')[0], getPureDigits: value => value.replace(/\D/g, '')
        },
        '../utils/tenantContext': { tenantContext: { getStore: () => ({ tenant: { slug: 'test' } }) } }
    };
    const module = { exports: {} };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/routes/evolution.js'), 'utf8'), {
        module, exports: module.exports, Date, global: {},
        console: { log() {}, warn() {}, error: (...args) => errors.push(args) },
        require: name => { assert.ok(Object.hasOwn(mocks, name), name); return mocks[name]; }
    });
    module.exports.setSocketIO({ to: () => ({ emit: (event, data) => emitted.push({ event, data }) }) });
    await handler({ body: { event: 'messages.upsert', data: {
        key: { remoteJid: '573000000000@s.whatsapp.net', id: 'delayed-1', fromMe: false },
        messageTimestamp: seconds, message: { conversation: 'Mensaje anterior' }
    } } }, { json() {}, sendStatus() {} });
    assert.equal(errors.length, 0, JSON.stringify(errors));
    assert.equal(saved.timestamp, instant);
    assert.equal(preview[3], instant);
    assert.equal(emitted.find(item => item.event === 'new-message').data.timestamp, instant);
});
