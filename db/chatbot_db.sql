--
-- PostgreSQL database dump
--

\restrict qez9voUUcZO5B21hKd9q1Aye3ufXlInOugvetkgOK05zUftVeUzNtAaF4TKgC6D

-- Dumped from database version 18.1
-- Dumped by pg_dump version 18.1

-- Started on 2025-12-14 16:16:02

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 2 (class 3079 OID 17782)
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- TOC entry 5069 (class 0 OID 0)
-- Dependencies: 2
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 224 (class 1259 OID 17844)
-- Name: conversation_tags; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.conversation_tags (
    conversation_phone character varying(50) NOT NULL,
    tag_id integer NOT NULL,
    assigned_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.conversation_tags OWNER TO postgres;

--
-- TOC entry 220 (class 1259 OID 17793)
-- Name: conversations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.conversations (
    phone character varying(50) NOT NULL,
    contact_name character varying(255),
    profile_pic_url text,
    status character varying(20) DEFAULT 'active'::character varying,
    conversation_state character varying(50) DEFAULT 'ai_active'::character varying,
    ai_enabled boolean DEFAULT true,
    agent_id character varying(50),
    taken_by_agent_at timestamp with time zone,
    unread_count integer DEFAULT 0,
    last_message_text text,
    last_message_timestamp timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.conversations OWNER TO postgres;

--
-- TOC entry 221 (class 1259 OID 17807)
-- Name: messages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.messages (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    whatsapp_id character varying(255),
    conversation_phone character varying(50),
    sender character varying(20) NOT NULL,
    sender_type character varying(20) DEFAULT 'text'::character varying,
    text_content text,
    media_url text,
    media_type text,
    status character varying(20) DEFAULT 'delivered'::character varying,
    "timestamp" timestamp with time zone DEFAULT now(),
    is_internal_note boolean DEFAULT false
);


ALTER TABLE public.messages OWNER TO postgres;

--
-- TOC entry 223 (class 1259 OID 17832)
-- Name: tags; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tags (
    id integer NOT NULL,
    name character varying(50) NOT NULL,
    color character varying(20) DEFAULT '#808080'::character varying,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.tags OWNER TO postgres;

--
-- TOC entry 222 (class 1259 OID 17831)
-- Name: tags_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.tags_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tags_id_seq OWNER TO postgres;

--
-- TOC entry 5070 (class 0 OID 0)
-- Dependencies: 222
-- Name: tags_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.tags_id_seq OWNED BY public.tags.id;


--
-- TOC entry 4890 (class 2604 OID 17835)
-- Name: tags id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tags ALTER COLUMN id SET DEFAULT nextval('public.tags_id_seq'::regclass);


--
-- TOC entry 5063 (class 0 OID 17844)
-- Dependencies: 224
-- Data for Name: conversation_tags; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.conversation_tags (conversation_phone, tag_id, assigned_at) FROM stdin;
+573005551234	3	2025-12-12 17:11:16.537182-05
\.


--
-- TOC entry 5059 (class 0 OID 17793)
-- Dependencies: 220
-- Data for Name: conversations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.conversations (phone, contact_name, profile_pic_url, status, conversation_state, ai_enabled, agent_id, taken_by_agent_at, unread_count, last_message_text, last_message_timestamp, created_at, updated_at) FROM stdin;
+573008889999	José Ñoño Pérez	\N	active	ai_active	t	\N	\N	2	¿El señor Peñaloza está disponible?	2025-12-12 16:49:58.970978-05	2025-12-11 17:04:58.970978-05	2025-12-12 17:04:58.970978-05
+573009876543	Carlos López Ordóñez	\N	active	ai_active	f	\N	\N	0	¿A qué hora abren mañana?	2025-12-12 16:04:58.970978-05	2025-12-11 17:04:58.970978-05	2025-12-12 17:04:58.970978-05
+573007778899	Pedro Sánchez Ibáñez	\N	active	ai_active	t	\N	\N	0	Perfecto, nos vemos mañana	2025-12-12 15:04:58.970978-05	2025-12-12 12:04:58.970978-05	2025-12-12 17:04:58.970978-05
+573006665544	Lucía Fernández Ávila	\N	active	ai_active	t	\N	\N	0	Excelente atención, muchas gracias	2025-12-12 13:04:58.970978-05	2025-12-10 17:04:58.970978-05	2025-12-12 17:04:58.970978-05
+573003332211	Andrés Piñeiro Castaño	\N	active	ai_active	f	\N	\N	0	Ya realicé el pago, quedo atento	2025-12-12 11:04:58.970978-05	2025-12-09 17:04:58.970978-05	2025-12-12 17:04:58.970978-05
+573005551234	Ana María Martínez	\N	active	ai_active	t	\N	\N	0	Gracias por la información	2025-12-12 16:34:58.970978-05	2025-12-12 14:04:58.970978-05	2025-12-12 17:13:06.182998-05
+573001112233	Laura Rodríguez Muñoz	\N	active	ai_active	f	\N	\N	0	📎 audio_1765579236873.webm	2025-12-12 17:40:36.933223-05	2025-12-05 17:04:58.970978-05	2025-12-12 17:40:36.933223-05
+573001234567	María García Peña	\N	active	ai_active	t	\N	\N	0	dffdfdffdfdfdfddfdfdddfdfdfdfdfdfdfdfdfdf👎😀	2025-12-12 17:36:53.063789-05	2025-12-10 17:04:58.970978-05	2025-12-12 17:43:38.023308-05
\.


--
-- TOC entry 5060 (class 0 OID 17807)
-- Dependencies: 221
-- Data for Name: messages; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.messages (id, whatsapp_id, conversation_phone, sender, sender_type, text_content, media_url, media_type, status, "timestamp", is_internal_note) FROM stdin;
f03d5c8e-0350-4a08-b66a-daec4b4249be	\N	+573001234567	user	text	Hola, buenas tardes señor	\N	\N	delivered	2025-12-10 17:04:58.983626-05	f
9d1ca4aa-6591-4db6-87e4-7d996bd99504	\N	+573001234567	bot	text	¡Hola María! Bienvenida. ¿En qué puedo ayudarte?	\N	\N	delivered	2025-12-10 17:05:58.983626-05	f
3781a413-b2a9-4bad-a2d8-09df6763ae11	\N	+573001234567	user	text	Quiero saber sobre sus servicios de diseño	\N	\N	delivered	2025-12-11 17:04:58.983626-05	f
10736074-c303-4807-a127-2a47fdf01ac1	\N	+573001234567	bot	text	Con gusto te cuento. Ofrecemos diseño gráfico y web.	\N	\N	delivered	2025-12-11 17:05:28.983626-05	f
c83b62cc-be65-4eca-a6c4-798b02ec0547	\N	+573001234567	user	text	¡Hola! ¿Cómo están hoy?	\N	\N	delivered	2025-12-12 16:59:58.983626-05	f
0c288555-d5f4-4ae5-b1e2-ca1cdf2cc394	\N	+573009876543	user	text	Buenos días, ¿cómo están?	\N	\N	delivered	2025-12-11 17:04:58.997918-05	f
898e66d4-7c94-4855-95f6-3a6a52b89162	\N	+573009876543	agent	text	Hola Carlos, ¡muy bien! ¿En qué te puedo ayudar?	\N	\N	delivered	2025-12-11 17:06:58.997918-05	f
a518f379-978f-4432-8a5c-e422625e79c1	\N	+573009876543	user	text	¿A qué hora abren mañana?	\N	\N	delivered	2025-12-12 16:04:58.997918-05	f
75bbfaf5-0bfa-4fb4-a749-1a1521415015	\N	+573005551234	user	text	¿Cuáles son los precios del año?	\N	\N	delivered	2025-12-12 14:04:59.011049-05	f
eef483b0-4ad8-458d-878b-2b76c5ec0042	\N	+573005551234	bot	text	Nuestros planes empiezan desde .000. ¡Súper económico!	\N	\N	delivered	2025-12-12 14:05:09.011049-05	f
03673095-d084-4211-b8b5-4b9d789e4e9e	\N	+573005551234	user	text	¿Tienen plan empresarial con señal rápida?	\N	\N	delivered	2025-12-12 15:04:59.011049-05	f
7282b666-d3d8-47e5-ba04-810f4099d7a1	\N	+573005551234	bot	text	Sí, tenemos planes especiales para empresas pequeñas y grandes.	\N	\N	delivered	2025-12-12 15:05:04.011049-05	f
7d61c89c-0b63-4e50-a302-f2bcfdd7598f	\N	+573005551234	user	text	Gracias por la información	\N	\N	delivered	2025-12-12 16:34:59.011049-05	f
e9c7a0dc-b94f-4cfa-a82f-b3b48e4d80f8	\N	+573007778899	user	text	Necesito agendar una cita con el señor Peñaloza	\N	\N	delivered	2025-12-12 12:04:59.026119-05	f
963ed647-da3d-4474-83b3-01227ff958bf	\N	+573007778899	bot	text	¿Para cuándo te gustaría la cita? Tenemos disponibilidad mañana.	\N	\N	delivered	2025-12-12 12:05:14.026119-05	f
61d9220e-adfd-4833-8a6c-0afdc2c19eb1	\N	+573007778899	user	text	Mañana a las 3pm estaría genial	\N	\N	delivered	2025-12-12 14:04:59.026119-05	f
98518d85-0b45-423e-bd68-cfbaa81178fa	\N	+573007778899	agent	text	Listo Pedro, tu cita está agendada para mañana a las 3pm. ¡Excelente!	\N	\N	delivered	2025-12-12 14:05:59.026119-05	f
48babdca-edfc-48e3-b874-b6225cf1d7e6	\N	+573007778899	user	text	Perfecto, nos vemos mañana	\N	\N	delivered	2025-12-12 15:04:59.026119-05	f
3e0468fa-03d8-4a88-82a8-13616ebb11d0	\N	+573001112233	user	text	¡Hola! Buen día	\N	\N	delivered	2025-12-05 17:04:59.038398-05	f
a0dcc7e7-5140-4b3e-934f-6e3bcbd68aeb	\N	+573001112233	bot	text	¡Hola Laura! ¿Cómo te puedo ayudar hoy?	\N	\N	delivered	2025-12-05 17:05:04.038398-05	f
de2ae618-b6ce-4992-a540-83ff97b2ccbc	\N	+573001112233	user	text	Quiero información sobre el señor Ordóñez	\N	\N	delivered	2025-12-06 17:04:59.038398-05	f
a790ab54-f3b0-4b71-b18f-eccb8fc6303a	\N	+573001112233	user	text	¿Siguen ahí? Es urgente	\N	\N	delivered	2025-12-11 17:04:59.038398-05	f
96cf825c-658a-4c7e-be5c-01ab0b382c62	\N	+573001112233	user	text	¿Tienen disponibilidad para mañana?	\N	\N	delivered	2025-12-12 16:54:59.038398-05	f
064ac16d-42ce-4b5b-bc9e-aa79b2304152	\N	+573008889999	user	text	Buenas tardes, soy José Ñoño	\N	\N	delivered	2025-12-11 17:04:59.047084-05	f
7de44748-28cb-4912-878d-a505a28924e1	\N	+573008889999	bot	text	¡Hola José! Bienvenido. ¿En qué puedo asistirte?	\N	\N	delivered	2025-12-11 17:05:09.047084-05	f
276f3b39-d6e0-4b94-85c0-842c1d1eee1b	\N	+573008889999	user	text	¿El señor Peñaloza está disponible?	\N	\N	delivered	2025-12-12 16:49:59.047084-05	f
62de178c-6fcf-4ab5-abd4-fae2f30fe02f	\N	+573006665544	user	text	Hola, acabo de recibir mi pedido número 12345	\N	\N	delivered	2025-12-10 17:04:59.06162-05	f
f82b1c57-6796-4f5e-8b36-3957e54fc2a9	\N	+573006665544	agent	text	¡Qué alegría Lucía! ¿Todo llegó en buen estado?	\N	\N	delivered	2025-12-10 17:09:59.06162-05	f
a6ae974c-44e7-46fe-b7d7-f6b4d58a91df	\N	+573006665544	user	text	Sí, perfectamente. Muy rápido el envío	\N	\N	delivered	2025-12-10 17:14:59.06162-05	f
d1e254ac-3a14-4a1b-848f-60a5ef437b8b	\N	+573006665544	user	text	Excelente atención, muchas gracias	\N	\N	delivered	2025-12-12 13:04:59.06162-05	f
bb37f8e9-1a9c-442d-bbb4-067f6fff4d05	\N	+573003332211	user	text	Buenos días, quiero hacer un pago	\N	\N	delivered	2025-12-09 17:04:59.077948-05	f
ffc5095d-497c-4787-8a95-d20435e33258	\N	+573003332211	bot	text	Claro Andrés. Puedes pagar a la cuenta Bancolombia o Nequi.	\N	\N	delivered	2025-12-09 17:05:19.077948-05	f
5fd2df8c-4c77-44f3-b32d-af42465c9cdd	\N	+573003332211	user	text	¿El número de cuenta cuál es?	\N	\N	delivered	2025-12-09 17:09:59.077948-05	f
31e3a774-f125-4b19-be05-89d48183e8b4	\N	+573003332211	agent	text	El número es 123-456789-00 a nombre de Compañía XYZ S.A.S.	\N	\N	delivered	2025-12-09 17:14:59.077948-05	f
4ffc4653-8d6a-4f9e-910c-ff000baa01ab	\N	+573003332211	user	text	Ya realicé el pago, quedo atento	\N	\N	delivered	2025-12-12 11:04:59.077948-05	f
e89c8e4c-2392-4197-a90f-3367ff4c03a8	\N	+573001234567	agent	text	CreaciÃ³n_de_Video_Publicitario_de_Producto.mp4	http://localhost:4000/uploads/1765578025956-672032430.mp4	video	sending	2025-12-12 17:20:26.02602-05	f
15c590f9-a1ae-44e8-a7e7-617861aa4395	\N	+573001234567	agent	text	SOMOS TV-FESI 4927.pdf	http://localhost:4000/uploads/1765578045456-144393644.pdf	document	sending	2025-12-12 17:20:45.72068-05	f
004c9fd1-b3f9-4a88-bfb9-f3716fcc2c53	\N	+573001234567	agent	text	lizto.jpeg	http://localhost:4000/uploads/1765578055883-151607118.jpeg	image	sending	2025-12-12 17:20:56.020563-05	f
dd9b2624-f460-4d9a-9418-9fb2611de102	\N	+573001234567	agent	text	lizto.jpeg	http://localhost:4000/uploads/1765578180866-445249731.jpeg	image	sending	2025-12-12 17:23:00.898303-05	f
4dcdfa5e-1a04-42b2-8273-8760f9b4e47e	\N	+573001234567	agent	text	SOMOS TV-FESI 4927.pdf	http://localhost:4000/uploads/1765578268035-485378752.pdf	document	sending	2025-12-12 17:24:28.193016-05	f
2c5e741c-92c7-4ed1-9f7b-d447c4634315	\N	+573001234567	agent	text	audio_1765578442517.webm	http://localhost:4000/uploads/1765578442554-722784208.webm	audio	sending	2025-12-12 17:27:22.649718-05	f
2621b763-85ca-4e1e-853e-a694b4498419	\N	+573001234567	agent	text	audio_1765578516156.webm	http://localhost:4000/uploads/1765578516191-36113357.webm	audio	sending	2025-12-12 17:28:36.195275-05	f
de96eb50-da09-4558-9d21-201273c1b5ca	\N	+573001234567	agent	text	audio_1765578792971.webm	http://localhost:4000/uploads/1765578793004-930137797.webm	audio	sending	2025-12-12 17:33:13.121576-05	f
46125830-b449-45dd-8e74-e44008e4cfbb	\N	+573001234567	agent	text	dffdfdffdfdfdfddfdfdddfdfdfdfdfdfdfdfdfdf👎😀	http://localhost:4000/uploads/1765579012906-351706235.mp4	video	sending	2025-12-12 17:36:53.051226-05	f
703df08c-7c11-481e-ac8b-06cfb531e668	\N	+573001112233	agent	text	audio_1765579236873.webm	http://localhost:4000/uploads/1765579236915-696636799.webm	audio	sending	2025-12-12 17:40:36.919044-05	f
\.


--
-- TOC entry 5062 (class 0 OID 17832)
-- Dependencies: 223
-- Data for Name: tags; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.tags (id, name, color, created_at) FROM stdin;
1	Importante	#FF0000	2025-12-12 16:58:36.645405-05
2	Ventas	#00FF00	2025-12-12 16:58:36.645405-05
3	Soporte	#0000FF	2025-12-12 16:58:36.645405-05
4	Seguimiento	#FFA500	2025-12-12 16:58:36.645405-05
\.


--
-- TOC entry 5071 (class 0 OID 0)
-- Dependencies: 222
-- Name: tags_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.tags_id_seq', 4, true);


--
-- TOC entry 4908 (class 2606 OID 17851)
-- Name: conversation_tags conversation_tags_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversation_tags
    ADD CONSTRAINT conversation_tags_pkey PRIMARY KEY (conversation_phone, tag_id);


--
-- TOC entry 4895 (class 2606 OID 17806)
-- Name: conversations conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_pkey PRIMARY KEY (phone);


--
-- TOC entry 4900 (class 2606 OID 17820)
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- TOC entry 4902 (class 2606 OID 17822)
-- Name: messages messages_whatsapp_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_whatsapp_id_key UNIQUE (whatsapp_id);


--
-- TOC entry 4904 (class 2606 OID 17843)
-- Name: tags tags_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tags
    ADD CONSTRAINT tags_name_key UNIQUE (name);


--
-- TOC entry 4906 (class 2606 OID 17841)
-- Name: tags tags_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tags
    ADD CONSTRAINT tags_pkey PRIMARY KEY (id);


--
-- TOC entry 4896 (class 1259 OID 17830)
-- Name: idx_conversations_last_msg; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_conversations_last_msg ON public.conversations USING btree (last_message_timestamp);


--
-- TOC entry 4897 (class 1259 OID 17828)
-- Name: idx_messages_conversation; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_messages_conversation ON public.messages USING btree (conversation_phone);


--
-- TOC entry 4898 (class 1259 OID 17829)
-- Name: idx_messages_timestamp; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_messages_timestamp ON public.messages USING btree ("timestamp");


--
-- TOC entry 4910 (class 2606 OID 17852)
-- Name: conversation_tags conversation_tags_conversation_phone_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversation_tags
    ADD CONSTRAINT conversation_tags_conversation_phone_fkey FOREIGN KEY (conversation_phone) REFERENCES public.conversations(phone) ON DELETE CASCADE;


--
-- TOC entry 4911 (class 2606 OID 17857)
-- Name: conversation_tags conversation_tags_tag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversation_tags
    ADD CONSTRAINT conversation_tags_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.tags(id) ON DELETE CASCADE;


--
-- TOC entry 4909 (class 2606 OID 17823)
-- Name: messages messages_conversation_phone_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_conversation_phone_fkey FOREIGN KEY (conversation_phone) REFERENCES public.conversations(phone) ON DELETE CASCADE;


-- Completed on 2025-12-14 16:16:03

--
-- PostgreSQL database dump complete
--

\unrestrict qez9voUUcZO5B21hKd9q1Aye3ufXlInOugvetkgOK05zUftVeUzNtAaF4TKgC6D

