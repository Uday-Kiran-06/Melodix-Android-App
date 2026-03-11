# Melodix

Melodix is a premium, high-performance music streaming application built with React Native and Expo. It features a stunning glassmorphism-inspired UI and a custom native audio engine for unparalleled sound control.

## 📱 Previews

<div align="center">
  <table>
    <tr>
      <td><img src="./assets/previews/home.jpg" width="200" alt="Home" /></td>
      <td><img src="./assets/previews/player.jpg" width="200" alt="Player" /></td>
      <td><img src="./assets/previews/search.jpg" width="200" alt="Search" /></td>
    </tr>
    <tr>
      <td align="center"><b>Home</b></td>
      <td align="center"><b>Player</b></td>
      <td align="center"><b>Search</b></td>
    </tr>
    <tr>
      <td><img src="./assets/previews/audio_effects.jpg" width="200" alt="Audio Effects" /></td>
      <td><img src="./assets/previews/settings.jpg" width="200" alt="Settings" /></td>
      <td><img src="./assets/previews/library.jpg" width="200" alt="Library" /></td>
    </tr>
    <tr>
      <td align="center"><b>Audio Effects</b></td>
      <td align="center"><b>Settings</b></td>
      <td align="center"><b>Library</b></td>
    </tr>
    <tr>
      <td><img src="./assets/previews/podcasts.jpg" width="200" alt="Podcasts" /></td>
      <td><img src="./assets/previews/app_icon.jpg" width="200" alt="App Icon" /></td>
      <td></td>
    </tr>
    <tr>
      <td align="center"><b>Podcasts</b></td>
      <td align="center"><b>App Icon</b></td>
      <td></td>
    </tr>
  </table>
</div>

## ✨ Key Features

- **High-Fidelity Streaming**: Guaranteed 320 kbps audio quality for a crystal-clear listening experience.
- **Native Audio Engine**: Custom-built Expo module interfacing directly with Android's native audio effects.
  - **5-Band Equalizer**: Fine-tune your sound with clinical precision.
  - **Bass Boost**: Powerful, adjustable low-end enhancement.
  - **Loudness Normalizer**: Consistent volume levels across all tracks.
- **Premium UI/UX**: Modern glassmorphism design with smooth animations and haptic feedback.
- **Smart Offline Support**: Advanced caching and robust download management for uninterrupted listening.
- **Reliable Background Control**: Playback stops automatically when the app is removed from background.
- **Global State Management**: Powered by Zustand for a lightning-fast and responsive interface.

## 🛠️ Tech Stack

- **Framework**: [React Native](https://reactnative.dev/) + [Expo SDK 55](https://expo.dev/)
- **Language**: TypeScript / Kotlin (Native Modules)
- **Styling**: [NativeWind](https://www.nativewind.dev/) (Tailwind CSS)
- **State Management**: [Zustand](https://github.com/pmndrs/zustand)
- **Navigation**: [Expo Router](https://docs.expo.dev/router/introduction/)
- **Animations**: [Moti](https://moti.fyi/) + [Reanimated 4](https://docs.swmansion.com/react-native-reanimated/)
- **Audio Core**: [React Native Track Player](https://react-native-track-player.js.org/)

## 🚀 Getting Started

### Prerequisites

- Node.js (v18 or newer)
- Android Studio & NDK
- Java 21

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/melodix.git
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Setup environment variables:
   Create a `.env` file in the root directory and add your configuration.

4. Run the application:
   ```bash
   # For Android
   npx expo run:android
   ```

## 📜 License

Distributed under the MIT License. See `LICENSE` for more information.

---
<p align="center">Developed with ❤️ by Uday Kiran</p>
