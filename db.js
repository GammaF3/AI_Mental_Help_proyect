require('dotenv').config();
const { MongoClient } = require('mongodb');
const bcrypt = require('bcrypt');

let db;

async function connectToMongo() {
    if (db) return db; // reuse

    const client = new MongoClient(process.env.MONGO_URI);
    await client.connect();
    db = client.db(process.env.MONGO_DB_NAME || 'therapyDB');
    console.log('Connected to MongoDB');
    return db;
}

/* ---------- USERS ---------- */
async function createUser(email, password, name) {
    const database = await connectToMongo();

    const passwordHash = await bcrypt.hash(password, 10);
    const user = { email, passwordHash, name, createdAt: new Date() };

    const result = await database.collection('users').insertOne(user);
    return result.insertedId.toString();
}

async function findUserByEmail(email) {
    const database = await connectToMongo();
    return await database.collection('users').findOne({ email });
}

async function validateUser(email, password) {
    const user = await findUserByEmail(email);
    if (!user) return null;

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) return null;

    return { id: user._id.toString(), email: user.email, name: user.name };
}

/* ---------- MESSAGES ---------- */
// Flexible saveMessage: works with BOTH schemas
// Accepts either:
//  - { userId, conversationId, role, text }
//  - { userEmail, conversationId, role, text }  (optional support)
//  - any extra fields are preserved
async function saveMessage(doc) {
    const database = await connectToMongo();

    const fullDoc = {
        ...doc,
        timestamp: doc.timestamp || doc.createdAt || new Date(),
    };

    // normalize if someone sends createdAt
    delete fullDoc.createdAt;

    await database.collection('messages').insertOne(fullDoc);
    return fullDoc;
}

// Brother-style: get messages for a user (optionally for a conversation)
async function getMessagesByUser(userId, conversationId = null) {
    const database = await connectToMongo();

    const filter = { userId };
    if (conversationId) filter.conversationId = conversationId;

    return await database.collection('messages')
        .find(filter)
        .sort({ timestamp: 1 })
        .toArray();
}

// Your-style: get all messages (optionally filter)
async function getAllMessages(filters = {}) {
    const database = await connectToMongo();

    const filter = {};
    if (filters.userId) filter.userId = filters.userId;
    if (filters.userEmail) filter.userEmail = filters.userEmail;
    if (filters.conversationId) filter.conversationId = filters.conversationId;

    return await database.collection('messages')
        .find(filter)
        .sort({ timestamp: 1 })
        .toArray();
}

module.exports = {
    connectToMongo,
    // users
    createUser,
    findUserByEmail,
    validateUser,
    // messages
    saveMessage,
    getMessagesByUser,
    getAllMessages,
};
