import jwt from 'jsonwebtoken';
import { parse } from 'cookie';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'YOUR_SUPABASE_URL';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'YOUR_SERVICE_ROLE_KEY';
const jwtSecret = process.env.SUPABASE_JWT_SECRET || 'YOUR_JWT_SECRET';
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const cookies = parse(req.headers.cookie || '');
  const token = cookies.campus_session;

  if (!token) {
    return res.status(401).json({ error: 'No session' });
  }

  try {
    const decoded = jwt.verify(token, jwtSecret);
    
    // Fetch profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, name, student_id, role, vehicle_number, vehicle_type')
      .eq('id', decoded.sub)
      .single();

    if (!profile) return res.status(401).json({ error: 'User not found' });

    return res.status(200).json({ 
      session: { 
        user: {
          id: profile.id,
          name: profile.name,
          student_id: profile.student_id,
          role: profile.role,
          vehicle_number: profile.vehicle_number,
          vehicle_type: profile.vehicle_type
        }, 
        token 
      } 
    });
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
}
