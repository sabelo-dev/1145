import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { Zap, Clock, ShoppingCart, Flame, AlertCircle } from 'lucide-react';
import { FlashDeal } from '@/types/retention';
import { useCart } from '@/contexts/CartContext';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface FlashDealCarouselProps {
  deals: FlashDeal[];
  title?: string;
}

function CountdownTimer({ endTime }: { endTime: string }) {
  const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0 });
  
  useEffect(() => {
    const calculateTimeLeft = () => {
      const difference = new Date(endTime).getTime() - new Date().getTime();
      
      if (difference <= 0) {
        return { hours: 0, minutes: 0, seconds: 0 };
      }
      
      return {
        hours: Math.floor(difference / (1000 * 60 * 60)),
        minutes: Math.floor((difference / (1000 * 60)) % 60),
        seconds: Math.floor((difference / 1000) % 60)
      };
    };
    
    setTimeLeft(calculateTimeLeft());
    const timer = setInterval(() => setTimeLeft(calculateTimeLeft()), 1000);
    
    return () => clearInterval(timer);
  }, [endTime]);
  
  const isUrgent = timeLeft.hours < 1;
  
  return (
    <div className={cn(
      "flex items-center gap-1 text-sm font-mono",
      isUrgent ? "text-red-500" : "text-amber-500"
    )}>
      <Clock className="h-4 w-4" />
      <span>{String(timeLeft.hours).padStart(2, '0')}</span>:
      <span>{String(timeLeft.minutes).padStart(2, '0')}</span>:
      <span>{String(timeLeft.seconds).padStart(2, '0')}</span>
    </div>
  );
}

export function FlashDealCarousel({ deals, title = "⚡ Flash Deals" }: FlashDealCarouselProps) {
  const { addToCart } = useCart();
  const navigate = useNavigate();

  if (deals.length === 0) return null;

  const handleAddToCart = (deal: FlashDeal) => {
    if (!deal.product) return;
    
    addToCart({
      productId: deal.product.id,
      name: deal.product.name,
      price: deal.flash_price || deal.product.price * (1 - deal.discount_value / 100),
      image: deal.image_url || '/placeholder.svg',
    });
  };

  const handleViewProduct = (deal: FlashDeal) => {
    if (!deal.product) return;
    navigate(`/product/${deal.product.slug}`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Zap className="h-5 w-5 text-amber-500" />
          {title}
        </h2>
        <Badge variant="destructive" className="animate-pulse">
          <Flame className="h-3 w-3 mr-1" />
          Limited Time
        </Badge>
      </div>
      
      <Carousel
        opts={{ align: "start", loop: true }}
        className="w-full"
      >
        <CarouselContent className="-ml-2 md:-ml-4">
          {deals.map((deal) => {
            const stockRemaining = deal.stock_limit ? deal.stock_limit - deal.claimed_count : null;
            const stockPercentage = deal.stock_limit 
              ? ((deal.stock_limit - deal.claimed_count) / deal.stock_limit) * 100 
              : 100;
            const isLowStock = stockRemaining !== null && stockRemaining <= 5;
            
            const originalPrice = deal.original_price || deal.product?.price || 0;
            const salePrice = deal.flash_price || originalPrice * (1 - deal.discount_value / 100);
            const savings = originalPrice - salePrice;
            
            return (
              <CarouselItem key={deal.id} className="pl-2 md:pl-4 md:basis-1/2 lg:basis-1/3">
                <Card className="overflow-hidden border-2 border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-orange-500/5">
                  <div className="relative">
                    <img
                      src={deal.image_url || '/placeholder.svg'}
                      alt={deal.title}
                      className="w-full h-40 object-cover"
                    />
                    <Badge 
                      className="absolute top-2 left-2 bg-red-500 text-white text-lg px-3"
                    >
                      -{deal.discount_value}%
                    </Badge>
                    <div className="absolute top-2 right-2">
                      <CountdownTimer endTime={deal.end_time} />
                    </div>
                  </div>
                  
                  <CardContent className="p-4 space-y-3">
                    <div>
                      <h3 className="font-bold line-clamp-1">{deal.title}</h3>
                      {deal.store && (
                        <p className="text-sm text-muted-foreground">{deal.store.name}</p>
                      )}
                    </div>
                    
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold text-primary">
                        R{salePrice.toFixed(2)}
                      </span>
                      <span className="text-sm text-muted-foreground line-through">
                        R{originalPrice.toFixed(2)}
                      </span>
                      <Badge variant="secondary" className="text-green-600">
                        Save R{savings.toFixed(2)}
                      </Badge>
                    </div>
                    
                    {deal.stock_limit && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className={isLowStock ? "text-red-500 font-medium" : "text-muted-foreground"}>
                            {isLowStock && <AlertCircle className="h-3 w-3 inline mr-1" />}
                            {stockRemaining} left
                          </span>
                          <span className="text-muted-foreground">
                            {deal.claimed_count} claimed
                          </span>
                        </div>
                        <Progress 
                          value={stockPercentage} 
                          className={cn("h-2", isLowStock && "bg-red-100")}
                        />
                      </div>
                    )}
                    
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        className="flex-1"
                        onClick={() => handleAddToCart(deal)}
                        disabled={stockRemaining === 0}
                      >
                        <ShoppingCart className="h-4 w-4 mr-1" />
                        Add to Cart
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleViewProduct(deal)}
                      >
                        View
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </CarouselItem>
            );
          })}
        </CarouselContent>
        <CarouselPrevious className="-left-4" />
        <CarouselNext className="-right-4" />
      </Carousel>
    </div>
  );
}
