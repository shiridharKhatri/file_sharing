import fs from "fs/promises"
import cron from "node-cron"
import Share from "../database/models/Share.js"
import File from "../database/models/File.js"

export async function cleanupExpiredShares() {
  try {
    const expiredShares = await Share.find({
      expiresAt: { $lt: new Date() },
    }).populate("files")

    for (const share of expiredShares) {
      if (share.files && share.files.length > 0) {
        await deleteFiles(share.files)
      }

      await Share.findByIdAndDelete(share._id)
    }

    return expiredShares.length
  } catch (error) {
    console.error("Cleanup error:", error)
    return 0
  }
}

export async function deleteFiles(files) {
  const deletePromises = files.map(async (file) => {
    try {
      await fs.unlink(file.path)
    } catch (error) {
      console.warn(`Failed to delete file ${file.originalName}:`, error.message)
    }

    await File.findByIdAndDelete(file._id)
  })

  await Promise.all(deletePromises)
}

export function startCleanupJob() {
  cron.schedule("0 * * * *", () => {
    cleanupExpiredShares()
  })
}
