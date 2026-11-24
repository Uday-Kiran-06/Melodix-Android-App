package com.opentune.data

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters

/** Telemetry disabled. */
class UsageUploadWorker(context: Context, parameters: WorkerParameters) : CoroutineWorker(context, parameters) {
    override suspend fun doWork(): Result = Result.success()

    companion object {
        fun schedule(context: Context) {}
        fun scheduleFirst(context: Context) {}
    }
}
