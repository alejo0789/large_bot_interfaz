// Run: node --test tests/instagramMessages.test.js (no network or database required).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { getIncomingMessageParts } = require('../src/utils/instagramMessages');

const image = { type: 'image', payload: { url: 'https://lookaside.fbsbx.com/ig_messaging_cdn/?asset_id=123' } };

function loadWebhook() {
    const saved = [], emitted = [], seen = new Set(), rooms = [];
    let unread = 0;
    let failId;
    const tenant = { id: 'tenant-a', slug: 'workspace-a', db_url: 'unused' };
    const db = { query: async (_, params) => ({ rows: seen.has(params[0]) ? [{}] : [] }) };
    const routers = [];
    const mocks = {
        express: { Router: () => {
            const handlers = {};
            const router = {
                handlers,
                get: (url, ...callbacks) => { handlers[`GET ${url}`] = callbacks.at(-1); },
                post: (url, ...callbacks) => { handlers[`POST ${url}`] = callbacks.at(-1); }
            };
            routers.push(router);
            return router;
        } },
        '../middleware/jwtAuth': () => {},
        '../services/instagramService': {
            verifyWebhookSignature: () => true,
            getConnectionByInstagramId: async () => ({ tenant_id: tenant.id })
        },
        '../services/tenantService': { getTenantById: async () => tenant },
        '../services/conversationService': {
            getByPhone: async () => ({ contact_name: '@customer' }),
            upsert: async () => {}, updateLastMessage: async () => {},
            incrementUnread: async () => { unread++; }
        },
        '../services/messageService': { create: async message => {
            if (message.whatsappId === failId) throw new Error('Simulated database failure');
            saved.push(message);
            seen.add(message.whatsappId);
            return { id: saved.length, timestamp: '2026-11-16T15:00:00.000Z' };
        } },
        '../config/database': { dbManager: { getPool: async () => db } },
        '../utils/tenantContext': { tenantContext: { run: async (context, callback) => {
            assert.equal(context.tenant.id, tenant.id);
            return callback();
        } } },
        '../utils/phoneUtils': { normalizePhone: phone => phone, getPureDigits: phone => phone.replace(/\D/g, '') },
        '../config/app': { config: {} },
        '../utils/instagramMessages': { getIncomingMessageParts }
    };
    const module = { exports: {} };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/routes/instagram.js'), 'utf8'), {
        module, exports: module.exports, require: name => {
            assert.ok(Object.hasOwn(mocks, name), `Unexpected dependency: ${name}`);
            return mocks[name];
        }, process: { env: {} }, URL, console: { info() {}, warn() {}, error() {} }
    });
    return {
        saved, emitted, rooms, get unread() { return unread; },
        setFailure: id => { failId = id; },
        receive: async message => {
            let status;
            await routers[1].handlers['POST /']({
                body: { object: 'instagram', entry: [{ id: 'account-a', messaging: [{
                    sender: { id: '123' }, timestamp: 1794841200000, message
                }] }] },
                get: () => '', app: { get: () => ({ to: room => {
                    rooms.push(room);
                    return { emit: (event, data) => emitted.push({ room, event, data }) };
                } }) }
            }, { sendStatus: code => { status = code; } });
            return status;
        }
    };
}

test('incoming image is persisted and broadcast with the URL, type and database ID', async () => {
    const route = loadWebhook();
    assert.equal(await route.receive({ mid: 'ig-1', attachments: [image] }), 200);
    assert.equal(route.saved[0].mediaUrl, image.payload.url);
    assert.equal(route.saved[0].mediaType, 'image');
    assert.equal(route.saved[0].text, null);
    assert.equal(route.saved[0].phone, 'instagram_123');
    const event = route.emitted.find(item => item.event === 'new-message');
    assert.equal(event.data.media_url, image.payload.url);
    assert.equal(event.data.media_type, 'image');
    assert.equal(event.data.id, 1);
    assert.equal(event.data.timestamp, '2026-11-16T15:00:00.000Z');
    assert.equal(event.room, 'tenant:workspace-a:conversation:123');
    assert.equal(route.unread, 1);
});

test('multiple attachments retain captions and are not duplicated by webhook retries', async () => {
    const route = loadWebhook();
    const message = { mid: 'ig-many', text: 'Fotos', attachments: [image, image] };
    assert.equal(await route.receive(message), 200);
    assert.equal(await route.receive(message), 200);
    assert.equal(route.saved.length, 2);
    assert.equal(route.saved[0].text, 'Fotos');
    assert.equal(route.saved[1].text, null);
    assert.equal(route.saved[1].whatsappId, 'ig-many:attachment:1');
    assert.equal(route.unread, 1);
});

test('retry after a partial database failure recovers the remaining attachment', async () => {
    const route = loadWebhook();
    const message = { mid: 'ig-retry', attachments: [image, image] };
    route.setFailure('ig-retry:attachment:1');
    assert.equal(await route.receive(message), 500);
    route.setFailure(null);
    assert.equal(await route.receive(message), 200);
    assert.equal(route.saved.length, 2);
    assert.equal(route.unread, 1);
});

test('text-only messages and unsupported attachments remain readable', async () => {
    const route = loadWebhook();
    await route.receive({ mid: 'ig-text', text: 'Hola' });
    assert.equal(route.saved[0].text, 'Hola');
    assert.equal(route.saved[0].mediaUrl, null);
    for (const attachment of [null, { type: 'image' }, { type: 'share', payload: { url: 'https://instagram.com/p/123' } }, { type: 'image', payload: { url: 'javascript:alert(1)' } }]) {
        const [part] = getIncomingMessageParts({ attachments: [attachment] }, 'fallback');
        assert.match(part.text, /Adjunto de Instagram/);
        assert.equal(part.mediaUrl, null);
    }
});

test('video, audio and file URLs use the existing chat media types', () => {
    for (const type of ['video', 'audio', 'file']) {
        const [part] = getIncomingMessageParts({ attachments: [{ ...image, type }] }, 'media');
        assert.equal(part.mediaType, type);
        assert.equal(part.mediaUrl, image.payload.url);
    }
});
