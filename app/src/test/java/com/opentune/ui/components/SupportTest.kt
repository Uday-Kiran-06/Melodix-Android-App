package com.opentune.ui.components

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SupportTest {
    private fun days(value: Long) = java.util.concurrent.TimeUnit.DAYS.toMillis(value)

    @Test fun communityPromptWaitsForFiveDaysOfUse() {
        assertFalse(Support.shouldAsk(false, 4, 0, days(100)))
        assertTrue(Support.shouldAsk(false, 5, 0, days(100)))
    }
    @Test fun communityPromptNeverRepeatsWithinThirtyDays() {
        assertFalse(Support.shouldAsk(false, 40, days(100), days(129)))
        assertTrue(Support.shouldAsk(false, 40, days(100), days(130)))
        assertFalse(Support.shouldAsk(false, 40, days(100), days(99)))
    }
    @Test fun discordInviteWaitsForTenDaysOfUse() {
        assertFalse(Support.shouldAsk(false, 9, 0, days(100), Support.Invite.DISCORD.daysBefore))
        assertTrue(Support.shouldAsk(false, 10, 0, days(100), Support.Invite.DISCORD.daysBefore))
    }
    @Test fun optOutIsPermanent() {
        assertFalse(Support.shouldAsk(true, 400, days(100), days(500)))
    }
}
