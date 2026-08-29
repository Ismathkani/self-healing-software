let _db = null;   // cached reference
let _client = null;

// ── In-memory fallback store (demo mode) ──────────────────────
const memStore = {};
function getCollection(name) {
  if (!memStore[name]) memStore[name] = [];
  return {
    insertOne: async (doc) => {
      doc._id = doc._id || require('uuid').v4();
      memStore[name].push(doc);
      return { insertedId: doc._id };
    },
    find: (query = {}) => {
      const execute = async (n) => {
        let results = memStore[name];
        for (const [k, v] of Object.entries(query)) {
          results = results.filter(d => d[k] === v);
        }
        return results.slice(-(n || results.length));
      };
      return {
        sort: () => ({
          limit: (n) => ({
            toArray: () => execute(n)
          }),
          toArray: () => execute()
        }),
        limit: (n) => ({
          toArray: () => execute(n)
        }),
        toArray: () => execute()
      };
    },
    countDocuments: async () => memStore[name].length,
    deleteMany: async () => { memStore[name] = []; }
  };
}

// ── Real MongoDB connection ──────────────────────────────────
async function getDb() {
  if (_db) return _db;

  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/selfheal';

  try {
    const { MongoClient } = require('mongodb');
    _client = new MongoClient(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 3000  // fail fast in demo
    });
    await _client.connect();
    _db = _client.db('selfheal');
    console.log('[DB] Connected to MongoDB');
    return _db;
  } catch (err) {
    console.warn('[DB] MongoDB unavailable — using in-memory store');
    // Return a fake db object whose .collection() returns memStore collections
    _db = { collection: (name) => getCollection(name) };
    return _db;
  }
}

async function closeDb() {
  if (_client && _client.close) await _client.close();
}

module.exports = { getDb, closeDb };
