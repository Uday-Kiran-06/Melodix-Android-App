import { MotiView } from 'moti';
import { jioSaavnService } from '@/services/jiosaavn';
import { useLibraryStore } from '@/hooks/useLibraryStore';
import { Heart, ListPlus, X, User, Disc, Share2 } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View, Dimensions } from 'react-native';

const { height } = Dimensions.get('window');

interface MenuItemProps {
    icon: any;
    label: string;
    onPress: () => void;
    color?: string;
    showProgress?: boolean;
    progress?: number;
}

const MenuItem = ({ icon: Icon, label, onPress, color = '#fff', showProgress, progress }: MenuItemProps) => (
    <TouchableOpacity
        onPress={onPress}
        className="flex-row items-center py-4 px-6 active:opacity-70"
    >
        <View className="w-10 h-10 items-center justify-center rounded-full bg-zinc-800/80 mr-4 overflow-hidden">
            {showProgress && progress !== undefined ? (
                <View 
                    className="absolute inset-x-0 bottom-0 bg-emerald-500/20" 
                    style={{ height: `${progress * 100}%` }} 
                />
            ) : null}
            <Icon size={22} color={color} />
        </View>
        <Text 
            className="text-base font-medium flex-1"
            style={{ color: color }}
        >
            {label}
        </Text>
    </TouchableOpacity>
);

interface SongMenuProps {
    isVisible: boolean;
    onClose: () => void;
    song: any | null;
    userId?: string;
    extraActions?: React.ReactNode;
}

interface SongMenuComponent extends React.FC<SongMenuProps> {
    Item: typeof MenuItem;
}

const SongMenu: SongMenuComponent = ({ isVisible, onClose, song, userId, extraActions }: SongMenuProps) => {
    const { toggleLike, isLiked } = useLibraryStore();
    const router = useRouter();

    if (!song) return null;

    const liked = isLiked(song.id);

    const handleLike = async () => {
        await toggleLike(song, userId);
    };

    const songTitle = song.name || song.title || "Unknown Track";
    const songArtist = song.artists?.primary?.[0]?.name || song.artist || "Unknown Artist";
    const songImage = jioSaavnService.sanitizeImageUrl(song.image || song.artwork);

    return (
        <Modal
            visible={isVisible}
            transparent
            animationType="none"
            onRequestClose={onClose}
        >
            <Pressable style={styles.overlay} onPress={onClose}>
                <View style={styles.contentContainer}>
                    <MotiView
                        from={{ translateY: height * 0.5, opacity: 0 }}
                        animate={{ translateY: 0, opacity: 1 }}
                        transition={{
                            type: 'timing',
                            duration: 250,
                        }}
                        style={styles.menuContainer}
                    >
                        {/* Header/Grabber */}
                        <View className="w-12 h-1 bg-zinc-800 rounded-full self-center mb-6" />

                        {/* Song Details Header */}
                        <View className="flex-row items-center px-6 mb-6">
                            <Image
                                source={songImage ? { uri: songImage } : require('../assets/images/favicon.png')}
                                className="w-16 h-16 rounded-xl mr-4"
                                transition={200}
                                contentFit="cover"
                            />
                            <View className="flex-1">
                                <Text className="text-white text-lg font-bold" numberOfLines={1}>{songTitle}</Text>
                                <Text className="text-emerald-500 text-sm font-medium" numberOfLines={1}>{songArtist}</Text>
                            </View>
                            <TouchableOpacity onPress={onClose} className="p-2 bg-zinc-900 rounded-full">
                                <X size={18} color="#fff" />
                            </TouchableOpacity>
                        </View>

                        <View className="h-[1px] bg-zinc-800/50 w-full mb-2" />

                        {/* Menu Items */}
                        <MenuItem
                            icon={Heart}
                            label={liked ? "Remove from Liked" : "Add to Liked"}
                            onPress={handleLike}
                            color={liked ? "#1db954" : "#fff"}
                        />

                        {/* Inject Extra Actions (e.g., Download, Sleep Timer) */}
                        {extraActions}

                        <MenuItem
                            icon={ListPlus}
                            label="Add or Remove from Playlist"
                            onPress={() => {
                                // Logic for playlist
                            }}
                        />

                        {song.album?.id && (
                            <MenuItem 
                                icon={Disc}
                                label="View Album"
                                onPress={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    onClose();
                                    router.push(`/album/${song.album.id}`);
                                }}
                            />
                        )}

                        {song.artists?.primary?.[0]?.id && (
                            <MenuItem 
                                icon={User}
                                label="View Artist"
                                onPress={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    onClose();
                                    // router.push(`/artist/${song.artists.primary[0].id}`); // implementation for artist screen if available
                                    // For now, let's use search as a fallback if artist screen isn't ready
                                    router.push({ pathname: '/search', params: { q: songArtist } });
                                }}
                            />
                        )}

                        <MenuItem 
                            icon={Share2}
                            label="Share Song"
                            onPress={async () => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                try {
                                    const shareUrl = song.url || `https://www.jiosaavn.com/song/${songTitle}/${song.id}`;
                                    await Sharing.shareAsync(shareUrl);
                                } catch (e) {}
                                onClose();
                            }}
                        />

                        {/* Safe Area Spacer for Bottom */}
                        <View className="h-10" />
                    </MotiView>
                </View>
            </Pressable>
        </Modal>
    );
}

SongMenu.Item = MenuItem;

export default SongMenu;

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'flex-end',
    },
    contentContainer: {
        width: '100%',
    },
    menuContainer: {
        backgroundColor: '#0a0a0a',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        paddingTop: 16,
        paddingBottom: 0,
        borderWidth: 1,
        borderColor: '#1a1a1a',
    }
});
