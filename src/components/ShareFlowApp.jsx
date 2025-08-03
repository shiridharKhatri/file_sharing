"use client"

import { useState, useRef, useEffect } from "react"
import {
  Globe,
  Shield,
  Upload,
  Download,
  Share2,
  X,
  Loader2,
  Copy,
  Link,
  Settings,
  Moon,
  Sun,
  Plus,
  Check,
  AlertCircle,
  File,
  Code,
  Palette,
  Users,
  Lock,
  Wifi,
} from "lucide-react"
import { detectCodeLanguage, getFileIcon, downloadTextAsFile, getLanguageExtension } from "../utils/helpers"
import { useShare } from "../context/ShareContext"

function ShareFlowApp() {
  const {
    loading,
    error,
    share,
    files,
    activeUsers,
    connected,
    typingUsers,
    createShare,
    uploadFiles,
    deleteFile,
    joinShare,
    updateText,
    setTyping,
    clearError,
  } = useShare()

  const [selectedMode, setSelectedMode] = useState("public")
  const [textContent, setTextContent] = useState("")
  const [password, setPassword] = useState("")
  const [expiry, setExpiry] = useState("1hr")
  const [shareLink, setShareLink] = useState("")
  const [notification, setNotification] = useState(null)
  const [theme, setTheme] = useState("dark")
  const [showUploadMenu, setShowUploadMenu] = useState(false)
  const [detectedLanguage, setDetectedLanguage] = useState("plaintext")
  const [showSettings, setShowSettings] = useState(false)
  const [syntaxHighlighting, setSyntaxHighlighting] = useState(true)
  const [fontSize, setFontSize] = useState(13)
  const [tabSize, setTabSize] = useState(2)
  const [wordWrap, setWordWrap] = useState(false)
  const [autoSave, setAutoSave] = useState(true)
  const [typingTimeout, setTypingTimeout] = useState(null)
  const [isSharing, setIsSharing] = useState(false)
  const [currentShareId, setCurrentShareId] = useState(null)

  const fileInputRef = useRef(null)
  const uploadMenuRef = useRef(null)
  const textareaRef = useRef(null)

  const modes = [
    {
      id: "public",
      label: "Public",
      icon: Globe,
      color: "#0ea5e9",
      description: "Anyone can view and edit",
    },
    {
      id: "collaborative",
      label: "Collaborative",
      icon: Wifi,
      color: "#059669",
      description: "Local network users only",
    },
    {
      id: "private",
      label: "Private",
      icon: Shield,
      color: "#7c3aed",
      description: "Password protected link",
    },
  ]

  const themes = [
    { id: "dark", name: "Dark", icon: Moon },
    { id: "light", name: "Light", icon: Sun },
    { id: "auto", name: "Auto", icon: Palette },
  ]

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme)
  }, [theme])

  useEffect(() => {
    const language = detectCodeLanguage(textContent)
    setDetectedLanguage(language || "plaintext")
  }, [textContent])

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (uploadMenuRef.current && !uploadMenuRef.current.contains(event.target)) {
        setShowUploadMenu(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Auto-join public/collaborative shares when connected and mode is selected
  useEffect(() => {
    if (connected && (selectedMode === "public" || selectedMode === "collaborative") && !isSharing) {
      console.log(`Auto-joining ${selectedMode} mode`)
      handleAutoJoin()
    }
  }, [connected, selectedMode])

  // Handle real-time text updates from other users
  useEffect(() => {
    if (share && share.textContent !== undefined && isSharing) {
      // Only update if the text is actually different and we're not currently typing
      if (share.textContent !== textContent && !typingTimeout) {
        console.log("Updating text from share:", share.textContent.substring(0, 50) + "...")
        setTextContent(share.textContent)
        setDetectedLanguage(share.language || detectCodeLanguage(share.textContent) || "plaintext")
      }
    }
  }, [share, isSharing])

  // Show error notifications
  useEffect(() => {
    if (error) {
      showNotification(error, "error")
      clearError()
    }
  }, [error, clearError])

  const showNotification = (message, type = "success") => {
    setNotification({ message, type })
    setTimeout(() => setNotification(null), 3000)
  }

  const handleAutoJoin = () => {
    if (selectedMode === "public") {
      const publicShareId = "public-global"
      setCurrentShareId(publicShareId)
      setIsSharing(true)
      joinShare(publicShareId, "User")
      showNotification("Connected to public collaboration space!")
    } else if (selectedMode === "collaborative") {
      const localShareId = "local-network"
      setCurrentShareId(localShareId)
      setIsSharing(true)
      joinShare(localShareId, "User")
      showNotification("Connected to local network collaboration!")
    }
  }

  const addFiles = async (newFiles) => {
    if (!currentShareId) {
      showNotification("Please start sharing first", "error")
      return
    }

    try {
      await uploadFiles(currentShareId, Array.from(newFiles))
      setShowUploadMenu(false)
      showNotification(`${newFiles.length} file(s) uploaded successfully`)
    } catch (error) {
      showNotification("Failed to upload files", "error")
    }
  }

  const removeFile = async (fileId) => {
    try {
      await deleteFile(fileId)
      showNotification("File removed")
    } catch (error) {
      showNotification("Failed to remove file", "error")
    }
  }

  const handleModeChange = (newMode) => {
    if (isSharing && newMode !== selectedMode) {
      // Reset sharing state when changing modes
      setIsSharing(false)
      setCurrentShareId(null)
      setShareLink("")
    }
    setSelectedMode(newMode)

    // Auto-join if switching to public/collaborative and connected
    if (connected && (newMode === "public" || newMode === "collaborative")) {
      setTimeout(() => {
        if (newMode === "public") {
          const publicShareId = "public-global"
          setCurrentShareId(publicShareId)
          setIsSharing(true)
          joinShare(publicShareId, "User")
          showNotification("Switched to public collaboration!")
        } else if (newMode === "collaborative") {
          const localShareId = "local-network"
          setCurrentShareId(localShareId)
          setIsSharing(true)
          joinShare(localShareId, "User")
          showNotification("Switched to local network collaboration!")
        }
      }, 100)
    }
  }

  const handleStartSharing = async () => {
    console.log(`Starting sharing in ${selectedMode} mode`)

    if (selectedMode === "public" || selectedMode === "collaborative") {
      // For public/collaborative, just sync current text if any
      if (textContent.trim() && currentShareId) {
        setTimeout(() => {
          updateText(currentShareId, textContent, detectedLanguage)
        }, 500)
      }
      showNotification(`${selectedMode === "public" ? "Public" : "Local network"} sharing is already active!`)
      return
    }

    // Handle private mode
    if (selectedMode === "private") {
      if (!textContent.trim()) {
        showNotification("Please enter some content to share", "error")
        return
      }

      if (!password.trim()) {
        showNotification("Please enter a password for private sharing", "error")
        return
      }

      try {
        console.log("Creating private share")
        const shareData = {
          mode: "private", // Use "private" instead of selectedMode
          textContent,
          password,
          expiry,
          language: detectedLanguage,
          title: "Private ShareFlow Document",
        }

        const result = await createShare(shareData)
        console.log("Private share created:", result.shareId)

        const newShareLink = `${window.location.origin}/share/${result.shareId}`
        setShareLink(newShareLink)
        setCurrentShareId(result.shareId)
        setIsSharing(true)

        // Join the private share
        console.log("Joining private share")
        joinShare(result.shareId, "Creator")

        showNotification("Private link generated! Share the link with others.")
      } catch (error) {
        console.error("Private share creation failed:", error)
        showNotification(`Failed to create private share: ${error.message}`, "error")
      }
    }
  }

  const handleTextChange = (newText) => {
    setTextContent(newText)

    if (currentShareId && isSharing && connected) {
      // Clear existing timeout
      if (typingTimeout) {
        clearTimeout(typingTimeout)
      }

      // Send typing indicator
      setTyping(currentShareId, true)

      // Set new timeout for auto-save and stop typing
      const timeout = setTimeout(() => {
        setTyping(currentShareId, false)

        // Send the text update
        console.log("Sending text update to server")
        updateText(currentShareId, newText, detectedLanguage)
        setTypingTimeout(null)
      }, 1000)

      setTypingTimeout(timeout)
    }
  }

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text)
    showNotification("Copied to clipboard!")
  }

  const handleDownload = () => {
    if (!textContent.trim()) {
      showNotification("No content to download", "error")
      return
    }

    const extension = getLanguageExtension(detectedLanguage)
    const filename = `shareflow-content${extension}`
    downloadTextAsFile(textContent, filename)
    showNotification(`Downloaded as ${filename}`)
  }

  const getShareButtonText = () => {
    if (selectedMode === "private") {
      return isSharing ? "Private Link Active" : "Generate Private Link"
    }

    // For public/collaborative, always show as active when connected
    if (isSharing) {
      return selectedMode === "public" ? "Public Sharing Active" : "Local Sharing Active"
    }

    return selectedMode === "public" ? "Public Sharing" : "Local Sharing"
  }

  const currentMode = modes.find((m) => m.id === selectedMode)

  return (
    <div className="app" data-theme={theme}>
      {/* Connection Status */}
      {!connected && (
        <div className="connection-status">
          <Loader2 size={16} className="spinning" />
          <span>Connecting to server...</span>
        </div>
      )}

      {/* Notification */}
      {notification && (
        <div className={`notification ${notification.type}`}>
          <div className="notification-content">
            {notification.type === "success" ? <Check size={16} /> : <AlertCircle size={16} />}
            <span>{notification.message}</span>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="header">
        <div className="header-left">
          <div className="brand">
            <div className="logo">
              <Share2 size={20} />
            </div>
            <div className="brand-text">
              <h1>Shareee.me</h1>
              <span>Real-time Collaboration</span>
            </div>
          </div>

          <div className="mode-selector">
            {modes.map((mode) => {
              const IconComponent = mode.icon
              return (
                <button
                  key={mode.id}
                  className={`mode-btn ${selectedMode === mode.id ? "active" : ""}`}
                  onClick={() => handleModeChange(mode.id)}
                  style={{ "--mode-color": mode.color }}
                  title={mode.description}
                >
                  <IconComponent size={16} />
                  <span>{mode.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="header-right">
          <div className="file-section">
            {files.length > 0 && (
              <div className="file-chips">
                {files.slice(0, 3).map((file) => {
                  const IconComponent = getFileIcon(file.mimetype)
                  return (
                    <div key={file.id} className="file-chip">
                      <IconComponent size={12} />
                      <span>{file.originalName}</span>
                      <button onClick={() => removeFile(file.id)}>
                        <X size={10} />
                      </button>
                    </div>
                  )
                })}
                {files.length > 3 && <div className="file-chip more">+{files.length - 3}</div>}
              </div>
            )}

            <div className="upload-section" ref={uploadMenuRef}>
              <button className="upload-btn" onClick={() => setShowUploadMenu(!showUploadMenu)} disabled={!isSharing}>
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
                    <Plus size={14} />
                    <span>Add Multiple</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="header-actions">
            {/* Active Users Indicator */}
            {activeUsers > 0 && isSharing && (
              <div className="active-users">
                <Users size={14} />
                <span>{activeUsers}</span>
              </div>
            )}

            {/* Sharing Status */}
            {isSharing && (
              <div className="sharing-status" style={{ color: currentMode.color }}>
                <div className="status-dot"></div>
                <span>Live</span>
              </div>
            )}

            <div className="theme-selector">
              {themes.map((themeOption) => {
                const IconComponent = themeOption.icon
                return (
                  <button
                    key={themeOption.id}
                    className={`theme-btn ${theme === themeOption.id ? "active" : ""}`}
                    onClick={() => setTheme(themeOption.id)}
                    title={themeOption.name}
                  >
                    <IconComponent size={14} />
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
        onChange={(e) => addFiles(e.target.files)}
        style={{ display: "none" }}
      />

      {/* Editor */}
      <main className="editor-container">
        <div className="editor-header">
          <div className="editor-info">
            <div className="language-indicator">
              <Code size={14} />
              <span>{detectedLanguage}</span>
            </div>
            <div className="editor-stats">
              <span>{textContent.length} chars</span>
              <span>{textContent.split("\n").length} lines</span>
              <span>{textContent.split(/\s+/).filter((w) => w).length} words</span>
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
            {textContent && (
              <>
                <button className="action-btn" onClick={() => copyToClipboard(textContent)}>
                  <Copy size={14} />
                  <span>Copy</span>
                </button>
                <button className="action-btn" onClick={handleDownload}>
                  <Download size={14} />
                  <span>Download</span>
                </button>
              </>
            )}
          </div>
        </div>

        <div className="editor-wrapper">
          <div className="line-numbers">
            {textContent.split("\n").map((_, index) => (
              <div key={index} className="line-number">
                {index + 1}
              </div>
            ))}
          </div>

          <textarea
            ref={textareaRef}
            className={`code-editor language-${detectedLanguage} ${syntaxHighlighting ? "syntax-enabled" : "syntax-disabled"}`}
            placeholder={
              selectedMode === "private"
                ? "Enter content and password, then generate private link to share..."
                : `Start typing or paste your code here...

// ShareFlow supports real-time collaboration
// Your content will be automatically synced with other users in ${selectedMode} mode`
            }
            value={textContent}
            onChange={(e) => handleTextChange(e.target.value)}
            spellCheck={false}
            style={{
              fontSize: `${fontSize}px`,
              tabSize: tabSize,
              whiteSpace: wordWrap ? "pre-wrap" : "pre",
            }}
          />
        </div>
      </main>

      {/* Footer Controls */}
      <footer className="footer">
        <div className="footer-left">
          <div className="mode-info">
            <div className="mode-indicator" style={{ backgroundColor: currentMode.color }}>
              <currentMode.icon size={12} />
            </div>
            <span>{currentMode.description}</span>
            {connected && <span className="status connected">Connected</span>}
            {!connected && <span className="status disconnected">Disconnected</span>}
          </div>
        </div>

        <div className="footer-center">
          {selectedMode === "private" && (
            <div className="password-section">
              <Lock size={14} />
              <input
                type="password"
                placeholder="Enter password for private sharing..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="password-input"
              />
            </div>
          )}

          {selectedMode === "private" && (
            <div className="expiry-section">
              <span>Expires:</span>
              <select value={expiry} onChange={(e) => setExpiry(e.target.value)} className="expiry-select">
                <option value="10min">10 minutes</option>
                <option value="1hr">1 hour</option>
                <option value="6hr">6 hours</option>
                <option value="24hr">24 hours</option>
                <option value="7d">7 days</option>
                <option value="never">Never</option>
              </select>
            </div>
          )}
        </div>

        <div className="footer-right">
          {shareLink && selectedMode === "private" && (
            <div className="share-result">
              <Link size={14} />
              <input type="text" value={shareLink} readOnly className="share-input" />
              <button onClick={() => copyToClipboard(shareLink)} className="copy-btn">
                <Copy size={14} />
              </button>
            </div>
          )}

          {/* Only show share button for private mode */}
          {selectedMode === "private" && (
            <button
              className="share-btn primary"
              onClick={handleStartSharing}
              disabled={loading || !connected}
              style={{ backgroundColor: currentMode.color }}
            >
              {loading ? <Loader2 size={16} className="spinning" /> : <Share2 size={16} />}
              <span>{getShareButtonText()}</span>
            </button>
          )}
        </div>
      </footer>

      {/* Settings Modal */}
      {showSettings && (
        <div className="settings-overlay" onClick={() => setShowSettings(false)}>
          <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
            <div className="settings-header">
              <h3>Editor Settings</h3>
              <button onClick={() => setShowSettings(false)}>
                <X size={16} />
              </button>
            </div>

            <div className="settings-content">
              <div className="setting-group">
                <h4>Sharing Mode</h4>
                <div className="setting-item">
                  <label>
                    <span>Current Mode</span>
                    <span style={{ color: currentMode.color, fontWeight: 600 }}>{currentMode.label}</span>
                  </label>
                </div>
                <div className="setting-item">
                  <label>
                    <span>Status</span>
                    <span className={`status ${isSharing ? "connected" : "disconnected"}`}>
                      {isSharing ? "Active" : "Inactive"}
                    </span>
                  </label>
                </div>
                <div className="setting-item">
                  <label>
                    <span>Share ID</span>
                    <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>{currentShareId || "None"}</span>
                  </label>
                </div>
              </div>

              <div className="setting-group">
                <h4>Appearance</h4>
                <div className="setting-item">
                  <label>
                    <input
                      type="checkbox"
                      checked={syntaxHighlighting}
                      onChange={(e) => setSyntaxHighlighting(e.target.checked)}
                    />
                    <span>Syntax Highlighting</span>
                  </label>
                </div>
                <div className="setting-item">
                  <label>
                    <span>Font Size</span>
                    <input
                      type="range"
                      min="10"
                      max="20"
                      value={fontSize}
                      onChange={(e) => setFontSize(Number(e.target.value))}
                    />
                    <span>{fontSize}px</span>
                  </label>
                </div>
                <div className="setting-item">
                  <label>
                    <input type="checkbox" checked={wordWrap} onChange={(e) => setWordWrap(e.target.checked)} />
                    <span>Word Wrap</span>
                  </label>
                </div>
              </div>

              <div className="setting-group">
                <h4>Editor</h4>
                <div className="setting-item">
                  <label>
                    <span>Tab Size</span>
                    <select value={tabSize} onChange={(e) => setTabSize(Number(e.target.value))}>
                      <option value={2}>2 spaces</option>
                      <option value={4}>4 spaces</option>
                      <option value={8}>8 spaces</option>
                    </select>
                  </label>
                </div>
                <div className="setting-item">
                  <label>
                    <input type="checkbox" checked={autoSave} onChange={(e) => setAutoSave(e.target.checked)} />
                    <span>Auto Save</span>
                  </label>
                </div>
              </div>

              <div className="setting-group">
                <h4>Collaboration</h4>
                <div className="setting-item">
                  <label>
                    <span>Connection Status</span>
                    <span className={`status ${connected ? "connected" : "disconnected"}`}>
                      {connected ? "Connected" : "Disconnected"}
                    </span>
                  </label>
                </div>
                <div className="setting-item">
                  <label>
                    <span>Active Users</span>
                    <span>{activeUsers}</span>
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

export default ShareFlowApp
