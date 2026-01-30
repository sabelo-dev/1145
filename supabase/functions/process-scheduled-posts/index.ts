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
        // Get the author's connected accounts for the target platforms
        const { data: connectedAccounts, error: accountsError } = await supabase
          .from('approved_social_accounts')
          .select('id, platform, account_handle, is_verified, is_active')
          .eq('user_id', post.created_by)
          .in('platform', post.platforms)
          .eq('is_active', true);

        if (accountsError) {
          console.error(`Error fetching accounts for post ${post.id}:`, accountsError);
        }

        // Log which platforms will be "published" to
        const publishedPlatforms: string[] = [];
        const failedPlatforms: string[] = [];

        for (const platform of post.platforms) {
          const account = connectedAccounts?.find(a => a.platform === platform);
          
          if (account && account.is_verified) {
            // In a real implementation, this is where you'd call the platform's API
            // For now, we just mark it as published
            console.log(`Publishing to ${platform} via @${account.account_handle}`);
            publishedPlatforms.push(platform);
          } else if (account && !account.is_verified) {
            console.log(`Skipping ${platform} - account @${account.account_handle} not verified`);
            failedPlatforms.push(`${platform} (not verified)`);
          } else {
            console.log(`Skipping ${platform} - no connected account`);
            failedPlatforms.push(`${platform} (no account)`);
          }
        }

        // Determine final status based on publishing results
        let finalStatus: 'published' | 'failed' = 'published';
        let statusNote = '';

        if (publishedPlatforms.length === 0 && failedPlatforms.length > 0) {
          finalStatus = 'failed';
          statusNote = `Failed platforms: ${failedPlatforms.join(', ')}`;
        } else if (failedPlatforms.length > 0) {
          statusNote = `Partial publish. Published: ${publishedPlatforms.join(', ')}. Failed: ${failedPlatforms.join(', ')}`;
        } else {
          statusNote = `Published to: ${publishedPlatforms.join(', ')}`;
        }

        // Update the post status
        const { error: updateError } = await supabase
          .from('social_media_posts')
          .update({
            status: finalStatus,
            published_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', post.id);

        if (updateError) {
          console.error(`Error updating post ${post.id}:`, updateError);
          results.push({ postId: post.id, success: false, error: updateError.message });
        } else {
          console.log(`Post ${post.id} marked as ${finalStatus}. ${statusNote}`);
          results.push({ postId: post.id, success: true });
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
