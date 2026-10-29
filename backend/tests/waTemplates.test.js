// Run: node --experimental-vm-modules --test tests/waTemplates.test.js
// All Meta requests, database writes and services are replaced with in-memory fakes.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');

const routePath = path.resolve(__dirname, '../src/routes/waTemplates.js');
const routeRequire = createRequire(routePath);
const source = fs.readFileSync(routePath, 'utf8');
const metaId = 'CO.28778540205129908';

function loadRoute(selectedContacts = []) {
    const requests = [], savedMessages = [], queries = [], conversations = [];
    const db = { query: async (sql, params) => {
        queries.push({ sql, params });
        if (sql.includes('FROM conversations')) return { rows: selectedContacts };
        if (sql.includes('RETURNING id')) return { rows: [{ id: 1 }] };
        return { rows: [] };
    } };
    const tenant = {
        slug: 'test', whatsapp_provider: 'official',
        wa_access_token: 'test-token', wa_phone_number_id: 'test-sender'
    };
    const handlers = {};
    const router = Object.fromEntries(['get', 'post', 'put', 'delete', 'patch'].map(method => [
        method, (url, ...callbacks) => { handlers[`${method} ${url}`] = callbacks.at(-1); }
    ]));
    const mocks = {
        express: { Router: () => router },
        '../utils/tenantContext': { tenantContext: { getStore: () => ({ tenant, db }) } },
        '../services/messageService': { create: async message => {
            savedMessages.push(message);
            return { ...message, id: 'local-message' };
        } },
        '../services/conversationService': {
            upsert: async phone => { conversations.push(phone); },
            updateLastMessage: async () => {}
        },
        '../middleware/upload': { upload: { single: () => () => {} } }
    };
    const module = { exports: {} };
    const context = vm.createContext({
        module, exports: module.exports,
        require: name => Object.hasOwn(mocks, name) ? mocks[name] : routeRequire(name),
        process: { env: {} }, console: { log() {}, error() {} }, setTimeout
    });
    const fetchModule = new vm.SyntheticModule(['default'], function () {
        this.setExport('default', async (url, options) => {
            requests.push({ url, body: JSON.parse(options.body) });
            return { ok: true, json: async () => ({ messages: [{ id: 'test-wamid' }] }) };
        });
    }, { context });
    const ready = (async () => {
        await fetchModule.link(() => {});
        await fetchModule.evaluate();
    })();
    new vm.Script(source, {
        filename: routePath,
        importModuleDynamically: async name => {
            assert.equal(name, 'node-fetch');
            await ready;
            return fetchModule;
        }
    }).runInContext(context);
    return {
        requests, savedMessages, queries, conversations,
        send: overrides => new Promise((resolve, reject) => {
            handlers['post /bulk-send']({
                tenant, db, app: { get: () => null },
                body: {
                    templateName: 'test_template', templateLanguage: 'es',
                    templateText: 'Hola', createCampaign: false, ...overrides
                }
            }, { json: resolve }, reject);
        })
    };
}

test('manual template preserves the Meta ID in the API and conversation', async () => {
    const route = loadRoute();
    const result = await route.send({ recipients: [{ phone: metaId }] });
    assert.equal(result.sent, 1);
    assert.equal(result.failed, 0);
    assert.equal(route.requests[0].body.recipient, metaId);
    assert.equal(Object.hasOwn(route.requests[0].body, 'to'), false);
    assert.equal(route.requests[0].body.type, 'template');
    assert.match(route.requests[0].url, /\/v22\.0\/test-sender\/messages$/);
    assert.equal(route.savedMessages[0].phone, metaId);
    assert.equal(route.conversations[0], metaId);
});

test('normal phone numbers keep using to, including local Colombian numbers', async () => {
    const route = loadRoute();
    const result = await route.send({ recipients: ['+573153404327', '3153404327', '+57 315-340-4327'] });
    assert.equal(result.sent, 3);
    for (const { body } of route.requests) {
        assert.equal(body.to, '573153404327');
        assert.equal(Object.hasOwn(body, 'recipient'), false);
    }
});

test('invalid IDs and Evolution LIDs never make an API request', async () => {
    const route = loadRoute();
    const recipients = ['28778540205129908@lid', '28778540205129908', 'CO.123oops',
        '1234567890@lid', '1234567890@g.us', 'tiktok_1234567890', '', '123'];
    const result = await route.send({ recipients });
    assert.equal(result.failed, recipients.length);
    assert.equal(route.requests.length, 0);
    assert.equal(route.savedMessages.length, 0);
});

for (const selectionMode of ['tag', 'all']) {
    test(`${selectionMode} selection sends Meta IDs and records them in campaigns`, async () => {
        const route = loadRoute([{ phone: metaId, name: 'Test contact' }]);
        const result = await route.send({ selectionMode, tagId: 7, createCampaign: true });
        assert.equal(result.sent, 1);
        assert.equal(route.requests[0].body.recipient, metaId);
        const campaignInsert = route.queries.find(q => q.sql.includes('INSERT INTO bulk_campaign_recipients'));
        assert.equal(campaignInsert.params[1], metaId);
        assert.equal(route.savedMessages[0].phone, metaId);
    });
}
