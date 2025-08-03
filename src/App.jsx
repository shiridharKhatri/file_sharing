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
} from "lucide-react"
import {
  detectCodeLanguage,
  getFileIcon,
  validateForm,
  downloadTextAsFile,
  getLanguageExtension,
} from "./utils/helpers"
import { ShareProvider, useShare } from "./context/ShareContext"
import "./App.css"

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

  const [selectedMode, setSelectedMode] = useState("global")
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

  const fileInputRef = useRef(null)
  const uploadMenuRef = useRef(null)
  const textareaRef = useRef(null)

  const modes = [
    {
      id: "global",
      label: "Public",
      icon: Globe,
      color: "#0ea5e9",
      description: "Anyone can view and edit",
    },
    {
      id: "collaborative",
      label: "Collaborative",
      icon: Users,
      color: "#059669",
      description: "Team editing and sharing",
    },
    {
      id: "private",
      label: "Private",
      icon: Shield,
      color: "#7c3aed",
      description: "Generate secure link",
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

  // Handle real-time text updates
  useEffect(() => {
    if (share && share.textContent !== textContent) {
      setTextContent(share.textContent)
    }
  }, [share])

  // Show error notifications
  useEffect(() => {
    if (error) {
      showNotification(error, "error")
      clearError()
    }
  }, [error])

  const showNotification = (message, type = "success") => {
    setNotification({ message, type })
    setTimeout(() => setNotification(null), 3000)
  }

  const addFiles = async (newFiles) => {
    if (!shareLink) {
      showNotification("Please create a share first", "error")
      return
    }

    try {
      const shareId = shareLink.split("/").pop()
      await uploadFiles(shareId, Array.from(newFiles))
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

  const handleShare = async () => {
    const validation = validateForm({ files, textContent, password, selectedMode })
    if (!validation.isValid) {
      showNotification("Please fix validation errors", "error")
      return
    }

    try {
      console.log("Creating share with data:", {
        mode: selectedMode,
        textContent: textContent.substring(0, 100) + "...",
        password: password ? "***" : null,
        expiry,
        language: detectedLanguage,
      })

      const shareData = {
        mode: selectedMode,
        textContent,
        password: selectedMode === "private" ? password : null,
        expiry,
        language: detectedLanguage,
        title: "ShareFlow Document",
      }

      const result = await createShare(shareData)
      console.log("Share created successfully:", result)

      setShareLink(result.shareUrl)

      // Join the share for real-time updates
      const shareId = result.shareId
      console.log("Joining share:", shareId)
      joinShare(shareId, "Creator")

      showNotification(
        selectedMode === "private"
          ? "Secure private link generated!"
          : `Content shared in ${selectedMode} mode - others can now collaborate!`,
      )
    } catch (error) {
      console.error("Share creation failed:", error)
      showNotification(`Failed to share content: ${error.message}`, "error")
    }
  }

  const handleTextChange = (newText) => {
    setTextContent(newText)

    if (shareLink && share) {
      const shareId = shareLink.split("/").pop()

      // Send typing indicator
      setTyping(shareId, true)

      // Clear previous timeout
      if (typingTimeout) {
        clearTimeout(typingTimeout)
      }

      // Set new timeout to stop typing indicator
      const timeout = setTimeout(() => {
        setTyping(shareId, false)
      }, 1000)
      setTypingTimeout(timeout)

      // Auto-save if enabled
      if (autoSave) {
        const saveTimeout = setTimeout(() => {
          updateText(shareId, newText, detectedLanguage)
        }, 500)

        return () => clearTimeout(saveTimeout)
      }
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
              <h1>ShareFlow</h1>
              <span>Professional IDE</span>
            </div>
          </div>

          <div className="mode-selector">
            {modes.map((mode) => {
              const IconComponent = mode.icon
              return (
                <button
                  key={mode.id}
                  className={`mode-btn ${selectedMode === mode.id ? "active" : ""}`}
                  onClick={() => setSelectedMode(mode.id)}
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
              <button className="upload-btn" onClick={() => setShowUploadMenu(!showUploadMenu)}>
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
            {activeUsers > 0 && (
              <div className="active-users">
                <Users size={14} />
                <span>{activeUsers}</span>
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
            placeholder="Start typing or paste your code here...
// ShareFlow supports real-time collaboration
// Your content will be automatically synced with other users"
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
        </div>

        <div className="footer-right">
          {shareLink && (
            <div className="share-result">
              <Link size={14} />
              <input type="text" value={shareLink} readOnly className="share-input" />
              <button onClick={() => copyToClipboard(shareLink)} className="copy-btn">
                <Copy size={14} />
              </button>
            </div>
          )}

          <button
            className="share-btn primary"
            onClick={handleShare}
            disabled={loading}
            style={{ backgroundColor: currentMode.color }}
          >
            {loading ? <Loader2 size={16} className="spinning" /> : <Share2 size={16} />}
            <span>{selectedMode === "private" ? "Generate Link" : "Start Sharing"}</span>
          </button>
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
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function App() {
  return (
    <ShareProvider>
      <ShareFlowApp />
    </ShareProvider>
  )
}

export default App
