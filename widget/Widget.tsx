import React from 'react';
import { FlexWidget, TextWidget, ImageWidget, SvgWidget } from 'react-native-android-widget';

interface RecentItem {
  id: string;
  name: string;
  image?: string;
  type?: 'playlist' | 'album' | 'artist';
}

interface MelodixWidgetProps {
  trackName: string;
  artistName: string;
  artwork?: string;
  isPlaying?: boolean;
  recentItems?: RecentItem[];
}

export function MelodixWidget({ trackName, artistName, artwork, isPlaying, recentItems = [] }: MelodixWidgetProps) {
  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: '#000000',
        borderRadius: 24,
        padding: 12,
        flexDirection: 'column',
      }}
    >
      {/* Top Section: Now Playing & Controls */}
      <FlexWidget
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: '#18181b', // zinc-900
          borderRadius: 16,
          padding: 8,
          marginBottom: 8,
        }}
      >
        {/* Album Art */}
        <FlexWidget
          style={{
            width: 56,
            height: 56,
            backgroundColor: '#27272a',
            borderRadius: 12,
            marginRight: 10,
            overflow: 'hidden',
          }}
        >
          {artwork ? (
            <ImageWidget 
              image={artwork as any} 
              imageWidth={56} 
              imageHeight={56}
              style={{ width: 'match_parent', height: 'match_parent' }} 
            />
          ) : (
            <FlexWidget style={{ alignItems: 'center', justifyContent: 'center', flex: 1 }}>
              <TextWidget text="🎵" style={{ fontSize: 24 }} />
            </FlexWidget>
          )}
        </FlexWidget>

        {/* Track Info & Controls Group */}
        <FlexWidget style={{ flex: 1, flexDirection: 'column' }}>
          <TextWidget
            text={trackName}
            style={{
              fontSize: 16,
              color: '#FFFFFF',
              fontWeight: 'bold',
            }}
          />
          <TextWidget
            text={artistName}
            style={{
              fontSize: 13,
              color: '#a1a1aa',
            }}
          />
          
          {/* Media Controls */}
          <FlexWidget style={{ flexDirection: 'row', marginTop: 4, alignItems: 'center' }}>
            <FlexWidget clickAction="SKIP_PREV" style={{ padding: 4 }}>
              <TextWidget text="⏮️" style={{ fontSize: 18 }} />
            </FlexWidget>
            <FlexWidget clickAction="PLAY_PAUSE" style={{ padding: 4, marginHorizontal: 12 }}>
              <TextWidget text={isPlaying ? "⏸️" : "▶️"} style={{ fontSize: 22 }} />
            </FlexWidget>
            <FlexWidget clickAction="SKIP_NEXT" style={{ padding: 4 }}>
              <TextWidget text="⏭️" style={{ fontSize: 18 }} />
            </FlexWidget>
          </FlexWidget>
        </FlexWidget>
      </FlexWidget>

      {/* Bottom Section: Recent Playlists/Albums */}
      {recentItems.length > 0 && (
         <FlexWidget style={{ flexDirection: 'column' }}>
            <TextWidget text="Recently Played" style={{ color: '#71717a', fontSize: 11, marginBottom: 4, marginLeft: 4 }} />
            <FlexWidget style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
               {recentItems.slice(0, 3).map((item, index) => (
                  <FlexWidget 
                    key={item.id + index}
                    clickAction="OPEN_PLAYLIST"
                    clickActionData={{ id: item.id, type: item.type }}
                    style={{ 
                      flex: 1, 
                      backgroundColor: '#27272a', 
                      borderRadius: 10, 
                      padding: 6, 
                      marginHorizontal: 2,
                      flexDirection: 'row',
                      alignItems: 'center'
                    }}
                  >
                    <FlexWidget style={{ width: 24, height: 24, borderRadius: 4, backgroundColor: '#3f3f46', marginRight: 6, overflow: 'hidden' }}>
                       {item.image ? (
                          <ImageWidget 
                            image={item.image as any} 
                            imageWidth={24} 
                            imageHeight={24}
                            style={{ width: 'match_parent', height: 'match_parent' }} 
                          />
                       ) : (
                          <TextWidget text="📁" style={{ fontSize: 14 }} />
                       )}
                    </FlexWidget>
                    <TextWidget 
                      text={item.name} 
                      style={{ color: '#fff', fontSize: 10 }} 
                      maxLines={1}
                    />
                  </FlexWidget>
               ))}
            </FlexWidget>
         </FlexWidget>
      )}
    </FlexWidget>
  );
}
