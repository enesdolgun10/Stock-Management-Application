import { createClient } from '@supabase/supabase-js'


const supabaseUrl = 'https://qnqfhahwclldcoherekt.supabase.co'
const supabaseAnonKey = 'sb_publishable_1vm8axIicscb7skwY7AjHA_DnDk1ITu'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)