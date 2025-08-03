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

    // Validate mode
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

    console.log("Generated shareId:", shareId)
    console.log("Expires at:", expiresAt)

    let hashedPassword = null
    if (mode === "private" && password) {
      hashedPassword = await bcrypt.hash(password, 10)
      console.log("Password hashed successfully")
    }

    // Set different settings based on mode
    const settings = {
      allowEdit: true,
      allowDownload: true,
      maxUsers: 10,
    }

    switch (mode) {
      case "global":
        settings.maxUsers = 50
        break
      case "collaborative":
        settings.maxUsers = 20
        break
      case "private":
        settings.maxUsers = 5
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

    // Return the response with proper structure
    res.json({
      success: true,
      shareId: savedShare.shareId, // Make sure this is at the top level
      shareUrl: `http://localhost:5173/share/${savedShare.shareId}`,
      expiresAt: savedShare.expiresAt,
      mode: savedShare.mode,
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

    console.log("API: Looking for share:", shareId)

    // Add timeout to prevent hanging requests
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Database query timeout")), 5000),
    )

    const queryPromise = Share.findOne({ shareId }).populate("files")
    const share = await Promise.race([queryPromise, timeoutPromise])

    console.log("API: Found share:", share ? `Yes (${share.mode})` : "No")

    if (!share) {
      console.log("API: Share not found in database")
      return res.status(404).json({
        success: false,
        message: "Share not found. It may have expired or the link is invalid.",
        shareId: shareId,
      })
    }

    console.log("API: Share expires at:", share.expiresAt, "Current time:", new Date())

    if (share.isExpired) {
      console.log("API: Share has expired")
      return res.status(410).json({
        success: false,
        message: "Share has expired",
        shareId: shareId,
      })
    }

    // Check password for private shares
    if (share.mode === "private" && share.password) {
      if (!password) {
        console.log("API: Password required for private share")
        return res.status(401).json({
          success: false,
          message: "Password required",
          requiresPassword: true,
          shareId: shareId,
        })
      }

      const isValidPassword = await bcrypt.compare(password, share.password)
      if (!isValidPassword) {
        console.log("API: Invalid password provided")
        return res.status(401).json({
          success: false,
          message: "Invalid password",
          requiresPassword: true,
          shareId: shareId,
        })
      }
    }

    // Increment view count
    share.stats.views += 1
    await share.save()

    const shareData = share.toObject()
    delete shareData.password // Never send password hash to client

    console.log("API: Returning share data successfully")

    res.json({
      success: true,
      data: shareData,
    })
  } catch (error) {
    console.error("API: Get share error:", error)

    if (error.message.includes("timeout")) {
      return res.status(408).json({
        success: false,
        message: "Request timeout. Please try again.",
        shareId: req.params.shareId,
      })
    }

    res.status(500).json({
      success: false,
      message: "Failed to get share. Please try again.",
      error: error.message,
      shareId: req.params.shareId,
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
