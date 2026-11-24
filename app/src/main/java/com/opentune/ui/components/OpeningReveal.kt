package com.opentune.ui.components

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.CompositingStrategy
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.res.imageResource
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import kotlin.math.exp
import kotlin.math.ln
import kotlin.math.roundToInt
import kotlin.math.sin
import kotlinx.coroutines.delay
import com.opentune.R

/** Plays once per launch of the app, not each time the screen is rebuilt. */
object Opening {
    var played = false
}

/** The splash's black, which the system splash screen and the icon use too. */
val OPENING_FIELD = Color.Black

/**
 * The opening: the Melodix logo takes over from the system splash at the same
 * size, settles with a gentle breath and a glint of light across it, then dives
 * forward. An aperture opens in the center, and the logo expands towards you
 * revealing the Melodix app underneath. [onDive] reports the dive, 0 to 1;
 * [onDone] removes the splash layer when complete.
 */
@Composable
fun OpeningReveal(onDive: (Float) -> Unit, onDone: () -> Unit) {
    val logo = ImageBitmap.imageResource(id = R.drawable.melodix_icon)
    val settle = remember { Animatable(0f) }
    val dive = remember { Animatable(0f) }
    val done by rememberUpdatedState(onDone)
    val report by rememberUpdatedState(onDive)

    LaunchedEffect(Unit) {
        settle.animateTo(1f, tween(SETTLE_MS, easing = CubicBezierEasing(0.2f, 0f, 0f, 1f)))
        delay(HOLD_MS)
        // Slow to start and then rushing, like falling in.
        dive.animateTo(1f, tween(DIVE_MS, easing = CubicBezierEasing(0.6f, 0f, 0.85f, 0.35f))) { report(value) }
        report(1f)
        done()
    }

    Canvas(
        Modifier
            .fillMaxSize()
            // Its own layer, so the window cut through it shows the app below.
            .graphicsLayer { compositingStrategy = CompositingStrategy.Offscreen },
    ) {
        val d = dive.value
        val st = settle.value
        val basePx = 160.dp.toPx()
        val breathe = 1f + 0.04f * sin(Math.PI.toFloat() * st)
        val s = breathe * exp(ln(ZOOM) * d * d)
        val window = smooth(0.04f, 0.32f, d)
        val fade = 1f - smooth(0.75f, 1f, d)

        // Draw background
        drawRect(OPENING_FIELD, alpha = fade)

        // Draw Melodix Logo
        val drawW = basePx * s
        val drawH = basePx * s
        val left = center.x - drawW / 2f
        val top = center.y - drawH / 2f

        if (fade > 0f) {
            drawImage(
                image = logo,
                srcOffset = IntOffset.Zero,
                srcSize = IntSize(logo.width, logo.height),
                dstOffset = IntOffset(left.roundToInt(), top.roundToInt()),
                dstSize = IntSize(drawW.roundToInt(), drawH.roundToInt()),
                alpha = (1f - window * 0.7f).coerceIn(0f, 1f),
            )

            // A band of light that runs across the logo once as it settles.
            if (st in 0.05f..0.98f && d == 0f) {
                val glintX = left + drawW * st
                drawRect(
                    brush = Brush.linearGradient(
                        listOf(Color.Transparent, Color.White.copy(alpha = 0.45f), Color.Transparent),
                        start = Offset(glintX - 30.dp.toPx(), top),
                        end = Offset(glintX + 30.dp.toPx(), top + drawH),
                    ),
                    topLeft = Offset(left, top),
                    size = Size(drawW, drawH),
                    blendMode = BlendMode.SrcAtop,
                )
            }
        }

        // Window aperture onto the app behind
        if (window > 0f) {
            val maxDimension = maxOf(size.width, size.height)
            val holeRadius = (basePx * 0.35f * s * window).coerceAtLeast(0f)

            drawCircle(
                color = Color.Black,
                radius = holeRadius,
                center = center,
                blendMode = BlendMode.DstOut,
            )

            // Outline around the expanding aperture so the edges pop
            if (fade > 0f && holeRadius < maxDimension * 1.5f) {
                drawCircle(
                    color = Color.White.copy(alpha = (fade * (1f - d * 0.5f)).coerceIn(0f, 1f)),
                    radius = holeRadius,
                    center = center,
                    style = Stroke(width = RIM.toPx()),
                )
            }
        }
    }
}

private fun smooth(from: Float, to: Float, x: Float): Float {
    val t = ((x - from) / (to - from)).coerceIn(0f, 1f)
    return t * t * (3f - 2f * t)
}

/** The width of the white edge around the aperture. */
private val RIM = 2.5.dp
private const val SETTLE_MS = 620
private const val HOLD_MS = 120L
private const val DIVE_MS = 900
/** How many times its size the mark grows to by the end of the dive. */
private const val ZOOM = 65f
