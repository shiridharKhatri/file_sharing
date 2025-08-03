import express from "express"
import multer from "multer"
import path from "path"
import fs from "fs/promises"
import { fileURLToPath } from "url"
import Share from "../database/models/Share.js"
import File from "../database/models/File.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const router = express.Router()

const uploadsDir = path.join(__dirname, "../uploads")

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir)
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9)
    cb(null, uniqueSuffix + path.extname(file.originalname))
  },
})

const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024,
    files: 10,
  },
})

// Helper function to create or get special shares
async function getOrCreateSpecialShare(shareId) {
  const specialShares = {
    "public-global": {
      mode: "global",
      title: "Public Global Share",
      textContent: "",
      language: "plaintext",
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
      settings: {
        allowEdit: true,
        allowDownload: true,
        maxUsers: 50,
      },
    },
    "local-network": {
      mode: "collaborative",
      title: "Local Network Share",
      textContent: "",
      language: "plaintext",
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
      settings: {
        allowEdit: true,
        allowDownload: true,
        maxUsers: 20,
      },
    },
  }

  if (specialShares[shareId]) {
    // Try to find existing share
    let share = await Share.findOne({ shareId })

    if (!share) {
      // Create the special share if it doesn't exist
      console.log(`Creating special share: ${shareId}`)
      share = new Share({
        shareId,
        ...specialShares[shareId],
      })
      await share.save()
      console.log(`Special share created: ${shareId}`)
    }

    return share
  }

  return null
}

router.post("/upload/:shareId", upload.array("files", 10), async (req, res) => {
  try {
    const { shareId } = req.params
    const uploadedFiles = req.files

    console.log(`File upload request for shareId: ${shareId}`)

    if (!uploadedFiles || uploadedFiles.length === 0) {
      return res.status(400).json({ success: false, message: "No files uploaded" })
    }

    let share

    // Handle special share IDs (public-global, local-network)
    if (shareId === "public-global" || shareId === "local-network") {
      console.log(`Handling special share: ${shareId}`)
      share = await getOrCreateSpecialShare(shareId)
    } else {
      // Handle regular private shares
      console.log(`Looking for regular share: ${shareId}`)
      share = await Share.findOne({ shareId })
    }

    if (!share) {
      console.log(`Share not found: ${shareId}`)
      await Promise.all(uploadedFiles.map((file) => fs.unlink(file.path).catch(() => {})))
      return res.status(404).json({ success: false, message: "Share not found" })
    }

    if (share.isExpired) {
      console.log(`Share expired: ${shareId}`)
      await Promise.all(uploadedFiles.map((file) => fs.unlink(file.path).catch(() => {})))
      return res.status(410).json({ success: false, message: "Share has expired" })
    }

    console.log(`Processing ${uploadedFiles.length} files for share: ${shareId}`)

    const fileRecords = await Promise.all(
      uploadedFiles.map(async (file) => {
        const fileRecord = new File({
          originalName: file.originalname,
          filename: file.filename,
          path: file.path,
          mimetype: file.mimetype,
          size: file.size,
          shareId,
          // For public/collaborative shares, set shorter expiry (12 hours)
          expiresAt:
            shareId === "public-global" || shareId === "local-network"
              ? new Date(Date.now() + 12 * 60 * 60 * 1000)
              : new Date(Date.now() + 12 * 60 * 60 * 1000),
        })

        await fileRecord.save()
        console.log(`File saved: ${file.originalname} (${fileRecord._id})`)
        return fileRecord
      }),
    )

    // Add file references to share
    share.files.push(...fileRecords.map((f) => f._id))
    await share.save()

    console.log(`Files uploaded successfully to share: ${shareId}`)

    res.json({
      success: true,
      data: {
        files: fileRecords.map((f) => ({
          id: f._id,
          originalName: f.originalName,
          size: f.size,
          mimetype: f.mimetype,
          uploadedAt: f.createdAt,
        })),
      },
    })
  } catch (error) {
    console.error("File upload error:", error)

    if (req.files) {
      await Promise.all(req.files.map((file) => fs.unlink(file.path).catch(() => {})))
    }

    res.status(500).json({
      success: false,
      message: "Failed to upload files",
    })
  }
})

router.get("/download/:fileId", async (req, res) => {
  try {
    const { fileId } = req.params

    const file = await File.findById(fileId)

    if (!file) {
      return res.status(404).json({ success: false, message: "File not found" })
    }

    // For special shares, allow download without checking share expiry
    if (file.shareId !== "public-global" && file.shareId !== "local-network") {
      const share = await Share.findOne({ shareId: file.shareId })
      if (!share || share.isExpired) {
        return res.status(410).json({ success: false, message: "File no longer available" })
      }
    }

    try {
      await fs.access(file.path)
    } catch {
      return res.status(404).json({ success: false, message: "File not found on server" })
    }

    file.downloads += 1
    await file.save()

    // Update share stats if it's a regular share
    if (file.shareId !== "public-global" && file.shareId !== "local-network") {
      const share = await Share.findOne({ shareId: file.shareId })
      if (share) {
        share.stats.downloads += 1
        await share.save()
      }
    }

    res.setHeader("Content-Disposition", `attachment; filename="${file.originalName}"`)
    res.setHeader("Content-Type", file.mimetype)

    res.sendFile(path.resolve(file.path))
  } catch (error) {
    console.error("File download error:", error)
    res.status(500).json({ success: false, message: "Failed to download file" })
  }
})

router.delete("/:fileId", async (req, res) => {
  try {
    const { fileId } = req.params

    const file = await File.findById(fileId)

    if (!file) {
      return res.status(404).json({ success: false, message: "File not found" })
    }

    // Remove file reference from share (works for both regular and special shares)
    const share = await Share.findOne({ shareId: file.shareId })
    if (share) {
      share.files = share.files.filter((f) => f.toString() !== fileId)
      await share.save()
    }

    try {
      await fs.unlink(file.path)
    } catch (error) {
      console.warn("Failed to delete file from disk:", error.message)
    }

    await File.findByIdAndDelete(fileId)

    res.json({ success: true, message: "File deleted successfully" })
  } catch (error) {
    console.error("File delete error:", error)
    res.status(500).json({ success: false, message: "Failed to delete file" })
  }
})

export default router
