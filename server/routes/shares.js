import express from "express"
import bcrypt from "bcryptjs"
import Share from "../database/models/Share.js"
import { generateShareId, calculateExpiryDate } from "../utils/helpers.js"

const router = express.Router()

router.post("/", async (req, res) => {
  try {
    const { mode, textContent, password, expiry, language, title } = req.body

    console.log("Creating share with data:", { mode, expiry, language, title, contentLength: textContent?.length })

    // Validate required fields
    if (!mode || !textContent) {
      return res.status(400).json({
        success: false,
        message: "Mode and text content are required",
      })
    }

    // Validate mode - fix the mode validation
    if (!["global", "collaborative", "private"].includes(mode)) {
      return res.status(400).json({
        success: false,
        message: "Invalid sharing mode",
      })
    }

    // Validate private mode requirements
    if (mode === "private" && !password) {
      return res.status(400).json({
        success: false,
        message: "Password is required for private sharing",
      })
    }

    const shareId = generateShareId()
    const expiresAt = calculateExpiryDate(expiry || "1hr")

    let hashedPassword = null
    if (mode === "private" && password) {
      hashedPassword = await bcrypt.hash(password, 10)
    }

    // Set different settings based on mode
    const settings = {
      allowEdit: true,
      allowDownload: true,
      maxUsers: 10,
    }

    switch (mode) {
      case "global":
        settings.maxUsers = 50 // Allow more users for global sharing
        break
      case "collaborative":
        settings.maxUsers = 20 // Medium limit for collaborative
        break
      case "private":
        settings.maxUsers = 5 // Fewer users for private sharing
        break
    }

    const share = new Share({
      shareId,
      mode,
      textContent: textContent || "",
      language: language || "plaintext",
      title: title || "Untitled Share",
      password: hashedPassword,
      expiresAt,
      settings,
    })

    const savedShare = await share.save()
    console.log("Share saved successfully:", savedShare.shareId)

    res.json({
      success: true,
      data: {
        shareId: savedShare.shareId,
        shareUrl: `http://localhost:5173/share/${savedShare.shareId}`,
        expiresAt: savedShare.expiresAt,
        mode: savedShare.mode,
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
    console.log("Found share:", share ? `Yes (${share.mode})` : "No")

    if (!share) {
      console.log("Share not found in database")
      return res.status(404).json({ success: false, message: "Share not found" })
    }

    console.log("Share expires at:", share.expiresAt, "Current time:", new Date())

    if (share.isExpired) {
      console.log("Share has expired")
      return res.status(410).json({ success: false, message: "Share has expired" })
    }

    // Check password for private shares
    if (share.mode === "private" && share.password) {
      if (!password) {
        return res.status(401).json({
          success: false,
          message: "Password required",
          requiresPassword: true,
        })
      }

      const isValidPassword = await bcrypt.compare(password, share.password)
      if (!isValidPassword) {
        return res.status(401).json({
          success: false,
          message: "Invalid password",
          requiresPassword: true,
        })
      }
    }

    // Increment view count
    share.stats.views += 1
    await share.save()

    const shareData = share.toObject()
    delete shareData.password // Never send password hash to client

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

// Get all shares (for debugging)
router.get("/", async (req, res) => {
  try {
    const shares = await Share.find({})
      .select("shareId mode title createdAt expiresAt stats")
      .sort({ createdAt: -1 })
      .limit(50)

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

    // Update fields if provided
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

    // Clean up associated files
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
