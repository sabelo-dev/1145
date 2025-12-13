import { useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { AuctionBid } from "@/types/auction";
import { format } from "date-fns";

interface BidHistoryChartProps {
  bids: AuctionBid[];
  startingBid: number;
}

const BidHistoryChart = ({ bids, startingBid }: BidHistoryChartProps) => {
  const chartData = useMemo(() => {
    if (bids.length === 0) return [];

    // Sort bids by created_at ascending
    const sortedBids = [...bids].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    // Add starting point
    const data = [
      {
        time: sortedBids[0]?.created_at 
          ? format(new Date(new Date(sortedBids[0].created_at).getTime() - 60000), "HH:mm")
          : "Start",
        amount: startingBid,
        label: "Starting Bid",
      },
    ];

    // Add all bids
    sortedBids.forEach((bid) => {
      data.push({
        time: format(new Date(bid.created_at), "HH:mm"),
        amount: bid.bid_amount,
        label: `R${bid.bid_amount}`,
      });
    });

    return data;
  }, [bids, startingBid]);

  if (bids.length === 0) {
    return (
      <div className="h-32 flex items-center justify-center text-muted-foreground text-sm">
        No bids yet
      </div>
    );
  }

  const minBid = startingBid * 0.9;
  const maxBid = Math.max(...bids.map((b) => b.bid_amount)) * 1.1;

  return (
    <div className="h-40 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
          <defs>
            <linearGradient id="bidGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis 
            dataKey="time" 
            tick={{ fontSize: 10 }} 
            tickLine={false}
            axisLine={false}
          />
          <YAxis 
            domain={[minBid, maxBid]}
            tick={{ fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `R${value}`}
            width={60}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--popover))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
              fontSize: "12px",
            }}
            formatter={(value: number) => [`R${value}`, "Bid"]}
            labelFormatter={(label) => `Time: ${label}`}
          />
          <Area
            type="stepAfter"
            dataKey="amount"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            fill="url(#bidGradient)"
            dot={{ fill: "hsl(var(--primary))", strokeWidth: 0, r: 4 }}
            activeDot={{ r: 6, fill: "hsl(var(--primary))" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default BidHistoryChart;
