import express from "express";
import bcrypt from "bcryptjs";
import Share from "../database/models/Share.js";
import { generateShareId, calculateExpiryDate } from "../utils/helpers.js";

const router = express.Router();

// Debug endpoint to check share details
router.get("/debug/:shareId", async (req, res) => {
    try {
        const { shareId } = req.params;
        const share = await Share.findOne({ shareId });

        if (!share) {
            return res.status(404).json({ message: "Share not found" });
        }

        res.json({
            shareId: share.shareId,
            mode: share.mode,
            hasPassword: !!share.password,
            passwordLength: share.password ? share.password.length : 0,
            passwordHash: share.password ? share.password.substring(0, 20) + "..." : null,
            createdAt: share.createdAt,
            expiresAt: share.expiresAt,
            isExpired: share.isExpired,
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Database inspection endpoint
router.get("/inspect/:shareId", async (req, res) => {
    try {
        const { shareId } = req.params;
        const share = await Share.findOne({ shareId });

        if (!share) {
            return res.status(404).json({ error: "Share not found" });
        }

        // Raw database inspection
        const rawData = {
            shareId: share.shareId,
            mode: share.mode,
            title: share.title,
            hasPassword: !!share.password,
            passwordExists: share.password !== null && share.password !== undefined,
            passwordLength: share.password ? share.password.length : 0,
            passwordType: typeof share.password,
            passwordValue: share.password ? share.password.substring(0, 30) + "..." : share.password,
            createdAt: share.createdAt,
            expiresAt: share.expiresAt,
            isExpired: share.isExpired,
        };

        // Test bcrypt with known values
        if (share.password) {
            try {
                const testPasswords = ["123", "1234", "wrong", "test"];
                const testResults = {};

                for (const testPass of testPasswords) {
                    testResults[testPass] = await bcrypt.compare(testPass, share.password);
                }

                rawData.bcryptTests = testResults;
            } catch (e) {
                rawData.bcryptError = e.message;
            }
        }

        res.json(rawData);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post("/", async (req, res) => {
    try {
        const { mode, textContent, password, expiry, language, title } = req.body;

        // Validate required fields
        if (!mode || !textContent) {
            return res.status(400).json({
                success: false,
                message: "Mode and text content are required",
            });
        }

        // Validate mode
        if (!["global", "collaborative", "private"].includes(mode)) {
            return res.status(400).json({
                success: false,
                message: "Invalid sharing mode",
            });
        }

        // STRICT validation for private mode - MUST have password
        if (mode === "private" && (!password || password.trim().length === 0)) {
            return res.status(400).json({
                success: false,
                message: "Password is required for private sharing",
            });
        }

        const shareId = generateShareId();
        const expiresAt = calculateExpiryDate(expiry || "1hr");
        let hashedPassword = null;
        if (password && password.trim().length > 0) {
            // Hash password for ANY share that has a password
            hashedPassword = await bcrypt.hash(password.trim(), 12);
        }

        const share = new Share({
            shareId,
            mode,
            textContent: textContent || "",
            language: language || "plaintext",
            title: title || "Untitled Share",
            password: hashedPassword,
            expiresAt,
            settings: {
                allowEdit: true,
                allowDownload: true,
                maxUsers: mode === "global" ? 50 : mode === "collaborative" ? 20 : 5,
            },
        });

        const savedShare = await share.save();
        res.json({
            success: true,
            shareId: savedShare.shareId,
            shareUrl: `${req.protocol}://${req.get("host")}/share/${savedShare.shareId}`,
            expiresAt: savedShare.expiresAt,
            mode: savedShare.mode,
        });
    } catch (error) {
        console.error("Create share error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to create share",
            error: error.message,
        });
    }
});

router.get("/:shareId", async (req, res) => {
    try {
        const { shareId } = req.params;
        const { password: clientPassword } = req.query;
        const share = await Share.findOne({ shareId }).populate("files");

        if (!share) {
            return res.status(404).json({
                success: false,
                message: "Share not found. It may have expired or the link is invalid.",
            });
        }
        if (share.isExpired) {
            return res.status(410).json({
                success: false,
                message: "Share has expired",
            });
        }

        // *** ENHANCED SECURITY LOGIC ***
        // A share is protected if its password field is a non-empty string (a real hash is long).
        const isProtected = share.password && share.password.length > 20;

        // Case 1: The share is NOT protected (public).
        if (!isProtected) {
            // However, if it's in 'private' mode, it's a server configuration error.
            if (share.mode === 'private') {
                console.error("CRITICAL SERVER ERROR: Private share found with no valid password hash.");
                return res.status(500).json({ success: false, message: "Server configuration error for this share." });
            }
            share.stats.views += 1;
            await share.save();
            const shareData = share.toObject();
            delete shareData.password;
            return res.json({ success: true, data: shareData });
        }

        if (!clientPassword) {
            return res.status(401).json({
                success: false,
                message: "Password required for this share",
                requiresPassword: true,
            });
        }

        let isValidPassword = false;
        try {
            isValidPassword = await bcrypt.compare(clientPassword.trim(), share.password);
        } catch (bcryptError) {
            console.error("bcrypt comparison failed:", bcryptError);
            return res.status(500).json({
                success: false,
                message: "Authentication system error",
            });
        }

        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                message: "Invalid password. Please check your password and try again.",
                requiresPassword: true,
            });
        }

        // Increment view count and return data
        share.stats.views += 1;
        await share.save();
        const shareData = share.toObject();
        delete shareData.password; // Never send password hash to client

        res.json({
            success: true,
            data: shareData,
        });

    } catch (error) {
        console.error("Authentication error:", error);
        res.status(500).json({
            success: false,
            message: "Authentication failed due to server error",
            error: error.message,
        });
    }
});


// Get all shares (for debugging)
router.get("/", async (req, res) => {
    try {
        const shares = await Share.find({})
            .select("shareId mode title createdAt expiresAt stats password")
            .sort({ createdAt: -1 })
            .limit(50);

        const sharesWithPasswordStatus = shares.map((share) => ({
            shareId: share.shareId,
            mode: share.mode,
            title: share.title,
            createdAt: share.createdAt,
            expiresAt: share.expiresAt,
            hasPassword: !!share.password,
            passwordHashLength: share.password ? share.password.length : 0,
            views: share.stats?.views || 0,
        }));

        res.json({
            success: true,
            data: sharesWithPasswordStatus,
            count: shares.length,
        });
    } catch (error) {
        console.error("Get all shares error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to get shares",
        });
    }
});

router.put("/:shareId", async (req, res) => {
    try {
        const { shareId } = req.params;
        const { textContent, language, title } = req.body;

        const share = await Share.findOne({ shareId });

        if (!share) {
            return res.status(404).json({ success: false, message: "Share not found" });
        }

        if (share.isExpired) {
            return res.status(410).json({ success: false, message: "Share has expired" });
        }

        // Update fields if provided
        if (textContent !== undefined) share.textContent = textContent;
        if (language !== undefined) share.language = language;
        if (title !== undefined) share.title = title;

        share.stats.edits += 1;
        await share.save();

        res.json({
            success: true,
            data: {
                textContent: share.textContent,
                language: share.language,
                title: share.title,
            },
        });
    } catch (error) {
        console.error("Update share error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update share",
        });
    }
});

router.delete("/:shareId", async (req, res) => {
    try {
        const { shareId } = req.params;

        const share = await Share.findOne({ shareId }).populate("files");

        if (!share) {
            return res.status(404).json({ success: false, message: "Share not found" });
        }

        // Clean up associated files
        if (share.files && share.files.length > 0) {
            const { deleteFiles } = await import("../utils/cleanup.js");
            await deleteFiles(share.files);
        }

        await Share.deleteOne({ shareId });

        res.json({ success: true, message: "Share deleted successfully" });
    } catch (error) {
        console.error("Delete share error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to delete share",
        });
    }
});

export default router;
