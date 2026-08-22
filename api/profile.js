import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'YOUR_SUPABASE_URL';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'YOUR_SERVICE_ROLE_KEY';

const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  
  const { studentId } = req.query;
  if (!studentId) {
    return res.status(400).json({ error: 'Missing studentId parameter' });
  }

  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('id, name, student_id, role, vehicle_number, vehicle_type')
      .eq('student_id', studentId)
      .maybeSingle();

    if (error) {
      console.error('Profile Fetch Error:', error);
      return res.status(500).json({ error: `Database error: ${error.message}` });
    }

    if (!profile) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.status(200).json(profile);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
