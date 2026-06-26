const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Setup db on startup
async function initDb() {
  let retries = 5;
  while (retries) {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          username VARCHAR(50) UNIQUE NOT NULL,
          password VARCHAR(255) NOT NULL
        )
      `);
      console.log('Database initialized successfully');
      break;
    } catch (err) {
      console.error('Error initializing db, retrying...', err);
      retries -= 1;
      await new Promise(res => setTimeout(res, 5000));
    }
  }
}
initDb();

const JWT_SECRET = process.env.JWT_SECRET || 'secret';

app.post('/api/auth/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id, username',
      [username, hashedPassword]
    );
    res.status(201).json({ message: 'User registered', user: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Username already exists' });
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '1d' });
    res.json({ message: 'Login successful', token, username: user.username });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Endpoint for internal validation if needed
app.get('/api/auth/validate', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'No token provided' });
  const token = authHeader.split(' ')[1];
  
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ error: 'Invalid token' });
    res.json({ valid: true, user: decoded });
  });
});

// Endpoint to list all users
app.get('/api/auth/users', async (req, res) => {
  try {
    const result = await pool.query('SELECT username FROM users ORDER BY username ASC');
    const users = result.rows.map(row => row.username);
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`Auth service running on port ${port}`);
});
