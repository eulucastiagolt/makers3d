'use client';

import { motion } from 'framer-motion';

export function ResultCard({ label, value, highlight, icon: Icon }: { label: string; value: string; highlight?: boolean; icon?: any }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`p-4 rounded-xl ${highlight ? 'bg-gradient-to-br from-gold/10 via-transparent to-gold/5 border border-gold/20' : 'bg-white/[0.03] border border-white/5'}`}
    >
      <div className="flex items-center gap-2 mb-1">
        {Icon && <Icon className={`w-4 h-4 ${highlight ? 'text-gold' : 'text-white/40'}`} />}
        <p className={`text-xs ${highlight ? 'text-gold/70' : 'text-white/40'}`}>{label}</p>
      </div>
      <p className={`font-mono text-xl font-bold ${highlight ? 'text-gold' : 'text-white'}`}>{value}</p>
    </motion.div>
  );
}