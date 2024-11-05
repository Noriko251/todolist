const env = require('dotenv');
const { Pool } = require('pg');

env.config();

const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: {
        rejectUnauthorized: false
    }
  });

module.exports = pool;