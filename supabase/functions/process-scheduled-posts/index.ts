import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ScheduledPost {
  id: string;
  title: string;
  platforms: string[];
  scheduled_at: string;
  created_by: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('Processing scheduled posts...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all posts that are scheduled and their scheduled time has passed
    const now = new Date().toISOString();
    console.log(`Checking for posts scheduled before: ${now}`);

    const { data: scheduledPosts, error: fetchError } = await supabase
      .from('social_media_posts')
      .select('id, title, platforms, scheduled_at, created_by')
      .eq('status', 'scheduled')
      .lte('scheduled_at', now);

    if (fetchError) {
      console.error('Error fetching scheduled posts:', fetchError);
      throw fetchError;
    }

    if (!scheduledPosts || scheduledPosts.length === 0) {
      console.log('No scheduled posts to process');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No scheduled posts to process',
          processed: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${scheduledPosts.length} posts to process`);

    const results: Array<{ postId: string; success: boolean; error?: string }> = [];

    for (const post of scheduledPosts as ScheduledPost[]) {
      console.log(`Processing post: ${post.id} - "${post.title}"`);

      try {
        // Claim the post so an overlapping cron run cannot publish it twice.
        // social-publish sets the final status (published / partial / failed).
        const { data: claimed, error: claimError } = await supabase
          .from('social_media_posts')
          .update({ status: 'draft', updated_at: new Date().toISOString() })
          .eq('id', post.id)
          .eq('status', 'scheduled')
          .select('id');

        if (claimError) throw claimError;
        if (!claimed || claimed.length === 0) {
          console.log(`Post ${post.id} already claimed by another run`);
          continue;
        }

        // Publish through the real publisher, on behalf of the author.
        const response = await fetch(`${supabaseUrl}/functions/v1/social-publish`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ post_id: post.id }),
        });
        const body = await response.json().catch(() => ({}));

        if (body?.summary) {
          console.log(`Post ${post.id} -> ${body.status} (${body.summary.success}/${body.summary.total} platforms)`);
          results.push({ postId: post.id, success: body.summary.success > 0, error: body.success ? undefined : body.error });
        } else {
          // The publisher never ran (config / auth / validation problem).
          await supabase
            .from('social_media_posts')
            .update({ status: 'failed', updated_at: new Date().toISOString() })
            .eq('id', post.id);
          throw new Error(body?.error || `social-publish returned ${response.status}`);
        }
      } catch (postError: any) {
        console.error(`Error processing post ${post.id}:`, postError);
        results.push({ postId: post.id, success: false, error: postError.message });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    console.log(`Processing complete. Success: ${successCount}, Failed: ${failureCount}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${results.length} posts`,
        processed: successCount,
        failed: failureCount,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in process-scheduled-posts:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
