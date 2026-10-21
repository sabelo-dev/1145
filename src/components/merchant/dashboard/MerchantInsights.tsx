import React from "react";
import { AlertTriangle, CheckCircle2, Clock, PackageX, Sparkles, Star, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useMerchantAccess } from "@/hooks/useMerchantAccess";
import { canUse } from "@/services/merchantAi";

/** The overview figures the insights are worked out from. */
export interface InsightStats {
  totalProducts: number;
  activeProducts: number;
  pendingApproval: number;
  outOfStockItems: number;
  lowStockItems: number;
  totalOrders: number;
  pendingOrders: number;
  weeklyRevenue: number;
  monthlyRevenue: number;
  rating: number;
  reviewCount: number;
}

interface Insight {
  id: string;
  icon: React.ReactNode;
  title: string;
  detail: string;
  action: { label: string; tab: string };
  urgent?: boolean;
}

const rand = (n: number) => `R${n.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Rules over the store's own numbers. Nothing here is estimated or invented. */
function buildInsights(s: InsightStats): Insight[] {
  const insights: Insight[] = [];
  if (s.pendingOrders > 0) {
    insights.push({
      id: "orders", urgent: true,
      icon: <Clock className="h-5 w-5 text-orange-600" />,
      title: `${s.pendingOrders} paid ${s.pendingOrders === 1 ? "order is" : "orders are"} waiting`,
      detail: "Customers have paid. Accept and prepare them so they ship on time.",
      action: { label: "Process orders", tab: "orders" },
    });
  }
  if (s.outOfStockItems > 0) {
    insights.push({
      id: "out", urgent: true,
      icon: <PackageX className="h-5 w-5 text-red-600" />,
      title: `${s.outOfStockItems} ${s.outOfStockItems === 1 ? "product is" : "products are"} out of stock`,
      detail: "Shoppers can't buy these. Restock them or hide them from your storefront.",
      action: { label: "Update stock", tab: "inventory" },
    });
  }
  if (s.lowStockItems > 0) {
    insights.push({
      id: "low",
      icon: <AlertTriangle className="h-5 w-5 text-amber-600" />,
      title: `${s.lowStockItems} ${s.lowStockItems === 1 ? "product is" : "products are"} running low`,
      detail: "Five or fewer left. Reorder before they sell out.",
      action: { label: "Review stock", tab: "inventory" },
    });
  }
  if (s.pendingApproval > 0) {
    insights.push({
      id: "approval",
      icon: <Clock className="h-5 w-5 text-blue-600" />,
      title: `${s.pendingApproval} ${s.pendingApproval === 1 ? "product is" : "products are"} awaiting approval`,
      detail: "They will appear in your store once 1145 approves them.",
      action: { label: "View products", tab: "products" },
    });
  }
  if (s.totalProducts === 0) {
    insights.push({
      id: "first-product",
      icon: <PackageX className="h-5 w-5 text-blue-600" />,
      title: "Add your first product",
      detail: "Your store has no products yet, so shoppers have nothing to buy.",
      action: { label: "Add product", tab: "products" },
    });
  } else if (s.totalOrders === 0 && s.activeProducts > 0) {
    insights.push({
      id: "first-sale",
      icon: <TrendingUp className="h-5 w-5 text-green-600" />,
      title: "No sales yet",
      detail: `You have ${s.activeProducts} live ${s.activeProducts === 1 ? "product" : "products"}. Share your storefront link or run a promotion to get your first order.`,
      action: { label: "Create promotion", tab: "promotions" },
    });
  } else if (s.weeklyRevenue === 0 && s.monthlyRevenue > 0) {
    insights.push({
      id: "quiet-week",
      icon: <TrendingUp className="h-5 w-5 text-amber-600" />,
      title: "No sales in the last 7 days",
      detail: `You made ${rand(s.monthlyRevenue)} in the last 30 days but nothing this week. A promotion can bring buyers back.`,
      action: { label: "Create promotion", tab: "promotions" },
    });
  }
  if (s.totalOrders >= 5 && s.reviewCount === 0) {
    insights.push({
      id: "reviews",
      icon: <Star className="h-5 w-5 text-yellow-500" />,
      title: "No reviews yet",
      detail: `You have ${s.totalOrders} orders but no reviews. Reviews help new shoppers trust your store.`,
      action: { label: "View reviews", tab: "reviews" },
    });
  }
  return insights.slice(0, 4);
}

const MerchantInsights: React.FC<{ stats: InsightStats; onNavigate: (tab: string) => void }> = ({ stats, onNavigate }) => {
  const { current } = useMerchantAccess();
  const aiOn = !!current?.features.includes("ai_assistant") && (canUse(current, "insights") || canUse(current, "catalog"));
  const insights = buildInsights(stats);

  return (
    <Card className="border-purple-200 bg-purple-50 dark:border-purple-900 dark:bg-purple-950/30">
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="space-y-1.5">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-600" />
            Store Insights
          </CardTitle>
          <CardDescription>Worked out from your store's current orders, stock and sales</CardDescription>
        </div>
        {aiOn ? (
          <Button size="sm" className="gap-1" onClick={() => onNavigate("assistant")}>
            <Sparkles className="h-4 w-4" /> Ask 1145 AI
          </Button>
        ) : (
          <Badge variant="outline" className="shrink-0 bg-background">1145 AI not enabled for your store yet</Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {insights.length === 0 ? (
          <div className="flex items-center gap-3 rounded-lg border bg-background p-3">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <p className="text-sm">Nothing needs your attention right now. Orders and stock look good.</p>
          </div>
        ) : (
          insights.map((insight) => (
            <div key={insight.id} className="flex items-start gap-3 rounded-lg border bg-background p-3">
              <span className="mt-0.5">{insight.icon}</span>
              <div className="min-w-0 flex-1">
                <h4 className="font-medium">{insight.title}</h4>
                <p className="text-sm text-muted-foreground">{insight.detail}</p>
              </div>
              <Button size="sm" variant={insight.urgent ? "default" : "outline"} onClick={() => onNavigate(insight.action.tab)}>
                {insight.action.label}
              </Button>
            </div>
          ))
        )}
        {aiOn && (
          <p className="text-xs text-muted-foreground">
            Want more? Ask 1145 AI things like "What were my top products last month?" or "Write a description for my best seller."
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default MerchantInsights;
