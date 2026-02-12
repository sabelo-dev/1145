import React, { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { StarRating } from "@/components/ui/star-rating";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  Search, 
  MessageSquare, 
  Flag, 
  ThumbsUp,
  Star,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle,
  AlertTriangle,
  Send
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const VendorReviews = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterRating, setFilterRating] = useState("all");
  const [responseText, setResponseText] = useState("");
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReviews();
  }, [user?.id]);

  const fetchReviews = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);

      // First get the vendor record
      const { data: vendorData, error: vendorError } = await supabase
        .from('vendors')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (vendorError) throw vendorError;

      // Then get the store
      const { data: storeData } = await supabase
        .from('stores')
        .select('id, name')
        .eq('vendor_id', vendorData.id)
        .single();

      if (!storeData) {
        setReviews([]);
        setLoading(false);
        return;
      }

      // Get reviews for products in this store
      const { data: reviewsData, error: reviewsError } = await supabase
        .from('reviews')
        .select(`
          *,
          products!inner (
            name,
            store_id
          )
        `)
        .eq('products.store_id', storeData.id)
        .order('created_at', { ascending: false });

      if (reviewsError) throw reviewsError;

      if (!reviewsData || reviewsData.length === 0) {
        setReviews([]);
        setLoading(false);
        return;
      }

      // Get user profiles separately
      const userIds = reviewsData.map(r => r.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, avatar_url')
        .in('id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]));

      const formattedReviews = reviewsData.map(review => {
        const profile = profileMap.get(review.user_id);
        return {
          id: review.id,
          customer: profile?.name || 'Anonymous',
          customerAvatar: profile?.avatar_url || '/placeholder.svg',
          product: review.products?.name || 'Unknown Product',
          rating: review.rating,
          title: review.comment?.split('.')[0] || '',
          comment: review.comment || '',
          date: review.created_at,
          verified: true,
          helpful: 0,
          responded: !!review.vendor_response,
          response: review.vendor_response,
          sentiment: review.sentiment || 'neutral' as const,
          tags: []
        };
      });

      setReviews(formattedReviews);
    } catch (error) {
      console.error('Error fetching reviews:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load reviews",
      });
    } finally {
      setLoading(false);
    }
  };

  const respondToReview = async (reviewId: string, response: string) => {
    try {
      const { error } = await supabase
        .from('reviews')
        .update({
          vendor_response: response,
          vendor_responded_at: new Date().toISOString()
        })
        .eq('id', reviewId);

      if (error) throw error;

      setReviews(reviews.map(review => 
        review.id === reviewId 
          ? { ...review, responded: true, response }
          : review
      ));

      toast({
        title: "Response Sent",
        description: "Your response has been posted successfully.",
      });
      
      setResponseText("");
    } catch (error) {
      console.error('Error responding to review:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to send response",
      });
    }
  };

  const filteredReviews = reviews.filter(review => {
    const matchesSearch = review.product.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         review.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         review.comment.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRating = filterRating === "all" || Math.floor(review.rating).toString() === filterRating;
    return matchesSearch && matchesRating;
  });

  // Calculate comprehensive analytics
  const analytics = useMemo(() => {
    const totalReviews = reviews.length;
    const avgRating = totalReviews > 0 
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews 
      : 0;
    const respondedCount = reviews.filter(r => r.responded).length;
    const responseRate = totalReviews > 0 ? (respondedCount / totalReviews) * 100 : 0;
    const positiveCount = reviews.filter(r => r.sentiment === 'positive').length;
    const neutralCount = reviews.filter(r => r.sentiment === 'neutral').length;
    const negativeCount = reviews.filter(r => r.sentiment === 'negative').length;
    const flaggedCount = 0; // Can be extended when flagging is implemented
    
    const ratingDistribution = {
      5: reviews.filter(r => r.rating === 5).length,
      4: reviews.filter(r => r.rating === 4).length,
      3: reviews.filter(r => r.rating === 3).length,
      2: reviews.filter(r => r.rating === 2).length,
      1: reviews.filter(r => r.rating === 1).length,
    };
    
    return {
      totalReviews,
      avgRating,
      responseRate,
      respondedCount,
      positiveCount,
      neutralCount,
      negativeCount,
      flaggedCount,
      ratingDistribution
    };
  }, [reviews]);

  const ratingDistribution = [5, 4, 3, 2, 1].map(rating => ({
    stars: rating,
    count: reviews.filter(r => Math.floor(r.rating) === rating).length,
    percentage: (reviews.filter(r => Math.floor(r.rating) === rating).length / reviews.length) * 100 || 0
  }));

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case "positive": return "text-green-600";
      case "negative": return "text-red-600";
      case "neutral": return "text-yellow-600";
      default: return "text-gray-600";
    }
  };

  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment) {
      case "positive": return <TrendingUp className="h-4 w-4" />;
      case "negative": return <TrendingDown className="h-4 w-4" />;
      case "neutral": return <Clock className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading reviews...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Reviews & Customer Feedback</h2>
        <p className="text-muted-foreground">
          Monitor customer reviews, respond to feedback, and track sentiment.
        </p>
      </div>

      {/* Review Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Reviews</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.totalReviews}</div>
            <p className="text-xs text-muted-foreground">
              {analytics.totalReviews === 0 ? 'No reviews yet' : 'Customer feedback received'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Rating</CardTitle>
            <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div className="text-2xl font-bold">{analytics.avgRating.toFixed(1)}</div>
              {analytics.totalReviews > 0 && <StarRating rating={analytics.avgRating} className="w-4 h-4" />}
            </div>
            <p className="text-xs text-muted-foreground">
              {analytics.totalReviews === 0 ? 'No ratings yet' : 'Out of 5 stars'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Response Rate</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.responseRate.toFixed(0)}%</div>
            <p className="text-xs text-muted-foreground">
              {analytics.respondedCount} of {analytics.totalReviews} responded
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Positive Reviews</CardTitle>
            <ThumbsUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.positiveCount}</div>
            <p className="text-xs text-muted-foreground">
              {analytics.totalReviews > 0 ? ((analytics.positiveCount / analytics.totalReviews) * 100).toFixed(0) : 0}% positive sentiment
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Analytics Row */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Rating Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Rating Distribution</CardTitle>
            <CardDescription>Breakdown of customer ratings</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[5, 4, 3, 2, 1].map((rating) => (
                <div key={rating} className="flex items-center gap-3">
                  <div className="flex items-center gap-1 w-20">
                    <span className="font-medium">{rating}</span>
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  </div>
                  <div className="flex-1 h-6 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary transition-all"
                      style={{ 
                        width: analytics.totalReviews > 0 
                          ? `${(analytics.ratingDistribution[rating as keyof typeof analytics.ratingDistribution] / analytics.totalReviews) * 100}%` 
                          : '0%' 
                      }}
                    />
                  </div>
                  <span className="w-12 text-right font-medium">
                    {analytics.ratingDistribution[rating as keyof typeof analytics.ratingDistribution]}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Sentiment Analysis */}
        <Card>
          <CardHeader>
            <CardTitle>Sentiment Analysis</CardTitle>
            <CardDescription>Customer feedback sentiment breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                  <div>
                    <div className="font-medium text-green-900 dark:text-green-100">Positive</div>
                    <div className="text-xs text-green-700 dark:text-green-300">{analytics.positiveCount} reviews</div>
                  </div>
                </div>
                <span className="text-2xl font-bold text-green-600">
                  {analytics.totalReviews > 0 ? ((analytics.positiveCount / analytics.totalReviews) * 100).toFixed(0) : 0}%
                </span>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-yellow-600" />
                  <div>
                    <div className="font-medium text-yellow-900 dark:text-yellow-100">Neutral</div>
                    <div className="text-xs text-yellow-700 dark:text-yellow-300">{analytics.neutralCount} reviews</div>
                  </div>
                </div>
                <span className="text-2xl font-bold text-yellow-600">
                  {analytics.totalReviews > 0 ? ((analytics.neutralCount / analytics.totalReviews) * 100).toFixed(0) : 0}%
                </span>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-950 rounded-lg">
                <div className="flex items-center gap-2">
                  <TrendingDown className="h-5 w-5 text-red-600" />
                  <div>
                    <div className="font-medium text-red-900 dark:text-red-100">Negative</div>
                    <div className="text-xs text-red-700 dark:text-red-300">{analytics.negativeCount} reviews</div>
                  </div>
                </div>
                <span className="text-2xl font-bold text-red-600">
                  {analytics.totalReviews > 0 ? ((analytics.negativeCount / analytics.totalReviews) * 100).toFixed(0) : 0}%
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Response Status */}
      <Card>
        <CardHeader>
          <CardTitle>Response Status</CardTitle>
          <CardDescription>Track your engagement with customer feedback</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-4 border rounded-lg">
              <div className="text-3xl font-bold text-green-600">{analytics.respondedCount}</div>
              <Badge variant="default" className="mt-2">Responded</Badge>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-3xl font-bold text-orange-600">{analytics.totalReviews - analytics.respondedCount}</div>
              <Badge variant="outline" className="mt-2">Awaiting Response</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action Items */}
      <Card>
        <CardHeader>
          <CardTitle>Action Items</CardTitle>
          <CardDescription>Reviews that need your attention</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="border rounded-lg p-4 hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => {
              setFilterRating("all");
              const unansweredReviews = reviews.filter(r => !r.responded);
              if (unansweredReviews.length > 0) {
                toast({
                  title: "Unanswered Reviews",
                  description: `You have ${unansweredReviews.length} reviews awaiting response.`,
                });
              }
            }}>
              <div className="flex items-center justify-between mb-2">
                <MessageSquare className="h-5 w-5 text-orange-600" />
                <Badge variant="outline">{analytics.totalReviews - analytics.respondedCount}</Badge>
              </div>
              <div className="text-sm font-medium">Unanswered Reviews</div>
              <p className="text-xs text-muted-foreground mt-1">
                {analytics.totalReviews - analytics.respondedCount === 0 
                  ? 'All caught up!' 
                  : 'Respond to build trust'}
              </p>
            </div>

            <div className="border rounded-lg p-4 hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => {
              setFilterRating("1");
            }}>
              <div className="flex items-center justify-between mb-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                <Badge variant="destructive">{analytics.ratingDistribution[1] + analytics.ratingDistribution[2]}</Badge>
              </div>
              <div className="text-sm font-medium">Low Ratings</div>
              <p className="text-xs text-muted-foreground mt-1">
                {analytics.ratingDistribution[1] + analytics.ratingDistribution[2] === 0 
                  ? 'Great job!' 
                  : '1-2 star reviews'}
              </p>
            </div>

            <div className="border rounded-lg p-4 hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => {
              const negativeReviews = reviews.filter(r => r.sentiment === 'negative' && !r.responded);
              toast({
                title: "Negative Feedback",
                description: negativeReviews.length === 0 
                  ? 'No negative reviews without response!' 
                  : `${negativeReviews.length} negative reviews need attention.`,
                variant: negativeReviews.length === 0 ? "default" : "destructive"
              });
            }}>
              <div className="flex items-center justify-between mb-2">
                <TrendingDown className="h-5 w-5 text-red-600" />
                <Badge variant="secondary">{reviews.filter(r => r.sentiment === 'negative' && !r.responded).length}</Badge>
              </div>
              <div className="text-sm font-medium">Needs Response</div>
              <p className="text-xs text-muted-foreground mt-1">
                Negative reviews without reply
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search reviews by product, customer, or content..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={filterRating} onValueChange={setFilterRating}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Filter by rating" />
              </SelectTrigger>
              <SelectContent className="bg-background z-50">
                <SelectItem value="all">All Ratings</SelectItem>
                <SelectItem value="5">5 Stars</SelectItem>
                <SelectItem value="4">4 Stars</SelectItem>
                <SelectItem value="3">3 Stars</SelectItem>
                <SelectItem value="2">2 Stars</SelectItem>
                <SelectItem value="1">1 Star</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
      </Card>

      {/* Reviews List */}
      <Card>
        <CardHeader>
          <CardTitle>Customer Reviews ({filteredReviews.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredReviews.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No reviews found. Reviews will appear here once customers start leaving feedback.
            </div>
          ) : (
            <div className="space-y-6">
              {filteredReviews.map((review) => (
                <div key={review.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={review.customerAvatar} />
                        <AvatarFallback>{review.customer.split(' ').map((n: string) => n[0]).join('')}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">{review.customer}</h4>
                          {review.verified && (
                            <Badge variant="secondary" className="text-xs">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Verified
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{review.product}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`flex items-center gap-1 ${getSentimentColor(review.sentiment)}`}>
                        {getSentimentIcon(review.sentiment)}
                        <span className="text-xs capitalize">{review.sentiment}</span>
                      </div>
                      <Button variant="ghost" size="sm">
                        <Flag className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <StarRating rating={review.rating} className="w-4 h-4" />
                      <span className="text-sm text-muted-foreground">{review.date}</span>
                    </div>

                    <div>
                      <h5 className="font-medium mb-1">{review.title}</h5>
                      <p className="text-sm text-muted-foreground">{review.comment}</p>
                    </div>

                    {review.tags && (
                      <div className="flex gap-1 flex-wrap">
                        {review.tags.map((tag: string, index: number) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <ThumbsUp className="h-4 w-4" />
                          <span>{review.helpful} found helpful</span>
                        </div>
                      </div>

                      {!review.responded ? (
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button size="sm">
                              <MessageSquare className="h-4 w-4 mr-2" />
                              Respond
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Respond to Review</DialogTitle>
                              <DialogDescription>
                                Write a thoughtful response to {review.customer}'s review.
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div className="p-3 bg-muted rounded-lg">
                                <div className="flex items-center gap-2 mb-2">
                                  <StarRating rating={review.rating} className="w-4 h-4" />
                                  <span className="text-sm font-medium">{review.title}</span>
                                </div>
                                <p className="text-sm">{review.comment}</p>
                              </div>
                              <Textarea
                                placeholder="Write your response..."
                                value={responseText}
                                onChange={(e) => setResponseText(e.target.value)}
                                className="min-h-[100px]"
                              />
                              <div className="flex justify-end gap-2">
                                <Button variant="outline">Cancel</Button>
                                <Button onClick={() => respondToReview(review.id, responseText)}>
                                  <Send className="h-4 w-4 mr-2" />
                                  Send Response
                                </Button>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      ) : (
                        <Badge variant="default" className="text-xs">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Responded
                        </Badge>
                      )}
                    </div>

                    {review.response && (
                      <div className="mt-3 p-3 bg-blue-50 rounded-lg border-l-4 border-blue-200">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium">Your Response:</span>
                        </div>
                        <p className="text-sm text-gray-700">{review.response}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default VendorReviews;