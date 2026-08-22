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
  
  const { name, studentId, password, vehicleNumber, type } = req.body;
  if (!name || !studentId || !password || !vehicleNumber) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Workaround mapping:
  // student_id -> email
  // password_hash -> phone
  const mappedEmail = `${studentId.trim().toLowerCase()}@campuspark.local`;

  try {
    const { data: existingUser } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', mappedEmail)
      .maybeSingle();

    if (existingUser) {
      return res.status(400).json({ error: 'Student ID already registered. Please login.' });
    }

    const password_hash = await bcrypt.hash(password, 10);

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .insert([{ 
        name: name, 
        email: mappedEmail, 
        phone: password_hash, 
        vehicle_number: vehicleNumber,
        vehicle_type: type,
        role: 'student' 
      }])
      .select()
      .single();

    if (profileError) {
      return res.status(500).json({ error: profileError.message });
    }

    const token = jwt.sign(
      { sub: profile.id, role: 'authenticated', user_role: 'student' },
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

    return res.status(200).json({ success: true, profile });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
