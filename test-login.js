import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://gscrhfcsiwpcdhmncxgh.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdzY3JoZmNzaXdwY2RobW5jeGdoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzA2NzM5MiwiZXhwIjoyMTAyNjQzMzkyfQ.RQoVzMWNKu8l5Zx9ytmyymnoU5t1ZA2EaaHi-diFjig');
async function test() {
  const { data: user, error } = await supabase
    .from('profiles')
    .select('id, password_hash, role')
    .eq('student_id', '23CS002')
    .maybeSingle();
  console.log({ user, error });
}
test();
