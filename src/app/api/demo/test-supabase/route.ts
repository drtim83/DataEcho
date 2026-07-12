import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    
    // We do a simple query to verify the connection is active and we have access.
    // Fetching the count of connectors is a safe, lightweight query.
    const { count, error } = await supabase
      .from('connectors')
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      throw error;
    }
    
    return NextResponse.json({ 
      success: true, 
      message: 'Successfully connected to DataEcho Supabase DB!',
      details: `Live connection verified. Found ${count || 0} configured connectors.`
    });
  } catch (error) {
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Connection failed' 
    }, { status: 500 });
  }
}
