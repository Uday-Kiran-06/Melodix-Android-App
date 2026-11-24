# Melodix 🎵

[![Kotlin](https://img.shields.io/badge/Kotlin-2.0-7F52FF?logo=kotlin&logoColor=white)](https://kotlinlang.org)
[![Android](https://img.shields.io/badge/Android-8.0%2B-3DDC84?logo=android&logoColor=white)](https://developer.android.com)
[![License: GPL-3.0](https://img.shields.io/badge/License-GPL--3.0-blue.svg)](LICENSE)
[![GitHub](https://img.shields.io/badge/GitHub-Uday--Kiran--06%2FMelodix--Android--App-black?logo=github)](https://github.com/Uday-Kiran-06/Melodix-Android-App)

**Melodix** is a powerful, ad-free music streaming app for Android built natively in **100% Kotlin & Jetpack Compose**, streaming directly from YouTube Music with studio-grade fidelity, Apple Music Liquid Glass theming, and zero restrictions.

---

## 🌟 Key Features

### 🎧 Bit-Perfect Listening & Audio DSP
- **Unlimited YouTube Music Streaming:** No subscriptions, no ads, no bot-check blocks.
- **Offline 2GB Cache:** Automatic LRU chunk cache with instant replay and zero mobile data waste.
- **Hardware DSP Equalizer:** 15-band EQ, AutoEq corrections for 8,000+ headphones, and bit-perfect USB DAC output.
- **Automix & Crossfade:** Dynamic tempo/BPM crossfading for seamless transitions between tracks.
- **Format Inspector:** Lossless (320 kbps), High (160 kbps), and Data Saver modes.

### 🎨 Modern Liquid Glass Interface
- **Dynamic Artwork palettes:** Real-time color extraction from album art with ambient glow.
- **Apple Glass UI:** Frosted glass floating mini-player, synchronized karaoke lyrics, and smooth gestures.
- **Full TV & Wear OS Support:** Companion layouts for Android TV, Google TV, and Wear OS watches.

### 📚 Library & Smart Integrations
- **Google Account Login:** Sync private YouTube Music playlists, likes, and listening history.
- **Universal Importer:** Import playlists and song links directly from Spotify and YouTube.
- **Discord Rich Presence (RPC):** Live "Listening to..." status updates on Discord.
- **Synced Lyrics:** Word-by-word synchronized lyrics with full karaoke highlight.

---

## 🛠️ Tech Stack & Architecture

| Layer | Technology |
| :--- | :--- |
| **Language** | Kotlin 2.0 |
| **UI Framework** | Jetpack Compose + Material 3 (Monet dynamic theming) |
| **Audio Engine** | AndroidX Media3 (ExoPlayer) + MediaSessionService |
| **Stream Extraction** | NewPipeExtractor |
| **Database & Cache** | Android Room DB + 2GB LRU Disk Cache |
| **Networking** | OkHttp / Ktor |
| **Image Loading** | Coil |

---

## 🚀 Building From Source

```bash
# Clone the repository
git clone https://github.com/Uday-Kiran-06/Melodix-Android-App.git

# Enter the project directory
cd Melodix-Android-App/opentune

# Build the Debug APK
./gradlew assembleDebug
```

The APK will be generated at:
`app/build/outputs/apk/debug/app-debug.apk`

---

## 👤 Author & Maintainer

* **Uday Kiran**
  * GitHub: [@Uday-Kiran-06](https://github.com/Uday-Kiran-06)
  * Email: `asusuday9@gmail.com`

---

## 📄 License & Attribution

This project is licensed under the **GNU General Public License v3.0 (GPL-3.0)**.  
See the [`LICENSE`](LICENSE) file for complete terms.

Based on OpenTune / ViMusic, Copyright (C) 2024-2026 OpenTune contributors.
All trademarks, logos and brand names are the property of their respective owners.
