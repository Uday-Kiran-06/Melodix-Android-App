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
import android.media.AudioManager
import android.media.AudioPlaybackConfiguration
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class NativeAudioEffectsModule : Module() {
  private var equalizer: Equalizer? = null
  private var bassBoost: BassBoost? = null
  private var loudnessEnhancer: LoudnessEnhancer? = null
  
  private var audioSessionId: Int = 0
  private var isBassEnabled = false
  private var isEqEnabled = false
  private var isLoudnessEnabled = false
  private var bassStrength = 0
  private var eqGains = mutableMapOf<Int, Int>()
  private var loudnessGain = 0

  private var lastSessionId: Int = -1

  private val sessionReceiver = object : BroadcastReceiver() {
    override fun onReceive(context: Context?, intent: Intent?) {
      val action = intent?.action
      val sessionId = intent?.getIntExtra(AudioEffect.EXTRA_AUDIO_SESSION, 0) ?: 0
      android.util.Log.d("AudioEffects", "Received broadcast: action=$action, sessionId=$sessionId")
      
      if (action == AudioEffect.ACTION_OPEN_AUDIO_EFFECT_CONTROL_SESSION && sessionId != 0) {
        if (sessionId == lastSessionId) {
          android.util.Log.d("AudioEffects", "Session ID same as last ($sessionId), skipping reapply")
          return
        }
        lastSessionId = sessionId
        android.util.Log.i("AudioEffects", "New session ID captured: $sessionId. Reapplying effects...")
        reapplyEffects()
      } else if (action == AudioEffect.ACTION_CLOSE_AUDIO_EFFECT_CONTROL_SESSION) {
        android.util.Log.d("AudioEffects", "Session closed: $sessionId")
      }
    }
  }

  private fun reapplyEffects() {
    try {
      // Release old effects if they exist
      releaseEffects()

      // Create new effects for the current session
      if (lastSessionId != 0 && lastSessionId != -1) {
        audioSessionId = lastSessionId
        equalizer = Equalizer(0, audioSessionId).apply {
          enabled = isEqEnabled
          eqGains.forEach { (band, gain) ->
            try {
              setBandLevel(band.toShort(), gain.toShort())
            } catch (e: Exception) {}
          }
        }
        
        bassBoost = BassBoost(0, audioSessionId).apply {
          enabled = isBassEnabled
          try {
            setStrength(bassStrength.toShort())
          } catch (e: Exception) {}
        }
        
        loudnessEnhancer = LoudnessEnhancer(audioSessionId).apply {
          enabled = isLoudnessEnabled
          try {
            setTargetGain(loudnessGain)
          } catch (e: Exception) {}
        }
      }
    } catch (e: Exception) {
      android.util.Log.e("AudioEffects", "Failed to reapply effects: ${e.message}")
    }
  }

  private fun releaseEffects() {
    equalizer?.release()
    bassBoost?.release()
    loudnessEnhancer?.release()
    equalizer = null
    bassBoost = null
    loudnessEnhancer = null
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
        if (bassBoost == null) bassBoost = BassBoost(0, audioSessionId)
        bassBoost?.setStrength(strength.toShort())
      } catch (e: Exception) {}
    }

    Function("setEqualizerBandGain") { band: Int, gain: Int ->
      eqGains[band] = gain
      try {
        if (equalizer == null) equalizer = Equalizer(0, audioSessionId)
        if (band < (equalizer?.numberOfBands ?: 0)) {
          equalizer?.setBandLevel(band.toShort(), gain.toShort())
        }
      } catch (e: Exception) {}
    }

    Function("setLoudnessGain") { gain: Int ->
      loudnessGain = gain
      try {
        if (loudnessEnhancer == null) loudnessEnhancer = LoudnessEnhancer(audioSessionId)
        loudnessEnhancer?.setTargetGain(gain)
      } catch (e: Exception) {}
    }

    Function("setEnabled") { type: String, enabled: Boolean ->
      try {
        when (type) {
          "bass" -> {
            isBassEnabled = enabled
            if (bassBoost == null && audioSessionId != 0) bassBoost = BassBoost(0, audioSessionId)
            bassBoost?.enabled = enabled
          }
          "eq" -> {
            isEqEnabled = enabled
            if (equalizer == null && audioSessionId != 0) equalizer = Equalizer(0, audioSessionId)
            equalizer?.enabled = enabled
          }
          "loudness" -> {
            isLoudnessEnabled = enabled
            if (loudnessEnhancer == null && audioSessionId != 0) loudnessEnhancer = LoudnessEnhancer(audioSessionId)
            loudnessEnhancer?.enabled = enabled
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
        reapplyEffects()
      }
    }

    Function("scanForSession") {
      try {
        val audioManager = appContext.reactContext?.getSystemService(Context.AUDIO_SERVICE) as? AudioManager
        val configs = audioManager?.activePlaybackConfigurations
        val ourConfig = configs?.find { it.audioAttributes.usage == android.media.AudioAttributes.USAGE_MEDIA }
        
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
             reapplyEffects()
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
        if (equalizer == null) equalizer = Equalizer(0, audioSessionId)
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

    OnDestroy {
      try {
        appContext.reactContext?.unregisterReceiver(sessionReceiver)
      } catch (e: Exception) {}
      releaseEffects()
    }
  }
}
