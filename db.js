const { MongoClient } = require('mongodb');
const bcrypt = require('bcrypt');

let db;

async function connectToMongo() {
    const client = new MongoClient(process.env.MONGO_URI);
    await client.connect();
    db = client.db('therapyDB');
    console.log('Connected to MongoDB');
}

async function createUser(email, password, name) {
    const passwordHash = await bcrypt.hash(password, 10);

    const user = {
        email,
        passwordHash,
        name,
        createdAt: new Date()
    };

    const result = await db.collection('users').insertOne(user);
    return result.insertedId.toString();
}

async function findUserByEmail(email) {
    return await db.collection('users').findOne({ email });
}

async function validateUser(email, password) {
    const user = await findUserByEmail(email);
    if (!user) return null;

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) return null;

    return {
        id: user._id.toString(),
        email: user.email,
        name: user.name
    };
}

async function saveMessage({ userId, conversationId, role, text }) {
    await db.collection('messages').insertOne({
        userId,
        conversationId,
        role,
        text,
        timestamp: new Date()
    });
}

async function getMessagesByUser(userId, conversationId = null) {
    const filter = { userId };
    if (conversationId) filter.conversationId = conversationId;

    return await db
        .collection('messages')
        .find(filter)
        .sort({ timestamp: 1 })
        .toArray();
}

module.exports = {
    connectToMongo,
    createUser,
    findUserByEmail,
    validateUser,
    saveMessage,
    getMessagesByUser
};
