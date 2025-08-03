import express from "express"
import bcrypt from "bcryptjs"
import Share from "../database/models/Share.js"
import { generateShareId, calculateExpiryDate } from "../utils/helpers.js"

const router = express.Router()

router.post("/", async (req, res) => {
  try {
    const { mode, textContent, password, expiry, language, title } = req.body

    console.log("Creating share with data:", { mode, expiry, language, title })

    const shareId = generateShareId()
    const expiresAt = calculateExpiryDate(expiry)

    let hashedPassword = null
    if (mode === "private" && password) {
      hashedPassword = await bcrypt.hash(password, 10)
    }

    const share = new Share({
      shareId,
      mode,
      textContent: textContent || "",
      language: language || "plaintext",
      title: title || "Untitled Share",
      password: hashedPassword,
      expiresAt,
    })

    const savedShare = await share.save()
    console.log("Share saved successfully:", savedShare.shareId)

    res.json({
      success: true,
      data: {
        shareId: savedShare.shareId,
        shareUrl: `http://localhost:5173/share/${savedShare.shareId}`,
        expiresAt: savedShare.expiresAt,
      },
    })
  } catch (error) {
    console.error("Create share error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to create share",
      error: error.message,
    })
  }
})

router.get("/:shareId", async (req, res) => {
  try {
    const { shareId } = req.params
    const { password } = req.query

    console.log("Looking for share:", shareId)

    const share = await Share.findOne({ shareId }).populate("files")
    console.log("Found share:", share ? "Yes" : "No")

    if (!share) {
      console.log("Share not found in database")
      return res.status(404).json({ success: false, message: "Share not found" })
    }

    console.log("Share expires at:", share.expiresAt, "Current time:", new Date())

    if (share.isExpired) {
      console.log("Share has expired")
      return res.status(410).json({ success: false, message: "Share has expired" })
    }

    if (share.mode === "private" && share.password) {
      if (!password) {
        return res.status(401).json({ success: false, message: "Password required" })
      }

      const isValidPassword = await bcrypt.compare(password, share.password)
      if (!isValidPassword) {
        return res.status(401).json({ success: false, message: "Invalid password" })
      }
    }

    share.stats.views += 1
    await share.save()

    const shareData = share.toObject()
    delete shareData.password

    console.log("Returning share data successfully")

    res.json({
      success: true,
      data: shareData,
    })
  } catch (error) {
    console.error("Get share error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to get share",
      error: error.message,
    })
  }
})

// Add a test route to check all shares
router.get("/", async (req, res) => {
  try {
    const shares = await Share.find({}).select("shareId mode title createdAt expiresAt")
    res.json({
      success: true,
      data: shares,
      count: shares.length,
    })
  } catch (error) {
    console.error("Get all shares error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to get shares",
    })
  }
})

router.put("/:shareId", async (req, res) => {
  try {
    const { shareId } = req.params
    const { textContent, language, title } = req.body

    const share = await Share.findOne({ shareId })

    if (!share) {
      return res.status(404).json({ success: false, message: "Share not found" })
    }

    if (share.isExpired) {
      return res.status(410).json({ success: false, message: "Share has expired" })
    }

    if (textContent !== undefined) share.textContent = textContent
    if (language !== undefined) share.language = language
    if (title !== undefined) share.title = title

    share.stats.edits += 1
    await share.save()

    res.json({
      success: true,
      data: {
        textContent: share.textContent,
        language: share.language,
        title: share.title,
      },
    })
  } catch (error) {
    console.error("Update share error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to update share",
    })
  }
})

router.delete("/:shareId", async (req, res) => {
  try {
    const { shareId } = req.params

    const share = await Share.findOne({ shareId }).populate("files")

    if (!share) {
      return res.status(404).json({ success: false, message: "Share not found" })
    }

    if (share.files && share.files.length > 0) {
      const { deleteFiles } = await import("../utils/cleanup.js")
      await deleteFiles(share.files)
    }

    await Share.deleteOne({ shareId })

    res.json({ success: true, message: "Share deleted successfully" })
  } catch (error) {
    console.error("Delete share error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to delete share",
    })
  }
})

export default router
