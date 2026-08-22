import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { serialize } from 'cookie';

const supabaseUrl = process.env.SUPABASE_URL || 'YOUR_SUPABASE_URL';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'YOUR_SERVICE_ROLE_KEY';
const jwtSecret = process.env.SUPABASE_JWT_SECRET || 'YOUR_JWT_SECRET';

const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  
  const { studentId, password } = req.body;
  if (!studentId || !password) {
    return res.status(400).json({ error: 'Missing credentials' });
  }

  const mappedEmail = `${studentId.trim().toLowerCase()}@campuspark.local`;

  try {
    const { data: user, error } = await supabase
      .from('profiles')
      .select('id, phone, role')
      .eq('email', mappedEmail)
      .maybeSingle();

    if (error || !user || !user.phone) {
      return res.status(401).json({ error: 'Invalid Student ID or password.' });
    }

    // phone contains the bcrypt hash
    const match = await bcrypt.compare(password, user.phone);
    if (!match) {
      return res.status(401).json({ error: 'Invalid Student ID or password.' });
    }

    const token = jwt.sign(
      { sub: user.id, role: 'authenticated', user_role: user.role },
      jwtSecret,
      { expiresIn: '7d' }
    );

    res.setHeader('Set-Cookie', serialize('campus_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV !== 'development',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7
    }));

    return res.status(200).json({ success: true, profile: { id: user.id, role: user.role } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
