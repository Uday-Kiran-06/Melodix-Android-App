package com.opentune.ui.components

import android.content.Context
import android.content.Intent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.Favorite
import androidx.compose.material.icons.rounded.Star
import androidx.compose.material3.FilterChip
import com.opentune.ui.theme.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import com.opentune.ui.theme.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.core.content.edit
import androidx.core.net.toUri
import java.util.Locale
import java.util.concurrent.TimeUnit

/** Ways to back the project: a star on GitHub. */
object Support {
    val REPO: String get() = com.opentune.data.config.RemoteConfig.current.github
    val DISCORD: String get() = com.opentune.data.config.RemoteConfig.current.discord

    /**
     * The two monthly invitations: a GitHub star after five days of use, and the
     * Discord after ten. Each comes at most once every 30 days, and never within
     * two weeks of the other, so they take turns rather than arriving together.
     */
    enum class Invite(internal val daysBefore: Int, internal val askedKey: String, internal val doneKey: String) {
        STAR(5, "askedAt", "done"),
        DISCORD(10, "discordAskedAt", "discordDone"),
    }
    private val MIN_GAP_MS = TimeUnit.DAYS.toMillis(30)
    private val APART_MS = TimeUnit.DAYS.toMillis(14)
    private fun prefs(context: Context) = context.getSharedPreferences("support", Context.MODE_PRIVATE)

    fun usedToday(context: Context, now: Long = System.currentTimeMillis()) {
        val p = prefs(context)
        val day = TimeUnit.MILLISECONDS.toDays(now)
        if (p.getLong("lastDay", -1) == day) return
        p.edit { putLong("lastDay", day); putInt("days", p.getInt("days", 0) + 1) }
    }

    /** The invitation that's due now, if any - disabled. */
    fun due(context: Context, now: Long = System.currentTimeMillis()): Invite? = null

    internal fun shouldAsk(done: Boolean, days: Int, askedAt: Long, now: Long, daysBefore: Int = Invite.STAR.daysBefore): Boolean =
        !done && days >= daysBefore && now - askedAt >= MIN_GAP_MS

    /** Record an impression too, so closing the app cannot trigger another prompt. */
    fun answered(context: Context, invite: Invite, never: Boolean, now: Long = System.currentTimeMillis()) = prefs(context).edit {
        putLong(invite.askedKey, now)
        if (never) putBoolean(invite.doneKey, true)
    }

}

/** A thank-you to the developer: a few suggested sums, or your own, sent from the phone's UPI app. */
@Composable
fun SupportDialog(onDismiss: () -> Unit) {
    onDismiss()
}

/** Invitations disabled. */
@Composable
fun InviteCard(invite: Support.Invite, onDismiss: () -> Unit) {
    onDismiss()
}
