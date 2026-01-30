import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import type { SocialMediaPost, ApprovedSocialAccount, InfluencerProfile } from '@/types/influencer';

export const useInfluencer = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [posts, setPosts] = useState<SocialMediaPost[]>([]);
  const [approvedAccounts, setApprovedAccounts] = useState<ApprovedSocialAccount[]>([]);
  const [profile, setProfile] = useState<InfluencerProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchPosts = useCallback(async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('social_media_posts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPosts(data as SocialMediaPost[] || []);
    } catch (error) {
      console.error('Error fetching posts:', error);
    }
  }, [user]);

  const fetchApprovedAccounts = useCallback(async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('approved_social_accounts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setApprovedAccounts(data as ApprovedSocialAccount[] || []);
    } catch (error) {
      console.error('Error fetching approved accounts:', error);
    }
  }, [user]);

  const fetchProfile = useCallback(async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('influencer_profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      setProfile(data as InfluencerProfile | null);
    } catch (error) {
      console.error('Error fetching influencer profile:', error);
    }
  }, [user]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchPosts(), fetchApprovedAccounts(), fetchProfile()]);
      setLoading(false);
    };
    
    if (user) {
      loadData();
    }
  }, [user, fetchPosts, fetchApprovedAccounts, fetchProfile]);

  const createPost = async (postData: Partial<SocialMediaPost> & { external_post_url?: string | null }) => {
    if (!user) return null;

    try {
      const insertData = {
        title: postData.title || '',
        content: postData.content || '',
        content_type: postData.content_type,
        platforms: postData.platforms,
        product_id: postData.product_id,
        scheduled_at: postData.scheduled_at,
        status: postData.status,
        external_post_url: postData.external_post_url || null,
        created_by: user.id,
      };
      
      const { data, error } = await supabase
        .from('social_media_posts')
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Post Created',
        description: 'Your social media post has been created.',
      });

      await fetchPosts();
      return data as SocialMediaPost;
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to create post',
      });
      return null;
    }
  };

  const updatePost = async (postId: string, updates: Partial<SocialMediaPost> & { external_post_url?: string | null }) => {
    try {
      const { error } = await supabase
        .from('social_media_posts')
        .update(updates)
        .eq('id', postId);

      if (error) throw error;

      toast({
        title: 'Post Updated',
        description: 'Your post has been updated.',
      });

      await fetchPosts();
      return true;
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to update post',
      });
      return false;
    }
  };

  const deletePost = async (postId: string) => {
    try {
      const { error } = await supabase
        .from('social_media_posts')
        .delete()
        .eq('id', postId);

      if (error) throw error;

      toast({
        title: 'Post Deleted',
        description: 'The post has been deleted.',
      });

      await fetchPosts();
      return true;
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to delete post',
      });
      return false;
    }
  };

  const publishPost = async (postId: string) => {
    try {
      const { error } = await supabase
        .from('social_media_posts')
        .update({ 
          status: 'published',
          published_at: new Date().toISOString()
        })
        .eq('id', postId);

      if (error) throw error;

      toast({
        title: 'Post Published',
        description: 'Your post has been published to selected platforms.',
      });

      await fetchPosts();
      return true;
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to publish post',
      });
      return false;
    }
  };

  const approveAccount = async (accountId: string, verified: boolean) => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('approved_social_accounts')
        .update({
          is_verified: verified,
          verified_at: verified ? new Date().toISOString() : null,
          verified_by: verified ? user.id : null,
        })
        .eq('id', accountId);

      if (error) throw error;

      toast({
        title: verified ? 'Account Approved' : 'Account Rejected',
        description: `The social account has been ${verified ? 'approved' : 'rejected'}.`,
      });

      await fetchApprovedAccounts();
      return true;
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to update account status',
      });
      return false;
    }
  };

  const addApprovedAccount = async (accountData: Partial<ApprovedSocialAccount>) => {
    if (!user) return null;

    try {
      const insertData = {
        platform: accountData.platform || '',
        account_handle: accountData.account_handle || '',
        account_url: accountData.account_url,
        user_id: accountData.user_id || user.id,
      };
      
      const { data, error } = await supabase
        .from('approved_social_accounts')
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Account Added',
        description: 'Social account has been added for approval.',
      });

      await fetchApprovedAccounts();
      return data as ApprovedSocialAccount;
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to add account',
      });
      return null;
    }
  };

  const updateProfile = async (updates: Partial<InfluencerProfile>) => {
    if (!user) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'You must be logged in to update your profile',
      });
      return false;
    }

    try {
      const { error } = await supabase
        .from('influencer_profiles')
        .update({
          display_name: updates.display_name,
          bio: updates.bio,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: 'Profile Updated',
        description: 'Your profile has been updated successfully.',
      });

      await fetchProfile();
      return true;
    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to update profile',
      });
      return false;
    }
  };

  return {
    posts,
    approvedAccounts,
    profile,
    loading,
    createPost,
    updatePost,
    deletePost,
    publishPost,
    approveAccount,
    addApprovedAccount,
    updateProfile,
    refreshPosts: fetchPosts,
    refreshAccounts: fetchApprovedAccounts,
    refreshProfile: fetchProfile,
  };
};
