// server.js – API + OpenAI, uses db.js for storage on MONGODB

require('dotenv').config(); // Loads environment variables from .env

const express = require('express');
const cors = require('cors');
// Node 24 has global fetch; if on older Node, you'd need: const fetch = require('node-fetch');

const { connectToMongo, saveMessage, getAllMessages } = require('./db');

const app = express();

app.use(cors());
app.use(express.json());

// OpenAI setup
const API_KEY = process.env.OPENAI_API_KEY;
const API_URL = 'https://api.openai.com/v1/chat/completions';

// --- Start server only after Mongo is ready ---
async function startServer() {
    try {
        await connectToMongo(); // ensure DB is ready first

        const PORT = process.env.PORT || 3001;
        app.listen(PORT, () => {
            console.log(`Therapy server running on port ${PORT}`);
        });
    } catch (err) {
        console.error('Failed to start server:', err);
    }
}

startServer();

// ---------- ROUTES ----------

// Health check (optional)
app.get('/', (req, res) => {
    res.json({ status: 'ok', message: 'API is running' });
});

// Main therapy endpoint
app.post('/api/therapy', async (req, res) => {
    try {
        const { message } = req.body;

        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        // Save USER message (minimal schema for now)
        await saveMessage({
            // userId: userId || null,
            role: 'user',
            // conversationId: conversationId || null,
            text: message,
        });

        // Call OpenAI
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${API_KEY}`,
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    {
                        role: 'system',
                        content:
                            'You are a compassionate and empathetic AI therapist. Provide supportive, non-judgmental responses that help people explore their feelings.',
                    },
                    {
                        role: 'user',
                        content: message,
                    },
                ],
            }),
        });

        if (!response.ok) {
            const error = await response.json();
            console.error('OpenAI error:', error);
            return res.status(response.status).json({ error: 'OpenAI API error' });
        }

        const data = await response.json();
        const reply = data.choices[0].message.content;

        // Save AI message
        await saveMessage({
            // userId: userId || null,
            role: 'ai',
            // conversationId: conversationId || null,
            text: reply,
        });

        res.json({ response: reply });
    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({ error: 'Failed to get therapy response' });
    }
});

// Get all messages (for history/debug)
app.get('/api/messages', async (req, res) => {
    try {
        const messages = await getAllMessages();
        res.json(messages);
    } catch (err) {
        console.error('Error fetching messages:', err);
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
});
