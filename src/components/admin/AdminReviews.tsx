import React, { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StarIcon, Flag, MessageCircle, User, SlidersHorizontal } from "lucide-react";

interface Review {
  id: string;
  productName: string;
  customerName: string;
  rating: number;
  comment: string;
  date: string;
  status: "pending" | "approved" | "rejected";
  flagged: boolean;
}

interface Complaint {
  id: string;
  type: "product" | "vendor" | "shipping" | "other";
  subject: string;
  description: string;
  customerName: string;
  date: string;
  status: "open" | "investigating" | "resolved" | "closed";
  priority: "low" | "medium" | "high";
}


const AdminReviews: React.FC = () => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  
  // Filter and sort states
  const [filterRating, setFilterRating] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("date-desc");

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch reviews from database
        const { data: reviewsData, error: reviewsError } = await supabase
          .from('reviews')
          .select(`
            *,
            products (name)
          `)
          .order('created_at', { ascending: false });

        if (reviewsError) throw reviewsError;

        // Get user profiles separately
        const userIds = reviewsData?.map(r => r.user_id) || [];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name')
          .in('id', userIds);

        const profileMap = new Map(profiles?.map(p => [p.id, p.name]));

        const formattedReviews: Review[] = reviewsData?.map(review => ({
          id: review.id,
          productName: review.products?.name || 'Unknown Product',
          customerName: profileMap.get(review.user_id) || 'Anonymous',
          rating: review.rating,
          comment: review.comment || '',
          date: new Date(review.created_at).toLocaleDateString(),
          status: review.vendor_response ? 'approved' : 'pending',
          flagged: review.flagged || false
        })) || [];

        setReviews(formattedReviews);
        setComplaints([]);

        if (formattedReviews.length === 0) {
          setReviews([]);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load reviews and complaints."
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [toast]);

  const handleReviewAction = (reviewId: string, action: "approve" | "reject") => {
    setReviews(reviews.map(review => 
      review.id === reviewId ? { ...review, status: action === "approve" ? "approved" : "rejected" } : review
    ));
    
    toast({
      title: `Review ${action}d`,
      description: `Review has been ${action}d successfully.`
    });
  };

  const handleComplaintStatusUpdate = (complaintId: string, newStatus: Complaint["status"]) => {
    setComplaints(complaints.map(complaint =>
      complaint.id === complaintId ? { ...complaint, status: newStatus } : complaint
    ));

    toast({
      title: "Complaint updated",
      description: `Complaint status updated to ${newStatus}.`
    });
  };

  // Calculate analytics
  const analytics = useMemo(() => {
    const totalReviews = reviews.length;
    const avgRating = totalReviews > 0 
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews 
      : 0;
    const pendingCount = reviews.filter(r => r.status === "pending").length;
    const approvedCount = reviews.filter(r => r.status === "approved").length;
    const rejectedCount = reviews.filter(r => r.status === "rejected").length;
    const flaggedCount = reviews.filter(r => r.flagged).length;
    
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
      pendingCount,
      approvedCount,
      rejectedCount,
      flaggedCount,
      ratingDistribution
    };
  }, [reviews]);

  // Filter and sort reviews
  const filteredAndSortedReviews = useMemo(() => {
    let filtered = [...reviews];
    
    // Filter by rating
    if (filterRating !== "all") {
      filtered = filtered.filter(r => r.rating === parseInt(filterRating));
    }
    
    // Filter by status
    if (filterStatus !== "all") {
      filtered = filtered.filter(r => r.status === filterStatus);
    }
    
    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "date-desc":
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        case "date-asc":
          return new Date(a.date).getTime() - new Date(b.date).getTime();
        case "rating-high":
          return b.rating - a.rating;
        case "rating-low":
          return a.rating - b.rating;
        case "product":
          return a.productName.localeCompare(b.productName);
        default:
          return 0;
      }
    });
    
    return filtered;
  }, [reviews, filterRating, filterStatus, sortBy]);

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <StarIcon
        key={i}
        className={`h-4 w-4 ${i < rating ? 'fill-gold text-gold' : 'text-gray-300'}`}
      />
    ));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">Loading reviews and complaints...</div>
      </div>
    );
  }


  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Reviews & Complaints</h2>
      </div>

      {/* Analytics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Reviews</CardDescription>
            <CardTitle className="text-3xl">{analytics.totalReviews}</CardTitle>
          </CardHeader>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Average Rating</CardDescription>
            <div className="flex items-center gap-2">
              <CardTitle className="text-3xl">{analytics.avgRating.toFixed(1)}</CardTitle>
              <StarIcon className="h-6 w-6 fill-gold text-gold" />
            </div>
          </CardHeader>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Pending Reviews</CardDescription>
            <CardTitle className="text-3xl">{analytics.pendingCount}</CardTitle>
          </CardHeader>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Flagged Reviews</CardDescription>
            <CardTitle className="text-3xl text-destructive">{analytics.flaggedCount}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Status Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Review Status Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{analytics.approvedCount}</div>
              <Badge variant="default" className="mt-2">Approved</Badge>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{analytics.pendingCount}</div>
              <Badge variant="outline" className="mt-2">Pending</Badge>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{analytics.rejectedCount}</div>
              <Badge variant="destructive" className="mt-2">Rejected</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rating Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Rating Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[5, 4, 3, 2, 1].map((rating) => (
              <div key={rating} className="flex items-center gap-3">
                <div className="flex items-center gap-1 w-20">
                  <span className="font-medium">{rating}</span>
                  <StarIcon className="h-4 w-4 fill-gold text-gold" />
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

      <Tabs defaultValue="reviews" className="w-full">
        <TabsList>
          <TabsTrigger value="reviews">Product Reviews</TabsTrigger>
          <TabsTrigger value="complaints">Customer Complaints</TabsTrigger>
        </TabsList>

        <TabsContent value="reviews" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Product Reviews Moderation</CardTitle>
              <CardDescription>Manage and moderate customer product reviews</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Filters and Sorting */}
              <div className="flex flex-wrap gap-3 p-4 bg-muted/50 rounded-lg border">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Filters:</span>
                </div>
                
                <Select value={filterRating} onValueChange={setFilterRating}>
                  <SelectTrigger className="w-[140px] bg-background">
                    <SelectValue placeholder="All Ratings" />
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

                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-[140px] bg-background">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-[160px] bg-background">
                    <SelectValue placeholder="Sort By" />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    <SelectItem value="date-desc">Newest First</SelectItem>
                    <SelectItem value="date-asc">Oldest First</SelectItem>
                    <SelectItem value="rating-high">Highest Rating</SelectItem>
                    <SelectItem value="rating-low">Lowest Rating</SelectItem>
                    <SelectItem value="product">Product A-Z</SelectItem>
                  </SelectContent>
                </Select>

                {(filterRating !== "all" || filterStatus !== "all" || sortBy !== "date-desc") && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setFilterRating("all");
                      setFilterStatus("all");
                      setSortBy("date-desc");
                    }}
                  >
                    Clear Filters
                  </Button>
                )}
              </div>

              {/* Reviews List */}
              {filteredAndSortedReviews.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No reviews match your filters
                </div>
              ) : (
                filteredAndSortedReviews.map((review) => (
                <div key={review.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{review.productName}</h4>
                        {review.flagged && <Flag className="h-4 w-4 text-red-500" />}
                      </div>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">{review.customerName}</span>
                        <span className="text-sm text-muted-foreground">•</span>
                        <span className="text-sm text-muted-foreground">{review.date}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {renderStars(review.rating)}
                      </div>
                    </div>
                    <Badge 
                      variant={
                        review.status === "approved" ? "default" : 
                        review.status === "rejected" ? "destructive" : "outline"
                      }
                    >
                      {review.status}
                    </Badge>
                  </div>
                  
                  <p className="text-sm">{review.comment}</p>
                  
                  {review.status === "pending" && (
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        onClick={() => handleReviewAction(review.id, "approve")}
                      >
                        Approve
                      </Button>
                      <Button 
                        size="sm" 
                        variant="destructive"
                        onClick={() => handleReviewAction(review.id, "reject")}
                      >
                        Reject
                      </Button>
                    </div>
                  )}
                </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="complaints" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Customer Complaints</CardTitle>
              <CardDescription>Handle customer complaints and support issues</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {complaints.map((complaint) => (
                <div key={complaint.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{complaint.subject}</h4>
                        <Badge variant="outline" className="text-xs">
                          {complaint.type}
                        </Badge>
                        <Badge 
                          variant={
                            complaint.priority === "high" ? "destructive" :
                            complaint.priority === "medium" ? "default" : "secondary"
                          }
                          className="text-xs"
                        >
                          {complaint.priority} priority
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">{complaint.customerName}</span>
                        <span className="text-sm text-muted-foreground">•</span>
                        <span className="text-sm text-muted-foreground">{complaint.date}</span>
                      </div>
                    </div>
                    <Badge 
                      variant={
                        complaint.status === "resolved" ? "default" :
                        complaint.status === "closed" ? "secondary" :
                        complaint.status === "investigating" ? "outline" : "destructive"
                      }
                    >
                      {complaint.status}
                    </Badge>
                  </div>
                  
                  <p className="text-sm text-muted-foreground">{complaint.description}</p>
                  
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleComplaintStatusUpdate(complaint.id, "investigating")}
                    >
                      Investigate
                    </Button>
                    <Button 
                      size="sm"
                      onClick={() => handleComplaintStatusUpdate(complaint.id, "resolved")}
                    >
                      Resolve
                    </Button>
                    <Button 
                      size="sm" 
                      variant="secondary"
                      onClick={() => handleComplaintStatusUpdate(complaint.id, "closed")}
                    >
                      Close
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminReviews;