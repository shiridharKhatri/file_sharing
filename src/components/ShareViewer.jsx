"use client"

import { useState, useEffect, useRef } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { shareAPI } from "../services/api"
import { useShare } from "../context/ShareContext"
import {
  Lock,
  Eye,
  Users,
  AlertCircle,
  Loader2,
  ArrowLeft,
  Edit3,
  EyeIcon,
  Download,
  Copy,
  Share2,
  Globe,
  Wifi,
  Shield,
  Settings,
  Moon,
  Sun,
  Palette,
  X,
  Upload,
  File,
  Plus,
  ImageIcon,
} from "lucide-react"
import { getFileIcon } from "../utils/helpers"
import "./ShareViewer.css"

export default function ShareViewer() {
  const { shareId } = useParams()
  const navigate = useNavigate()
  const {
    joinShare,
    share,
    connected,
    activeUsers,
    typingUsers,
    updateText,
    setTyping,
    uploadFiles,
    deleteFile,
    files,
  } = useShare()

  // ONLY THESE STATES MATTER FOR AUTHENTICATION
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [shareData, setShareData] = useState(null)
  const [password, setPassword] = useState("")
  const [passwordError, setPasswordError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Other UI states
  const [isEditing, setIsEditing] = useState(false)
  const [localText, setLocalText] = useState("")
  const [hasJoined, setHasJoined] = useState(false)
  const [theme, setTheme] = useState("dark")
  const [showSettings, setShowSettings] = useState(false)
  const [showUploadMenu, setShowUploadMenu] = useState(false)
  const [notification, setNotification] = useState(null)

  const fileInputRef = useRef(null)
  const uploadMenuRef = useRef(null)

  // STEP 1: ALWAYS START WITH AUTHENTICATION CHECK
  useEffect(() => {
    if (shareId) {
      // RESET EVERYTHING - NO BYPASSES
      setIsAuthenticated(false)
      setShareData(null)
      setLocalText("")
      setHasJoined(false)
      setLoading(false) // Show password screen immediately
    } else {
      setError("No share ID provided")
      setLoading(false)
    }
  }, [shareId])

  // STEP 2: ONLY AFTER AUTHENTICATION - JOIN SHARE
  useEffect(() => {
    if (connected && shareData && !hasJoined && isAuthenticated) {
      joinShare(shareId, "Viewer")
      setHasJoined(true)
    }
  }, [connected, shareData, shareId, hasJoined, isAuthenticated])

  // STEP 3: ONLY AFTER AUTHENTICATION - HANDLE UPDATES
  useEffect(() => {
    if (share && share.textContent !== undefined && hasJoined && isAuthenticated) {
      if (share.textContent !== localText && !window.textUpdateTimeout) {
        setLocalText(share.textContent)
      }
    }
  }, [share, hasJoined, isAuthenticated])

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme)
  }, [theme])

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (uploadMenuRef.current && !uploadMenuRef.current.contains(event.target)) {
        setShowUploadMenu(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const showNotification = (message, type = "success") => {
    setNotification({ message, type })
    setTimeout(() => setNotification(null), 3000)
  }

  // 🔒 MANDATORY AUTHENTICATION - NO EXCEPTIONS!
  const handlePasswordSubmit = async (e) => {
    e.preventDefault()

    if (!password.trim()) {
      setPasswordError("Password is required")
      return
    }

    setIsSubmitting(true)
    setPasswordError("")

    try {

      // TRY TO GET SHARE WITH PASSWORD
      const response = await shareAPI.get(shareId, password.trim())
      const data = response.data.data || response.data
      if (!data) {
        throw new Error("No data received")
      }
      // ONLY NOW SET AUTHENTICATED DATA
      setShareData(data)
      setLocalText(data.textContent || "")
      setIsAuthenticated(true)
      setIsSubmitting(false)

      showNotification("Authentication successful! 🎉")
    } catch (error) {
      console.error("❌ AUTHENTICATION FAILED:", error)

      // CLEAR EVERYTHING ON FAILURE
      setShareData(null)
      setLocalText("")
      setIsAuthenticated(false)
      setIsSubmitting(false)

      if (error.status === 401 || error.message.includes("Invalid password")) {
        setPasswordError("❌ Invalid password. Try again.")
      } else if (error.status === 404) {
        setPasswordError("❌ Share not found or expired.")
      } else {
        setPasswordError("❌ Authentication failed. Please try again.")
      }
    }
  }

  const handleTextChange = (newText) => {
    // 🔒 AUTHENTICATION REQUIRED
    if (!isAuthenticated) {
      showNotification("❌ Authentication required!", "error")
      return
    }

    setLocalText(newText)

    if (shareData && connected && hasJoined) {
      setTyping(shareId, true)

      if (window.textUpdateTimeout) {
        clearTimeout(window.textUpdateTimeout)
      }

      window.textUpdateTimeout = setTimeout(() => {
        updateText(shareId, newText, shareData.language)
        setTyping(shareId, false)
        window.textUpdateTimeout = null
      }, 1000)
    }
  }

  const addFiles = async (newFiles) => {
    // 🔒 AUTHENTICATION REQUIRED
    if (!isAuthenticated) {
      showNotification("❌ Authentication required to upload files!", "error")
      return
    }

    if (!newFiles || newFiles.length === 0) {
      showNotification("No files selected", "error")
      return
    }

    try {
      await uploadFiles(shareId, newFiles)
      setShowUploadMenu(false)
      showNotification(`✅ ${newFiles.length} file(s) uploaded!`)
    } catch (error) {
      showNotification("❌ Upload failed!", "error")
    }
  }

  const removeFile = async (fileId) => {
    // 🔒 AUTHENTICATION REQUIRED
    if (!isAuthenticated) {
      showNotification("❌ Authentication required to delete files!", "error")
      return
    }

    try {
      await deleteFile(fileId)
      showNotification("✅ File removed!")
    } catch (error) {
      showNotification("❌ Delete failed!", "error")
    }
  }

  const copyToClipboard = (text) => {
    // 🔒 AUTHENTICATION REQUIRED
    if (!isAuthenticated) {
      showNotification("❌ Authentication required!", "error")
      return
    }

    navigator.clipboard.writeText(text)
    showNotification("✅ Copied to clipboard!")
  }

  const downloadContent = () => {
    // 🔒 AUTHENTICATION REQUIRED
    if (!isAuthenticated) {
      showNotification("❌ Authentication required!", "error")
      return
    }

    const element = document.createElement("a")
    const file = new Blob([localText], { type: "text/plain" })
    element.href = URL.createObjectURL(file)
    element.download = `${shareData?.title || "shared-content"}.txt`
    document.body.appendChild(element)
    element.click()
    document.body.removeChild(element)
    showNotification("✅ Downloaded!")
  }

  const getModeConfig = () => {
    const modes = {
      global: { label: "Public", icon: Globe, color: "#0ea5e9" },
      collaborative: { label: "Collaborative", icon: Wifi, color: "#059669" },
      private: { label: "Private", icon: Shield, color: "#7c3aed" },
    }
    return modes[shareData?.mode] || modes.private
  }

  const themes = [
    { id: "dark", name: "Dark", icon: Moon },
    { id: "light", name: "Light", icon: Sun },
    { id: "auto", name: "Auto", icon: Palette },
  ]

  // 🚨 SHOW LOADING ONLY BRIEFLY
  if (loading) {
    return (
      <div className="share-viewer">
        <div className="loading-container">
          <div className="loading-content">
            <div className="loading-spinner-wrapper">
              <Loader2 className="loading-spinner" />
            </div>
            <h3 className="loading-title">Initializing...</h3>
            <p className="loading-text">Preparing authentication for: {shareId}</p>
          </div>
        </div>
      </div>
    )
  }

  // 🚨 SHOW ERROR SCREEN
  if (error) {
    return (
      <div className="share-viewer">
        <div className="error-container">
          <div className="error-content">
            <div className="error-icon-wrapper">
              <AlertCircle className="error-icon" />
            </div>
            <h1 className="error-title">Share Error</h1>
            <p className="error-message">{error}</p>
            <div className="error-actions">
              <button onClick={() => navigate("/")} className="error-button">
                <ArrowLeft size={16} />
                Go Home
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // 🔒 MANDATORY PASSWORD SCREEN - NO BYPASSES!
  if (!isAuthenticated) {
    return (
      <div className="share-viewer">
        <div className="password-container">
          <div className="password-modal">
            <div className="password-header">
              <div className="password-icon-wrapper">
                <Lock className="password-icon" />
              </div>
              <h1 className="password-title">🔒 Authentication Required</h1>
              <p className="password-subtitle">
                Enter the password to access this share: <strong>{shareId}</strong>
              </p>
            </div>

            <form onSubmit={handlePasswordSubmit} className="password-form">
              <div className="password-field">
                <label className="password-label">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    setPasswordError("")
                  }}
                  className={`password-input ${passwordError ? "error" : ""}`}
                  placeholder="Enter password to unlock..."
                  required
                  autoFocus
                  disabled={isSubmitting}
                />
                {passwordError && (
                  <div className="password-error">
                    <AlertCircle size={14} />
                    {passwordError}
                  </div>
                )}
              </div>

              <button type="submit" className="password-submit" disabled={isSubmitting || !password.trim()}>
                {isSubmitting ? (
                  <>
                    <Loader2 size={16} className="spinning" />🔐 Authenticating...
                  </>
                ) : (
                  <>
                    <Lock size={16} />🔓 Unlock Share
                  </>
                )}
              </button>
            </form>

            <button onClick={() => navigate("/")} className="password-back">
              ← Back to Home
            </button>

            <div
              style={{
                marginTop: "20px",
                padding: "12px",
                background: "#21262d",
                borderRadius: "8px",
                fontSize: "12px",
                color: "#8b949e",
              }}
            >
              🔒 <strong>Security Notice:</strong> This share is protected. Authentication is mandatory for ALL users.
            </div>
          </div>
        </div>
      </div>
    )
  }

  // 🚨 FINAL CHECK - NO CONTENT WITHOUT AUTHENTICATION
  if (!shareData) {
    return (
      <div className="share-viewer">
        <div className="loading-container">
          <div className="loading-content">
            <div className="loading-spinner-wrapper">
              <Loader2 className="loading-spinner" />
            </div>
            <h3 className="loading-title">🔒 Verifying Authentication</h3>
            <p className="loading-text">Loading authenticated content...</p>
          </div>
        </div>
      </div>
    )
  }

  const modeConfig = getModeConfig()
  const IconComponent = modeConfig.icon
  const allFiles = [...(shareData?.files || []), ...files]

  return (
    <div className="share-viewer app" data-theme={theme}>
      {/* Notification */}
      {notification && (
        <div className={`notification ${notification.type}`}>
          <div className="notification-content">
            {notification.type === "success" ? <Eye size={16} /> : <AlertCircle size={16} />}
            <span>{notification.message}</span>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="header">
        <div className="header-left">
          <div className="brand">
            <button onClick={() => navigate("/")} className="logo-back-btn">
              <Share2 size={20} />
            </button>
            <div className="brand-text">
              <h1>Shareee.me</h1>
              <span>🔒 Authenticated Session</span>
            </div>
          </div>

          <div className="mode-display">
            <div className="mode-btn active" style={{ "--mode-color": modeConfig.color }}>
              <IconComponent size={16} />
              <span>{modeConfig.label}</span>
            </div>
          </div>
        </div>

        <div className="header-right">
          <div className="file-section">
            {allFiles.length > 0 && (
              <div className="file-chips">
                {allFiles.slice(0, 3).map((file) => {
                  const FileIconComponent = getFileIcon(file.mimetype || "application/octet-stream")
                  return (
                    <div key={file._id || file.id} className="file-chip">
                      <FileIconComponent size={12} />
                      <span>{file.originalName}</span>
                      <button onClick={() => removeFile(file._id || file.id)}>
                        <X size={10} />
                      </button>
                    </div>
                  )
                })}
                {allFiles.length > 3 && <div className="file-chip more">+{allFiles.length - 3}</div>}
              </div>
            )}

            <div className="upload-section" ref={uploadMenuRef}>
              <button
                className="upload-btn"
                onClick={() => setShowUploadMenu(!showUploadMenu)}
                title="Upload files (Authenticated)"
              >
                <Upload size={16} />
                <span>Upload</span>
              </button>

              {showUploadMenu && (
                <div className="upload-menu">
                  <button onClick={() => fileInputRef.current?.click()}>
                    <File size={14} />
                    <span>Browse Files</span>
                  </button>
                  <button onClick={() => fileInputRef.current?.click()}>
                    <ImageIcon size={14} />
                    <span>Upload Photos</span>
                  </button>
                  <button onClick={() => fileInputRef.current?.click()}>
                    <Plus size={14} />
                    <span>Add Multiple</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="header-actions">
            {/* AUTHENTICATION STATUS - ALWAYS SHOW */}
            <div className="sharing-status" style={{ color: "#3fb950", fontWeight: "bold" }}>
              <Lock size={14} />
              <span>🔓 AUTHENTICATED</span>
            </div>

            {/* Active Users */}
            {activeUsers > 0 && hasJoined && (
              <div className="active-users">
                <Users size={14} />
                <span>{activeUsers}</span>
              </div>
            )}

            {/* Views Counter */}
            <div className="sharing-status">
              <Eye size={14} />
              <span>{shareData?.stats?.views || 0} views</span>
            </div>

            <div className="theme-selector">
              {themes.map((themeOption) => {
                const ThemeIconComponent = themeOption.icon
                return (
                  <button
                    key={themeOption.id}
                    className={`theme-btn ${theme === themeOption.id ? "active" : ""}`}
                    onClick={() => setTheme(themeOption.id)}
                    title={themeOption.name}
                  >
                    <ThemeIconComponent size={14} />
                  </button>
                )
              })}
            </div>
            <button className="icon-btn" onClick={() => setShowSettings(true)}>
              <Settings size={16} />
            </button>
          </div>
        </div>
      </header>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="*/*"
        onChange={(e) => addFiles(e.target.files)}
        style={{ display: "none" }}
      />

      {/* Editor Container */}
      <main className="editor-container">
        <div className="editor-header">
          <div className="editor-info">
            <div className="language-indicator">
              <span>{shareData?.language || "plaintext"}</span>
            </div>
            <div className="editor-stats">
              <span>{localText.length} chars</span>
              <span>{localText.split("\n").length} lines</span>
              <span>{localText.split(/\s+/).filter((w) => w).length} words</span>
            </div>
            {/* Typing Indicators */}
            {typingUsers.length > 0 && (
              <div className="typing-indicators">
                {typingUsers.map((user) => (
                  <span key={user.socketId} className="typing-user">
                    {user.username} is typing...
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="editor-actions">
            {localText && (
              <>
                <button className="action-btn" onClick={() => copyToClipboard(localText)}>
                  <Copy size={14} />
                  <span>Copy</span>
                </button>
                <button className="action-btn" onClick={downloadContent}>
                  <Download size={14} />
                  <span>Download</span>
                </button>
              </>
            )}
            <button className={`action-btn ${isEditing ? "active" : ""}`} onClick={() => setIsEditing(!isEditing)}>
              {isEditing ? <EyeIcon size={14} /> : <Edit3 size={14} />}
              <span>{isEditing ? "View" : "Edit"}</span>
            </button>
          </div>
        </div>

        <div className="editor-wrapper">
          <div className="line-numbers">
            {localText.split("\n").map((_, index) => (
              <div key={index} className="line-number">
                {index + 1}
              </div>
            ))}
          </div>

          {isEditing ? (
            <textarea
              className="code-editor"
              value={localText}
              onChange={(e) => handleTextChange(e.target.value)}
              placeholder="🔓 Authenticated - Start editing..."
              spellCheck={false}
            />
          ) : (
            <pre className="code-editor readonly">
              {localText || <span className="placeholder-text">🔓 Authenticated - No content yet</span>}
            </pre>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-left">
          <div className="mode-info">
            <div className="mode-indicator" style={{ backgroundColor: modeConfig.color }}>
              <IconComponent size={12} />
            </div>
            <span>{shareData?.title || "Authenticated Share"}</span>
            <span className="status connected">🔓 AUTHENTICATED</span>
          </div>
        </div>

        <div className="footer-center">
          <div className="mode-description">
            <Lock size={12} />
            <span>Secure authenticated session</span>
          </div>
          {allFiles.length > 0 && (
            <div className="mode-description">
              <File size={12} />
              <span>{allFiles.length} files attached</span>
            </div>
          )}
        </div>

        <div className="footer-right">
          <div className="share-result">
            <span>🔒 Share ID: {shareId}</span>
          </div>
        </div>
      </footer>

      {/* Files Section - AUTHENTICATED ONLY */}
      {allFiles.length > 0 && (
        <div className="files-overlay">
          <div className="files-section">
            <h3 className="files-title">🔓 Authenticated Files ({allFiles.length})</h3>
            <div className="files-list">
              {allFiles.map((file) => {
                const FileIconComponent = getFileIcon(file.mimetype || "application/octet-stream")
                return (
                  <div key={file._id || file.id} className="file-item">
                    <div className="file-info">
                      <div className="file-icon">
                        <FileIconComponent size={16} />
                      </div>
                      <div className="file-details">
                        <p className="file-name">{file.originalName}</p>
                        <p className="file-size">{((file.size || 0) / 1024).toFixed(1)} KB</p>
                        <p className="file-expiry">Auto-delete in 12 hours</p>
                      </div>
                    </div>
                    <div className="file-actions">
                      <a
                        href={`${import.meta.env.VITE_BACKEND_HOST || "http://localhost:5000"}/api/files/download/${file._id || file.id}`}
                        className="file-download"
                        download
                      >
                        <Download size={12} />
                      </a>
                      <button className="file-delete" onClick={() => removeFile(file._id || file.id)}>
                        <X size={12} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="settings-overlay" onClick={() => setShowSettings(false)}>
          <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
            <div className="settings-header">
              <h3>🔒 Authenticated Session</h3>
              <button onClick={() => setShowSettings(false)}>
                <X size={16} />
              </button>
            </div>

            <div className="settings-content">
              <div className="setting-group">
                <h4>🔓 Authentication Status</h4>
                <div className="setting-item">
                  <label>
                    <span>Status</span>
                    <span className="status connected">✅ AUTHENTICATED</span>
                  </label>
                </div>
                <div className="setting-item">
                  <label>
                    <span>Share ID</span>
                    <span style={{ fontSize: "11px", color: "#8b949e" }}>{shareId}</span>
                  </label>
                </div>
                <div className="setting-item">
                  <label>
                    <span>Mode</span>
                    <span style={{ color: modeConfig.color, fontWeight: 600 }}>{modeConfig.label}</span>
                  </label>
                </div>
              </div>

              <div className="setting-group">
                <h4>Session Info</h4>
                <div className="setting-item">
                  <label>
                    <span>Views</span>
                    <span>{shareData?.stats?.views || 0}</span>
                  </label>
                </div>
                <div className="setting-item">
                  <label>
                    <span>Active Users</span>
                    <span>{activeUsers}</span>
                  </label>
                </div>
                <div className="setting-item">
                  <label>
                    <span>Content Length</span>
                    <span>{localText.length} characters</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
