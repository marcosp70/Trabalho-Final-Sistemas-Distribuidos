const axios = require('axios');

const API_URL = 'http://127.0.0.1/api/auth';
const testUser = `test_user_${Date.now()}`;
const testPass = 'securepass123';

describe('Auth Service & Integration Tests', () => {
  let token = null;

  it('should register a new user successfully', async () => {
    const res = await axios.post(`${API_URL}/register`, {
      username: testUser,
      password: testPass
    });
    
    expect(res.status).toBe(201);
    expect(res.data.message).toBe('User registered');
    expect(res.data.user.username).toBe(testUser);
  });

  it('should not allow registering an existing user', async () => {
    try {
      await axios.post(`${API_URL}/register`, {
        username: testUser,
        password: testPass
      });
    } catch (err) {
      expect(err.response.status).toBe(409);
      expect(err.response.data.error).toBe('Username already exists');
    }
  });

  it('should login and return a JWT token', async () => {
    const res = await axios.post(`${API_URL}/login`, {
      username: testUser,
      password: testPass
    });
    
    expect(res.status).toBe(200);
    expect(res.data.token).toBeDefined();
    token = res.data.token;
  });

  it('should validate the JWT token', async () => {
    const res = await axios.get(`${API_URL}/validate`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    expect(res.status).toBe(200);
    expect(res.data.valid).toBe(true);
    expect(res.data.user.username).toBe(testUser);
  });
});
