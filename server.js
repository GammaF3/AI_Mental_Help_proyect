// Import necessary modules
const express = require('express'); // Web framework for creating APIs and handling routes
const cors = require('cors'); // Middleware to enable Cross-Origin Resource Sharing
require('dotenv').config(); // Loads environment variables from a .env file into process.env

// Create an Express app instance
const app = express();

// Enable CORS so frontend apps from different domains can access this backend
app.use(cors());

// Allow Express to automatically parse incoming JSON requests
app.use(express.json());

// Load the OpenAI API key from environment variables
const API_KEY = process.env.OPENAI_API_KEY;

// Define the OpenAI Chat Completions API endpoint
const API_URL = 'https://api.openai.com/v1/chat/completions';

// Define a POST route to handle therapy requests from the client
app.post('/api/therapy', async (req, res) => {
    try {
        // Extract the user's message from the request body
        const { message } = req.body;

        // Validate input — ensure a message was provided
        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        // Send a request to the OpenAI API with the user's message and a system prompt
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`, // Use the API key from environment variables
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini', // Lightweight, cheaper model for chat interactions
                messages: [
                    {
                        // Define the assistant’s behavior and tone
                        role: 'system',
                        content: 'You are a compassionate and empathetic AI therapist. Provide supportive, non-judgmental responses that help people explore their feelings. Use active listening techniques and ask thoughtful follow-up questions. Always be warm and understanding.',
                    },
                    {
                        // The user’s input message
                        role: 'user',
                        content: message,
                    },
                ],
            }),
        });

        // Handle any errors returned by the OpenAI API
        if (!response.ok) {
            const error = await response.json();
            console.error('OpenAI error:', error);
            return res.status(response.status).json({ error: 'OpenAI API error' });
        }

        // Parse the JSON response from the OpenAI API
        const data = await response.json();

        // Extract the assistant’s reply from the API response
        const reply = data.choices[0].message.content;

        // Send the reply back to the frontend client
        res.json({ response: reply });
    } catch (error) {
        // Handle any unexpected server errors
        console.error('Server error:', error);
        res.status(500).json({ error: 'Failed to get therapy response' });
    }
});

// Start the server on the given port (default 3001)
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Therapy server running on port ${PORT}`);
});
