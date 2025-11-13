const { MongoClient, ServerApiVersion } = require('mongodb');

const uri = "mongodb+srv://luis:pvM45paDxY1z1tUl@artificualintelligence.jjtdgma.mongodb.net/?retryWrites=true&w=majority&appName=ArtificualIntelligence";

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        await client.connect();
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        await client.close();
    }
}

run().catch(console.dir);
