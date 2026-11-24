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

    /** The invitation that's due now, if any; the star first when both are. */
    fun due(context: Context, now: Long = System.currentTimeMillis()): Invite? {
        if (!com.opentune.data.config.RemoteConfig.current.communityPrompts) return null
        val p = prefs(context)
        val other = Invite.entries.maxOf { p.getLong(it.askedKey, 0) }
        return Invite.entries.firstOrNull { invite ->
            val asked = p.getLong(invite.askedKey, 0)
            shouldAsk(p.getBoolean(invite.doneKey, false), p.getInt("days", 0), asked, now, invite.daysBefore) &&
                (other == asked || now - other >= APART_MS)
        }
    }

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

/** A dismissible monthly invitation: [Support.Invite.STAR] or [Support.Invite.DISCORD]. */
@Composable
fun InviteCard(invite: Support.Invite, onDismiss: () -> Unit) {
    val context = LocalContext.current
    androidx.compose.runtime.LaunchedEffect(invite) { Support.answered(context, invite, never = false) }
    fun open(url: String) {
        runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, url.toUri())) }
        onDismiss()
    }
    val discord = invite == Support.Invite.DISCORD
    FloatingDialog(
        onDismissRequest = onDismiss,
        icon = { if (discord) Icon(com.opentune.ui.settings.discordLogo, null) else Icon(Icons.Rounded.Star, null) },
        title = { Text(if (discord) "Come say hi on Discord" else "Made for music. Built together.") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(
                    if (discord) "Talk to other listeners, swap add-ons, report bugs and hear about new features first. It's where OpenTune gets shaped."
                    else "OpenTune is free and open source. A star on GitHub helps more listeners find the app, and takes a second."
                )
                androidx.compose.material3.FilledTonalButton(
                    onClick = { open(if (discord) Support.DISCORD else Support.REPO) },
                    modifier = Modifier.fillMaxWidth(),
                    colors = if (discord) androidx.compose.material3.ButtonDefaults.filledTonalButtonColors(
                        containerColor = com.opentune.ui.settings.DISCORD_BLURPLE, contentColor = androidx.compose.ui.graphics.Color.White,
                    ) else androidx.compose.material3.ButtonDefaults.filledTonalButtonColors(),
                ) {
                    Icon(if (discord) com.opentune.ui.settings.discordLogo else Icons.Rounded.Star, null, Modifier.size(18.dp))
                    Text(if (discord) "Join the Discord" else "Star on GitHub", Modifier.padding(start = 8.dp))
                }
                androidx.compose.material3.TextButton(onClick = { Support.answered(context, invite, never = true); onDismiss() }) {
                    Text("Don't show again")
                }
            }
        },
        confirmButton = { SheetButton("Maybe later", onClick = onDismiss, closes = true) },
    )
}
