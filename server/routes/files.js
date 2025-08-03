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

router.post("/upload/:shareId", upload.array("files", 10), async (req, res) => {
  try {
    const { shareId } = req.params
    const uploadedFiles = req.files

    if (!uploadedFiles || uploadedFiles.length === 0) {
      return res.status(400).json({ success: false, message: "No files uploaded" })
    }

    const share = await Share.findOne({ shareId })

    if (!share) {
      await Promise.all(uploadedFiles.map((file) => fs.unlink(file.path).catch(() => {})))
      return res.status(404).json({ success: false, message: "Share not found" })
    }

    if (share.isExpired) {
      await Promise.all(uploadedFiles.map((file) => fs.unlink(file.path).catch(() => {})))
      return res.status(410).json({ success: false, message: "Share has expired" })
    }

    const fileRecords = await Promise.all(
      uploadedFiles.map(async (file) => {
        const fileRecord = new File({
          originalName: file.originalname,
          filename: file.filename,
          path: file.path,
          mimetype: file.mimetype,
          size: file.size,
          shareId,
        })

        await fileRecord.save()
        return fileRecord
      }),
    )

    share.files.push(...fileRecords.map((f) => f._id))
    await share.save()

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

    const share = await Share.findOne({ shareId: file.shareId })
    if (!share || share.isExpired) {
      return res.status(410).json({ success: false, message: "File no longer available" })
    }

    try {
      await fs.access(file.path)
    } catch {
      return res.status(404).json({ success: false, message: "File not found on server" })
    }

    file.downloads += 1
    share.stats.downloads += 1
    await Promise.all([file.save(), share.save()])

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
