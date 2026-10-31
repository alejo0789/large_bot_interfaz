import React, { useState } from 'react';
import { Check, CheckCheck, ChevronRight, Clock3, Inbox, Lock, MessageCircle, MoreHorizontal, Plus, Send, ShieldCheck, Sparkles, User, X } from 'lucide-react';
import './TikTokPrototype.css';

const starterMessages = [
    {
        id: 1,
        direction: 'in',
        text: 'Hola, vi sus videos y quisiera saber qué opciones tienen para alisar mi cabello.',
        time: '10:32 a. m.'
    },
    {
        id: 2,
        direction: 'out',
        text: '¡Hola, Valentina! 💚 Con gusto te orientamos. ¿Cómo es tu cabello y en qué sede te gustaría atenderte?',
        time: '10:34 a. m.'
    },
    {
        id: 3,
        direction: 'in',
        text: 'Es ondulado y estoy en Bogotá. ¿Me pueden contar cuánto dura el proceso?',
        time: '10:37 a. m.'
    }
];

const TikTokPrototype = () => {
    const [connected, setConnected] = useState(false);
    const [showConsent, setShowConsent] = useState(false);
    const [messages, setMessages] = useState(starterMessages);
    const [draft, setDraft] = useState('');
    const [notice, setNotice] = useState('');

    const connectDemo = () => {
        setConnected(true);
        setShowConsent(false);
        setNotice('Cuenta conectada en esta demostración. No se contactó TikTok.');
        window.setTimeout(() => setNotice(''), 4000);
    };

    const addIncomingMessage = () => {
        setMessages((current) => [...current, {
            id: Date.now(),
            direction: 'in',
            text: '¿Tienen disponibilidad este fin de semana? 😊',
            time: 'Ahora'
        }]);
        setNotice('Mensaje entrante simulado agregado a la bandeja.');
        window.setTimeout(() => setNotice(''), 4000);
    };

    const sendReply = (event) => {
        event.preventDefault();
        const text = draft.trim();
        if (!text || !connected) return;
        setMessages((current) => [...current, {
            id: Date.now(),
            direction: 'out',
            text,
            time: 'Ahora'
        }]);
        setDraft('');
        setNotice('Respuesta simulada. No se envió a TikTok.');
        window.setTimeout(() => setNotice(''), 4000);
    };

    const resetDemo = () => {
        setConnected(false);
        setMessages(starterMessages);
        setDraft('');
        setNotice('Demostración reiniciada.');
        window.setTimeout(() => setNotice(''), 4000);
    };

    return (
        <main className="tt-proto-page">
            <header className="tt-proto-topbar">
                <div className="tt-proto-brand">
                    <div className="tt-proto-brand-mark"><MessageCircle size={21} /></div>
                    <div>
                        <strong>Large CRM</strong>
                        <span>Customer conversations</span>
                    </div>
                </div>
                <div className="tt-proto-demo-pill"><span /> PROTOTYPE · SIMULATED DATA</div>
                <button className="tt-proto-reset" onClick={resetDemo}>Reset demo</button>
            </header>

            <section className="tt-proto-intro">
                <div>
                    <div className="tt-proto-eyebrow">TIKTOK BUSINESS MESSAGING</div>
                    <h1>Customer messages, together in one inbox.</h1>
                    <p>Review the planned account authorization, incoming message, and agent reply flow.</p>
                </div>
                <div className="tt-proto-prototype-note"><ShieldCheck size={18} /> This is a prototype. No live TikTok account or API is connected.</div>
            </section>

            <section className="tt-proto-workspace">
                <aside className="tt-proto-sidebar">
                    <div className="tt-proto-sidebar-head">
                        <div><span className="tt-proto-eyebrow">WORKSPACE</span><h2>Club de Alisados Large</h2></div>
                        <MoreHorizontal size={20} />
                    </div>
                    <div className="tt-proto-inbox-title"><Inbox size={17} /> Inbox <span>1</span></div>
                    <div className="tt-proto-filter">All conversations <ChevronRight size={15} /></div>
                    <div className="tt-proto-contact active">
                        <div className="tt-proto-avatar">V</div>
                        <div className="tt-proto-contact-copy">
                            <div><strong>Valentina R.</strong><time>10:37</time></div>
                            <p>¿Me pueden contar cuánto dura…</p>
                            <span className="tt-proto-channel-tag"><i /> TikTok</span>
                        </div>
                    </div>
                    <div className="tt-proto-sidebar-foot"><Lock size={14} /> Private workspace for authorized staff</div>
                </aside>

                <section className="tt-proto-thread">
                    <div className="tt-proto-thread-head">
                        <div className="tt-proto-avatar">V</div>
                        <div className="tt-proto-thread-person"><strong>Valentina R.</strong><span>TikTok · Customer conversation</span></div>
                        <span className="tt-proto-open-status"><i /> Open</span>
                        <button className="tt-proto-more" aria-label="More conversation options"><MoreHorizontal size={20} /></button>
                    </div>

                    <div className="tt-proto-messages">
                        <div className="tt-proto-date">TODAY</div>
                        {messages.map((message) => (
                            <div className={`tt-proto-message-row ${message.direction === 'out' ? 'outgoing' : ''}`} key={message.id}>
                                {message.direction === 'in' && <div className="tt-proto-avatar small">V</div>}
                                <div className="tt-proto-message-wrap">
                                    <div className="tt-proto-bubble">{message.text}</div>
                                    <div className="tt-proto-message-time">{message.time} {message.direction === 'out' && <CheckCheck size={14} />}</div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="tt-proto-thread-actions">
                        <button onClick={addIncomingMessage}><Plus size={16} /> Simulate incoming message</button>
                        <span><Clock3 size={14} /> Replies follow TikTok messaging limits</span>
                    </div>
                    <form className="tt-proto-composer" onSubmit={sendReply}>
                        <textarea
                            value={draft}
                            onChange={(event) => setDraft(event.target.value)}
                            placeholder={connected ? 'Write a reply to Valentina…' : 'Connect the demo account to try a reply'}
                            disabled={!connected}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter' && !event.shiftKey) {
                                    event.preventDefault();
                                    sendReply(event);
                                }
                            }}
                        />
                        <div className="tt-proto-composer-foot"><span>Replies are sent from the authorized business account.</span>
                            <button type="submit" disabled={!connected || !draft.trim()} aria-label="Send simulated reply"><Send size={17} /></button>
                        </div>
                    </form>
                </section>

                <aside className="tt-proto-details">
                    <div className="tt-proto-details-heading"><span className="tt-proto-tiktok-mark">♪</span><div><strong>TikTok account</strong><span>Business Messaging</span></div></div>
                    <div className={`tt-proto-connection-card ${connected ? 'connected' : ''}`}>
                        <div className="tt-proto-connection-state"><i />{connected ? 'Connected in prototype' : 'Not connected'}</div>
                        <strong>{connected ? '@clubalisadoslarge' : 'Connect a business account'}</strong>
                        <p>{connected ? 'Authorized business workspace' : 'An administrator authorizes the TikTok Business account before messages are available.'}</p>
                        <button onClick={() => setShowConsent(true)}>{connected ? <><Check size={16} /> Demo account authorized</> : 'Connect TikTok Business'}</button>
                    </div>
                    <div className="tt-proto-scope-card">
                        <h3>Planned permissions</h3>
                        <div><Check size={15} /><span>Receive direct-message events</span></div>
                        <div><Check size={15} /><span>View authorized conversations</span></div>
                        <div><Check size={15} /><span>Reply to customer messages</span></div>
                        <div><Check size={15} /><span>Receive webhook updates</span></div>
                    </div>
                    <div className="tt-proto-value-card"><Sparkles size={17} /><p><strong>One support workflow</strong><br />Teams can manage TikTok conversations alongside other customer support channels.</p></div>
                    <div className="tt-proto-data-note"><Lock size={14} /> Customer messages are used only to provide support in the authorized workspace.</div>
                </aside>
            </section>

            <footer className="tt-proto-footer">
                <span><ShieldCheck size={15} /> Prototype for API review · All names and messages are fictional</span>
                <span>Authorization, webhooks, and replies shown here are simulated</span>
            </footer>

            {notice && <div className="tt-proto-toast"><Check size={16} />{notice}</div>}

            {showConsent && (
                <div className="tt-proto-modal-backdrop" role="presentation" onClick={() => setShowConsent(false)}>
                    <section className="tt-proto-consent-modal" role="dialog" aria-modal="true" aria-labelledby="tt-consent-title" onClick={(event) => event.stopPropagation()}>
                        <button className="tt-proto-modal-close" onClick={() => setShowConsent(false)} aria-label="Close"><X size={19} /></button>
                        <div className="tt-proto-consent-icon"><User size={23} /></div>
                        <span className="tt-proto-eyebrow">SIMULATED AUTHORIZATION</span>
                        <h2 id="tt-consent-title">Connect a TikTok Business account</h2>
                        <p>This prototype represents TikTok's account authorization step. No credentials are requested or sent.</p>
                        <div className="tt-proto-account-choice"><span className="tt-proto-tiktok-mark">♪</span><div><strong>Club de Alisados Large</strong><span>@clubalisadoslarge · Business account</span></div><Check size={17} /></div>
                        <div className="tt-proto-consent-list">
                            <div><Check size={15} /> Receive and view customer direct messages</div>
                            <div><Check size={15} /> Reply to customers in their conversations</div>
                            <div><Check size={15} /> Send message events to the CRM inbox</div>
                        </div>
                        <div className="tt-proto-consent-warning"><Lock size={15} /> Only the selected business account is represented in this demo.</div>
                        <button className="tt-proto-authorize-button" onClick={connectDemo}>Authorize demo account</button>
                        <button className="tt-proto-cancel-button" onClick={() => setShowConsent(false)}>Cancel</button>
                    </section>
                </div>
            )}
        </main>
    );
};

export default TikTokPrototype;
