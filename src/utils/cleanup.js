import fs from "fs/promises"
import cron from "node-cron"
import Share from "../database/models/Share.js"
import File from "../database/models/File.js"

export async function cleanupExpiredShares() {
  try {
    const expiredShares = await Share.find({
      expiresAt: { $lt: new Date() },
    }).populate("files")

    let deletedShares = 0
    for (const share of expiredShares) {
      if (share.files && share.files.length > 0) {
        await deleteFiles(share.files)
      }

      await Share.findByIdAndDelete(share._id)
      deletedShares++
    }

    return deletedShares
  } catch (error) {
    console.error("Share cleanup error:", error)
    return 0
  }
}

export async function cleanupExpiredFiles() {
  try {
    const expiredFiles = await File.find({
      expiresAt: { $lt: new Date() },
    })

    let deletedFiles = 0
    for (const file of expiredFiles) {
      try {
        // Delete file from filesystem
        await fs.unlink(file.path)
      } catch (error) {
        console.warn(`Failed to delete file from disk ${file.originalName}:`, error.message)
      }

      // Remove file from database
      await File.findByIdAndDelete(file._id)
      deletedFiles++

      // Remove file reference from share
      await Share.updateMany({ files: file._id }, { $pull: { files: file._id } })
    }

    return deletedFiles
  } catch (error) {
    console.error("File cleanup error:", error)
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

  // Run cleanup every hour
  cron.schedule("0 * * * *", async () => {
    const deletedShares = await cleanupExpiredShares()
    const deletedFiles = await cleanupExpiredFiles()
    console.log(`Cleanup completed: ${deletedShares} shares, ${deletedFiles} files deleted`)
  })

  // Run cleanup every 30 minutes for files (more frequent for 12-hour expiry)
  cron.schedule("*/30 * * * *", async () => {
    const deletedFiles = await cleanupExpiredFiles()
  })

}
