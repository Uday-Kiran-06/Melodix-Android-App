package com.anonymous.nativeaudioeffects

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.media.audiofx.AudioEffect
import android.media.audiofx.BassBoost
import android.media.audiofx.Equalizer
import android.media.audiofx.LoudnessEnhancer
import android.media.audiofx.Virtualizer
import android.media.AudioManager
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class NativeAudioEffectsModule : Module() {
  // Effect instances
  private var equalizer: Equalizer? = null
  private var bassBoost: BassBoost? = null
  private var loudnessEnhancer: LoudnessEnhancer? = null
  private var virtualizer: Virtualizer? = null

  // Shared session state
  private var audioSessionId: Int = 0
  private var lastSessionId: Int = -1

  // Per-effect enabled flags
  private var isBassEnabled = false
  private var isEqEnabled = false
  private var isLoudnessEnabled = false
  private var isVirtualizerEnabled = false

  // Per-effect parameter state (applied on re-attach after session change)
  private var bassStrength = 0
  private var eqGains = mutableMapOf<Int, Int>()
  private var loudnessGain = 0
  private var virtualizerStrength = 600 // 0–1000; 600 ≈ moderate stereo widening

  private val sessionReceiver = object : BroadcastReceiver() {
    override fun onReceive(context: Context?, intent: Intent?) {
      val action = intent?.action
      val sessionId = intent?.getIntExtra(AudioEffect.EXTRA_AUDIO_SESSION, 0) ?: 0
      android.util.Log.d("AudioEffects", "Received broadcast: action=$action, sessionId=$sessionId")

      if (action == AudioEffect.ACTION_OPEN_AUDIO_EFFECT_CONTROL_SESSION && sessionId != 0) {
        if (sessionId == lastSessionId) {
          android.util.Log.d("AudioEffects", "Session ID same as last ($sessionId), skipping")
          return
        }
        lastSessionId = sessionId
        audioSessionId = sessionId
        android.util.Log.i("AudioEffects", "New session ID captured: $sessionId. Attaching effects gently.")
        attachEffectsGently()
      } else if (action == AudioEffect.ACTION_CLOSE_AUDIO_EFFECT_CONTROL_SESSION) {
        android.util.Log.d("AudioEffects", "Session closed: $sessionId")
      }
    }
  }

  /**
   * Gently attach effects to the current session WITHOUT releasing existing ones first.
   * Only creates effects that are currently enabled. This avoids disrupting ExoPlayer's
   * audio decoder pipeline which can cause sample rate drift (2x speed bug).
   */
  private fun attachEffectsGently() {
    if (audioSessionId == 0) return

    try {
      if (isEqEnabled) {
        try {
          equalizer?.release()
          equalizer = Equalizer(0, audioSessionId).apply {
            enabled = true
            eqGains.forEach { (band, gain) ->
              try { setBandLevel(band.toShort(), gain.toShort()) } catch (e: Exception) {}
            }
          }
        } catch (e: Exception) {
          android.util.Log.e("AudioEffects", "Failed to attach EQ: ${e.message}")
        }
      }

      if (isBassEnabled) {
        try {
          bassBoost?.release()
          bassBoost = BassBoost(0, audioSessionId).apply {
            enabled = true
            try { setStrength(bassStrength.toShort()) } catch (e: Exception) {}
          }
        } catch (e: Exception) {
          android.util.Log.e("AudioEffects", "Failed to attach Bass: ${e.message}")
        }
      }

      if (isLoudnessEnabled) {
        try {
          loudnessEnhancer?.release()
          loudnessEnhancer = LoudnessEnhancer(audioSessionId).apply {
            enabled = true
            try { setTargetGain(loudnessGain) } catch (e: Exception) {}
          }
        } catch (e: Exception) {
          android.util.Log.e("AudioEffects", "Failed to attach Loudness: ${e.message}")
        }
      }

      if (isVirtualizerEnabled) {
        try {
          virtualizer?.release()
          virtualizer = Virtualizer(0, audioSessionId).apply {
            enabled = true
            try { setStrength(virtualizerStrength.toShort()) } catch (e: Exception) {}
          }
        } catch (e: Exception) {
          android.util.Log.e("AudioEffects", "Failed to attach Virtualizer: ${e.message}")
        }
      }
    } catch (e: Exception) {
      android.util.Log.e("AudioEffects", "Failed in attachEffectsGently: ${e.message}")
    }
  }

  private fun releaseEffects() {
    equalizer?.release()
    bassBoost?.release()
    loudnessEnhancer?.release()
    virtualizer?.release()
    equalizer = null
    bassBoost = null
    loudnessEnhancer = null
    virtualizer = null
  }

  override fun definition() = ModuleDefinition {
    Name("NativeAudioEffects")

    OnCreate {
      android.util.Log.i("AudioEffects", "Registering session receiver...")
      val filter = IntentFilter().apply {
        addAction(AudioEffect.ACTION_OPEN_AUDIO_EFFECT_CONTROL_SESSION)
        addAction(AudioEffect.ACTION_CLOSE_AUDIO_EFFECT_CONTROL_SESSION)
      }
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        appContext.reactContext?.registerReceiver(sessionReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
      } else {
        appContext.reactContext?.registerReceiver(sessionReceiver, filter)
      }
      android.util.Log.i("AudioEffects", "Session receiver registered.")
    }

    Function("setBassBoost") { strength: Int ->
      bassStrength = strength
      try {
        if (bassBoost == null && audioSessionId != 0) bassBoost = BassBoost(0, audioSessionId)
        bassBoost?.setStrength(strength.toShort())
      } catch (e: Exception) {}
    }

    Function("setEqualizerBandGain") { band: Int, gain: Int ->
      eqGains[band] = gain
      try {
        if (equalizer == null && audioSessionId != 0) equalizer = Equalizer(0, audioSessionId)
        if (band < (equalizer?.numberOfBands ?: 0)) {
          equalizer?.setBandLevel(band.toShort(), gain.toShort())
        }
      } catch (e: Exception) {}
    }

    Function("setLoudnessGain") { gain: Int ->
      loudnessGain = gain
      try {
        if (loudnessEnhancer == null && audioSessionId != 0) loudnessEnhancer = LoudnessEnhancer(audioSessionId)
        loudnessEnhancer?.setTargetGain(gain)
      } catch (e: Exception) {}
    }

    Function("setVirtualizerStrength") { strength: Int ->
      virtualizerStrength = strength
      try {
        if (virtualizer == null && audioSessionId != 0) virtualizer = Virtualizer(0, audioSessionId)
        virtualizer?.setStrength(strength.toShort())
      } catch (e: Exception) {
        android.util.Log.e("AudioEffects", "Failed to set virtualizer strength: ${e.message}")
      }
    }

    Function("setEnabled") { type: String, enabled: Boolean ->
      try {
        when (type) {
          "bass" -> {
            isBassEnabled = enabled
            if (enabled) {
              if (bassBoost == null && audioSessionId != 0) bassBoost = BassBoost(0, audioSessionId)
              bassBoost?.enabled = true
            } else {
              bassBoost?.enabled = false
              bassBoost?.release()
              bassBoost = null
            }
          }
          "eq" -> {
            isEqEnabled = enabled
            if (enabled) {
              if (equalizer == null && audioSessionId != 0) equalizer = Equalizer(0, audioSessionId)
              equalizer?.enabled = true
            } else {
              equalizer?.enabled = false
              equalizer?.release()
              equalizer = null
            }
          }
          "loudness" -> {
            isLoudnessEnabled = enabled
            if (enabled) {
              if (loudnessEnhancer == null && audioSessionId != 0) loudnessEnhancer = LoudnessEnhancer(audioSessionId)
              loudnessEnhancer?.enabled = true
            } else {
              loudnessEnhancer?.enabled = false
              loudnessEnhancer?.release()
              loudnessEnhancer = null
            }
          }
          "virtualizer" -> {
            isVirtualizerEnabled = enabled
            if (enabled) {
              if (virtualizer == null && audioSessionId != 0) virtualizer = Virtualizer(0, audioSessionId)
              virtualizer?.enabled = true
              try { virtualizer?.setStrength(virtualizerStrength.toShort()) } catch (e: Exception) {}
            } else {
              virtualizer?.enabled = false
              virtualizer?.release()
              virtualizer = null
            }
          }
        }
      } catch (e: Exception) {
        android.util.Log.e("AudioEffects", "Error setting enabled for $type: ${e.message}")
      }
    }

    Function("setAudioSessionId") { sessionId: Int ->
      if (sessionId != 0 && sessionId != lastSessionId) {
        android.util.Log.i("AudioEffects", "Manually setting session ID: $sessionId")
        lastSessionId = sessionId
        audioSessionId = sessionId
        attachEffectsGently()
      }
    }

    Function("scanForSession") {
      try {
        val audioManager = appContext.reactContext?.getSystemService(Context.AUDIO_SERVICE) as? AudioManager
        val configs = audioManager?.activePlaybackConfigurations
        val myUid = android.os.Process.myUid()
        val ourConfig = configs?.find {
          val isOurUid = try {
            val uidMethod = it.javaClass.getMethod("getClientUid")
            val uid = uidMethod.invoke(it) as? Int
            uid == null || uid == myUid
          } catch (e: Exception) {
            true
          }
          isOurUid && it.audioAttributes.usage == android.media.AudioAttributes.USAGE_MEDIA
        }

        val sessionId = ourConfig?.let {
          try {
            val method = it.javaClass.getMethod("getSessionId")
            method.invoke(it) as? Int
          } catch (e: Exception) {
            null
          }
        } ?: 0

        android.util.Log.d("AudioEffects", "Scan result: Found config? ${ourConfig != null}, sessionId? $sessionId")

        if (sessionId != 0) {
          if (sessionId != lastSessionId) {
            android.util.Log.i("AudioEffects", "Scanned and found NEW session ID: $sessionId")
            lastSessionId = sessionId
            audioSessionId = sessionId
            attachEffectsGently()
            true
          } else {
            android.util.Log.d("AudioEffects", "Scanned session ID $sessionId is same as last.")
            true
          }
        } else {
          false
        }
      } catch (e: Exception) {
        android.util.Log.e("AudioEffects", "Scan failed: ${e.message}")
        false
      }
    }

    Function("getEqualizerBands") {
      try {
        if (equalizer == null && audioSessionId != 0) equalizer = Equalizer(0, audioSessionId)
        val bands = equalizer?.numberOfBands ?: 0
        val result = mutableListOf<Map<String, Any>>()
        for (i in 0 until bands) {
          val frequency = equalizer?.getCenterFreq(i.toShort()) ?: 0
          result.add(mapOf("index" to i, "frequency" to frequency))
        }
        result
      } catch (e: Exception) {
        listOf<Map<String, Any>>()
      }
    }

    Function("isVirtualizerSupported") {
      try {
        val descriptors = AudioEffect.queryEffects()
        descriptors?.any { it.type == AudioEffect.EFFECT_TYPE_VIRTUALIZER } ?: false
      } catch (e: Exception) {
        false
      }
    }

    OnDestroy {
      try {
        appContext.reactContext?.unregisterReceiver(sessionReceiver)
      } catch (e: Exception) {}
      releaseEffects()
    }
  }
}
