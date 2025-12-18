require('dotenv').config();

const express = require('express');
const cors = require('cors');

const {
    connectToMongo,
    saveMessage,
    getMessagesByUser,
    createUser,
    validateUser,
    findUserByEmail
} = require('./db');

const app = express();

app.use(cors());
app.use(express.json());

const API_KEY = process.env.OPENAI_API_KEY;
const API_URL = 'https://api.openai.com/v1/chat/completions';

async function startServer() {
    try {
        await connectToMongo();
        const PORT = process.env.PORT || 3001;
        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    } catch (err) {
        console.error('Startup error:', err);
    }
}

startServer();

/* ---------- BASIC ---------- */

app.get('/', (req, res) => {
    res.json({ status: 'ok' });
});

/* ---------- AUTH ---------- */

app.post('/api/signup', async (req, res) => {
    const { email, password, name } = req.body;
    if (!email || !password || !name) {
        return res.status(400).json({ error: 'Missing fields' });
    }

    const existing = await findUserByEmail(email);
    if (existing) {
        return res.status(409).json({ error: 'Email already exists' });
    }

    const userId = await createUser(email, password, name);
    res.json({ id: userId, email, name, isNewUser: true });
});

app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Missing credentials' });
    }

    const user = await validateUser(email, password);
    if (!user) {
        return res.status(401).json({ error: 'Invalid email or password' });
    }

    const messages = await getMessagesByUser(user.id);
    const isNewUser = messages.length === 0;

    res.json({ ...user, isNewUser });
});

/* ---------- THERAPY ---------- */

app.post('/api/therapy', async (req, res) => {
    try {
        const { message, userId, conversationId } = req.body;

        if (!message || !userId) {
            return res.status(400).json({ error: 'Missing data' });
        }

        const userExists = await findUserByEmail(req.body.email || '');
        if (!userExists && !userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        let convId = conversationId;

        if (!convId) {
            const previous = await getMessagesByUser(userId);
            if (previous.length > 0) {
                convId = previous[previous.length - 1].conversationId;
            } else {
                convId = `conv_${userId}_${Date.now()}`;
            }
        }

        await saveMessage({
            userId,
            conversationId: convId,
            role: 'user',
            text: message
        });

        const pastMessages = await getMessagesByUser(userId, convId);

        const gptMessages = [
            {
                role: 'system',
                content:
                    'You are a compassionate AI therapist. ONLY respond to questions about \n' +
                    '      mental health, emotions, stress, relationships, and personal well-being.\n' +
                    '      If asked about any other topic (science, math, homework, weather, etc.), \n' +
                    '      politely decline and redirect the user to therapy:\n' +
                    '      "I\'m here to support you with your feelings and mental well-being. \n' +
                    '      I can\'t answer that question, but we can talk about how you\'re feeling or \n' +
                    '      what\'s on your mind.'
            },
            ...pastMessages.map(m => ({
                role: m.role,
                content: m.text
            }))
        ];

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${API_KEY}`
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: gptMessages
            })
        });

        if (!response.ok) {
            return res.status(500).json({ error: 'AI error' });
        }

        const data = await response.json();
        const reply = data.choices[0].message.content;

        await saveMessage({
            userId,
            conversationId: convId,
            role: 'assistant',
            text: reply
        });

        res.json({
            response: reply,
            conversationId: convId
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

//Getting the messages by user

app.get('/api/messages', async (req, res) => {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'Missing userId' });

    const messages = await getMessagesByUser(userId);
    res.json(messages);
});
