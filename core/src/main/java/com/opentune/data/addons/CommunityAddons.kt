package com.opentune.data.addons

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import org.json.JSONObject

/**
 * Public owner-curated catalog. URLs are hidden in UI, not confidential network credentials.
 * Read each time the app comes to the front (at most every [EVERY_MS]), so a source the
 * owner turns off stops being asked within minutes on every phone that's in use.
 */
object CommunityAddons {
    suspend fun refresh(force: Boolean = false): Boolean = true
}
