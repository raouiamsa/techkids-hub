import axios from 'axios';
import { sign } from 'jsonwebtoken';

async function testApi() {
  const secret = 'changeme_in_production';
  const token = sign({
    sub: 'cfd6da15-5c3b-4c07-ba79-7a5dc05c8d0d', // fake but formatted as UUID
    email: 'test@example.com',
    role: 'STUDENT'
  }, secret);

  console.log('Testing /api/enrollments/my...');
  try {
    const res = await axios.get('http://127.0.0.1:3000/api/enrollments/my', {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('Enrollments SUCCESS:', res.data);
  } catch (err: any) {
    console.error('Enrollments ERROR:', err.response?.status, err.response?.data);
  }

  console.log('\nTesting /api/progression/my...');
  try {
    const res2 = await axios.get('http://127.0.0.1:3000/api/progression/my', {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('Progression SUCCESS:', res2.data);
  } catch (err: any) {
    console.error('Progression ERROR:', err.response?.status, err.response?.data);
  }
}

testApi();
