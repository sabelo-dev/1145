
import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  ShoppingCart, 
  Package,
  Eye,
  Download,
  Calendar
} from "lucide-react";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from "recharts";

const VendorAnalytics = () => {
  // Mock analytics data
  const salesData = [
    { date: "Jan 1", sales: 1200, orders: 24 },
    { date: "Jan 2", sales: 1800, orders: 32 },
    { date: "Jan 3", sales: 900, orders: 18 },
    { date: "Jan 4", sales: 2200, orders: 41 },
    { date: "Jan 5", sales: 1600, orders: 28 },
    { date: "Jan 6", sales: 2800, orders: 52 },
    { date: "Jan 7", sales: 2100, orders: 39 }
  ];

  const topProducts = [
    { name: "Wireless Earbuds", sales: 2840, units: 42, revenue: 5680 },
    { name: "Smart Watch", sales: 1920, units: 24, revenue: 4800 },
    { name: "Phone Case", sales: 960, units: 96, revenue: 960 },
    { name: "Laptop Stand", sales: 640, units: 16, revenue: 1280 },
    { name: "USB Cable", sales: 450, units: 90, revenue: 450 }
  ];

  const categoryData = [
    { name: "Electronics", value: 65, color: "#8884d8" },
    { name: "Accessories", value: 25, color: "#82ca9d" },
    { name: "Clothing", value: 10, color: "#ffc658" }
  ];

  const kpis = {
    totalRevenue: 15420.50,
    revenueGrowth: 12.5,
    totalOrders: 287,
    orderGrowth: 8.3,
    avgOrderValue: 53.74,
    avgOrderGrowth: -2.1,
    conversionRate: 3.2,
    conversionGrowth: 0.5
  };

  const getGrowthIcon = (growth: number) => {
    return growth >= 0 ? (
      <TrendingUp className="h-3 w-3 text-green-600" />
    ) : (
      <TrendingDown className="h-3 w-3 text-red-600" />
    );
  };

  const getGrowthColor = (growth: number) => {
    return growth >= 0 ? "text-green-600" : "text-red-600";
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Sales Analytics</h2>
          <p className="text-muted-foreground">
            Track your store performance and insights.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Calendar className="h-4 w-4 mr-2" />
            Custom Range
          </Button>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R{kpis.totalRevenue.toFixed(2)}</div>
            <div className="flex items-center text-xs">
              {getGrowthIcon(kpis.revenueGrowth)}
              <span className={`ml-1 ${getGrowthColor(kpis.revenueGrowth)}`}>
                {Math.abs(kpis.revenueGrowth)}% from last month
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.totalOrders}</div>
            <div className="flex items-center text-xs">
              {getGrowthIcon(kpis.orderGrowth)}
              <span className={`ml-1 ${getGrowthColor(kpis.orderGrowth)}`}>
                {Math.abs(kpis.orderGrowth)}% from last month
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Order Value</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${kpis.avgOrderValue.toFixed(2)}</div>
            <div className="flex items-center text-xs">
              {getGrowthIcon(kpis.avgOrderGrowth)}
              <span className={`ml-1 ${getGrowthColor(kpis.avgOrderGrowth)}`}>
                {Math.abs(kpis.avgOrderGrowth)}% from last month
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.conversionRate}%</div>
            <div className="flex items-center text-xs">
              {getGrowthIcon(kpis.conversionGrowth)}
              <span className={`ml-1 ${getGrowthColor(kpis.conversionGrowth)}`}>
                {Math.abs(kpis.conversionGrowth)}% from last month
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Sales Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Sales Trend</CardTitle>
            <CardDescription>Daily sales over the last 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={salesData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Area 
                  type="monotone" 
                  dataKey="sales" 
                  stroke="#8884d8" 
                  fill="#8884d8" 
                  fillOpacity={0.3}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Order Volume */}
        <Card>
          <CardHeader>
            <CardTitle>Order Volume</CardTitle>
            <CardDescription>Number of orders per day</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={salesData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="orders" fill="#82ca9d" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Product Performance & Category Breakdown */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Top Products */}
        <Card>
          <CardHeader>
            <CardTitle>Top Selling Products</CardTitle>
            <CardDescription>Best performing products this month</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topProducts.map((product, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{product.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {product.units} units sold
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">${product.revenue.toFixed(2)}</p>
                    <Badge variant="outline" className="text-xs">
                      #{index + 1}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Category Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Sales by Category</CardTitle>
            <CardDescription>Revenue distribution across categories</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  dataKey="value"
                  label={(entry) => `${entry.name}: ${entry.value}%`}
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Performance Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Summary</CardTitle>
          <CardDescription>
            Key insights and recommendations for your store
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <h4 className="font-medium text-green-600">What's Working Well</h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• Electronics category showing strong growth</li>
                <li>• Weekend sales consistently higher</li>
                <li>• Customer retention improving</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium text-orange-600">Areas for Improvement</h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• Average order value declining</li>
                <li>• Clothing category underperforming</li>
                <li>• Mobile conversion could be better</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium text-blue-600">Recommendations</h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• Bundle products to increase AOV</li>
                <li>• Optimize mobile product pages</li>
                <li>• Consider cross-category promotions</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default VendorAnalytics;
