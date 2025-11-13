//All the mongodb stuff

require('dotenv').config(); // to read MONGO_URI from .env
const { MongoClient, ServerApiVersion } = require('mongodb');

const client = new MongoClient(process.env.MONGO_URI, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    },
});

let messagesCollection; // cached collection

// Connect once and reuse the connection
async function connectToMongo() {
    if (messagesCollection) return messagesCollection; // already connected

    await client.connect();
    const db = client.db('mental_health_db');
    messagesCollection = db.collection('messages');
    console.log('Connected to MongoDB (from db.js)');
    return messagesCollection;
}

// Save a message (user or AI). doc is { text, createdAt?, ... }
async function saveMessage(doc) {
    const collection = await connectToMongo();
    const fullDoc = {
        ...doc,
        createdAt: doc.createdAt || new Date(),
    };
    const result = await collection.insertOne(fullDoc);
    return { _id: result.insertedId, ...fullDoc };
}

// Get all messages, sorted by time (oldest → newest)
async function getAllMessages() {
    const collection = await connectToMongo();
    return collection.find({}).sort({ createdAt: 1 }).toArray();
}

//Expose the raw collection if needed later
async function getMessagesCollection() {
    return connectToMongo();
}

module.exports = {
    connectToMongo,
    saveMessage,
    getAllMessages,
    getMessagesCollection,
};
