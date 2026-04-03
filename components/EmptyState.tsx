import React from 'react';
import { View, Text, ViewStyle } from 'react-native';
import { LucideIcon } from 'lucide-react-native';
import GlassCard from './GlassCard';
import { DesignSystem } from '@/constants/DesignSystem';
import { useSettingsStore } from '@/hooks/useSettingsStore';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  message: string;
  style?: ViewStyle;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon: Icon, title, message, style }) => {
  const { theme } = useSettingsStore();
  const isDark = theme === 'dark';

  return (
    <View className="items-center justify-center py-20 px-10" style={style}>
      <GlassCard intensity={isDark ? 10 : 20} className="w-full items-center py-12 px-6">
        <View className={`w-20 h-20 rounded-full ${isDark ? 'bg-zinc-800/50' : 'bg-slate-200/50'} items-center justify-center mb-6`}>
          <Icon size={40} color={isDark ? DesignSystem.colors.primary : DesignSystem.colors.textMuted} />
        </View>
        <Text className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'} mb-2 text-center`}>
          {title}
        </Text>
        <Text className="text-zinc-500 text-center text-sm leading-5">
          {message}
        </Text>
      </GlassCard>
    </View>
  );
};
