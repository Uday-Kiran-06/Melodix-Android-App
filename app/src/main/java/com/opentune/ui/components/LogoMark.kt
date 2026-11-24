package com.opentune.ui.components

import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.vector.PathParser

/**
 * The Melodix mark as path data in the launcher icon's 108 by 108 space,
 * the same shape as res/drawable/ic_launcher_foreground.xml, for drawing it
 * at any size (the opening animation zooms into it).
 */
internal const val MARK_VIEWPORT = 108f

internal val MARK_PATH_DATA: String =
    "M 30,28 C 26,28 24,31 24,36 L 24,54 C 24,70 37.5,82 54,82 " +
    "C 70.5,82 84,70 84,54 L 84,36 C 84,31 82,28 78,28 " +
    "C 74,28 72,31 72,36 L 72,52 C 72,62 64,70 54,70 " +
    "C 44,70 36,62 36,52 L 36,36 C 36,31 34,28 30,28 Z " +
    "M 44,46 C 44,44.5 45,43 46.5,43 C 48,43 49,44.5 49,46 " +
    "L 49,54 C 49,55.5 48,57 46.5,57 C 45,57 44,55.5 44,54 Z " +
    "M 51.5,40 C 51.5,38.5 52.5,37 54,37 C 55.5,37 56.5,38.5 56.5,40 " +
    "L 56.5,58 C 56.5,59.5 55.5,61 54,61 C 52.5,61 51.5,59.5 51.5,58 Z " +
    "M 59,46 C 59,44.5 60,43 61.5,43 C 63,43 64,44.5 64,46 " +
    "L 64,54 C 64,55.5 63,57 61.5,57 C 60,57 59,55.5 59,54 Z"

/** The mark as a [Path] in [MARK_VIEWPORT] units. */
internal fun markPath(): Path = PathParser().parsePathString(MARK_PATH_DATA).toPath()
