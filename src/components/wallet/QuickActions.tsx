import { Plus, Send, CreditCard, ArrowRightLeft, QrCode, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

interface QuickActionsProps {
  onDeposit: () => void;
  onTransfer: () => void;
  onWithdraw: () => void;
  onTradeGold: () => void;
  onViewHistory: () => void;
}

export function QuickActions({ onDeposit, onTransfer, onWithdraw, onTradeGold, onViewHistory }: QuickActionsProps) {
  const actions = [
    { icon: Plus, label: 'Deposit', onClick: onDeposit, variant: 'default' as const },
    { icon: Send, label: 'Send', onClick: onTransfer, variant: 'outline' as const },
    { icon: CreditCard, label: 'Withdraw', onClick: onWithdraw, variant: 'outline' as const },
    { icon: ArrowRightLeft, label: 'Trade Gold', onClick: onTradeGold, variant: 'outline' as const },
    { icon: History, label: 'History', onClick: onViewHistory, variant: 'outline' as const },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="flex gap-2 overflow-x-auto pb-1 scrollbar-none"
    >
      {actions.map((action, i) => {
        const Icon = action.icon;
        return (
          <Button
            key={action.label}
            variant={action.variant}
            size="sm"
            onClick={action.onClick}
            className={`flex-shrink-0 gap-2 rounded-full px-4 ${
              action.variant === 'default'
                ? 'bg-primary text-primary-foreground shadow-md'
                : 'border-border hover:bg-accent'
            }`}
          >
            <Icon className="h-4 w-4" />
            {action.label}
          </Button>
        );
      })}
    </motion.div>
  );
}
