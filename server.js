// server.js – API + OpenAI, uses db.js for storage on MongoDB
require('dotenv').config();

const express = require('express');
const cors = require('cors');

const {
    connectToMongo,
    // users
    createUser,
    validateUser,
    findUserByEmail,
    // messages
    saveMessage,
    getMessagesByUser
} = require('./db');

const app = express();

// ---- Middleware ----
app.use(cors());
app.use(express.json({ limit: '50kb' }));

// ---- OpenAI config ----
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

// ---- Start server only after Mongo ready ----
async function startServer() {
    try {
        await connectToMongo();

        const PORT = process.env.PORT || 3001;
        const HOST = process.env.HOST || '0.0.0.0';
        const LOCAL_IP = process.env.LOCAL_IP || 'YOUR_IP';

        app.listen(PORT, HOST, () => {
            console.log(`\n🚀 Therapy server running!`);
            console.log(`📱 Local:   http://localhost:${PORT}`);
            console.log(`🌐 Network: http://${LOCAL_IP}:${PORT}`);
            console.log(`\n⚠️  Frontend API_URL should point to: http://${LOCAL_IP}:${PORT}\n`);
        });
    } catch (err) {
        console.error('Failed to start server:', err);
    }
}
startServer();

// ---- Health check ----
app.get('/', (req, res) => {
    res.json({ status: 'ok', message: 'API is running' });
});

// ============================================================
// AUTH ROUTES (Fixes your /api/login and /api/signup errors)
// ============================================================

// Signup
app.post('/api/signup', async (req, res) => {
    try {
        const { email, password, name } = req.body || {};
        if (!email || !password || !name) {
            return res.status(400).json({ error: 'Missing fields' });
        }

        const existing = await findUserByEmail(email);
        if (existing) {
            return res.status(409).json({ error: 'Email already exists' });
        }

        const userId = await createUser(email, password, name);
        return res.json({ id: userId, email, name, isNewUser: true });
    } catch (err) {
        console.error('Signup error:', err);
        return res.status(500).json({ error: 'Server error' });
    }
});

// Login
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body || {};
        if (!email || !password) {
            return res.status(400).json({ error: 'Missing credentials' });
        }

        const user = await validateUser(email, password);
        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Optional: tell frontend if they have history
        const messages = await getMessagesByUser(user.id);
        const isNewUser = !messages || messages.length === 0;

        return res.json({ ...user, isNewUser });
    } catch (err) {
        console.error('Login error:', err);
        return res.status(500).json({ error: 'Server error' });
    }
});

// ============================================================
// MESSAGES ROUTE (Frontend calls: /api/messages?userId=...)
// ============================================================
app.get('/api/messages', async (req, res) => {
    try {
        const { userId } = req.query || {};
        if (!userId) return res.status(400).json({ error: 'Missing userId' });

        const messages = await getMessagesByUser(userId);
        return res.json(messages);
    } catch (err) {
        console.error('Messages error:', err);
        return res.status(500).json({ error: 'Failed to fetch messages' });
    }
});

// ============================================================
// THERAPY ROUTE (supports guest: true -> no Mongo saving)
// ============================================================
app.post('/api/therapy', async (req, res) => {
    try {
        const { message, userId, conversationId, guest } = req.body || {};

        if (!message || typeof message !== 'string' || !message.trim()) {
            return res.status(400).json({ error: 'Message is required' });
        }
        if (!userId || typeof userId !== 'string') {
            return res.status(400).json({ error: 'userId is required' });
        }

        // Ensure conversationId exists
        const convId = conversationId || `conv_${userId}_${Date.now()}`;

        // Save USER message only if not guest
        if (!guest) {
            await saveMessage({
                userId,
                conversationId: convId,
                role: 'user',
                text: message.trim()
            });
        }

        // Pull past messages for context (only if not guest)
        let past = [];
        if (!guest) {
            past = await getMessagesByUser(userId, convId);
        }

        const gptMessages = [
            {
                role: 'system',
                content:
                    "You are a compassionate AI therapist. ONLY respond to mental health, emotions, stress, relationships, and personal well-being.\n" +
                    "If asked about other topics, politely decline and redirect to feelings.\n" +
                    "Be warm, validating, and ask helpful follow-up questions.\n" +
                    "If self-harm/suicide intent appears, encourage immediate help (911 / local emergency) and reaching out to a trusted person."
            },
            // If we have history, replay it; otherwise just use the latest user message
            ...(past.length
                ? past.map(m => ({ role: m.role, content: m.text }))
                : [{ role: 'user', content: message.trim() }])
        ];

        const openaiRes = await fetch(OPENAI_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: gptMessages
            })
        });

        if (!openaiRes.ok) {
            const errorText = await openaiRes.text().catch(() => '');
            console.error('OpenAI error:', openaiRes.status, errorText);
            return res.status(500).json({ error: 'AI error' });
        }

        const data = await openaiRes.json();
        const reply = data?.choices?.[0]?.message?.content || "I'm here with you. Want to tell me more?";

        // Save ASSISTANT message only if not guest
        if (!guest) {
            await saveMessage({
                userId,
                conversationId: convId,
                role: 'assistant',
                text: reply
            });
        }

        return res.json({ response: reply, conversationId: convId });
    } catch (err) {
        console.error('Therapy error:', err);
        return res.status(500).json({ error: 'Server error' });
    }
});

// ============================================================
// JSON 404 HANDLER (Prevents HTML responses -> fixes "<!DOCTYPE" issues)
// ============================================================
app.use((req, res) => {
    res.status(404).json({ error: `Not found: ${req.method} ${req.originalUrl}` });
});

// JSON error handler
app.use((err, req, res, next) => {
    console.error("Unhandled error:", err);
    res.status(500).json({ error: "Server error", detail: err.message });
});
