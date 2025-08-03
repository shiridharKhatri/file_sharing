"use client"

import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { shareAPI } from "../services/api"
import { useShare } from "../context/ShareContext"
import { Lock, Eye, Users, Clock, AlertCircle, Loader2, ArrowLeft, Edit3, EyeIcon } from "lucide-react"

export default function ShareViewer() {
  const { shareId } = useParams()
  const navigate = useNavigate()
  const { joinShare, share, connected, activeUsers, typingUsers, updateText, setTyping } = useShare()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [requiresPassword, setRequiresPassword] = useState(false)
  const [password, setPassword] = useState("")
  const [shareData, setShareData] = useState(null)
  const [isEditing, setIsEditing] = useState(false)
  const [localText, setLocalText] = useState("")
  const [hasJoined, setHasJoined] = useState(false)

  useEffect(() => {
    if (shareId) {
      loadShare(shareId)
    }
  }, [shareId])

  useEffect(() => {
    // Update local text when share content changes (from other users)
    if (share && share.textContent !== undefined && hasJoined) {
      if (share.textContent !== localText && !window.textUpdateTimeout) {
        console.log("Viewer received text update from other user")
        setLocalText(share.textContent)
      }
    }
  }, [share, hasJoined])

  useEffect(() => {
    // Auto-join the share when connected and share data is loaded
    if (connected && shareData && !hasJoined && !requiresPassword) {
      console.log("Auto-joining share for real-time updates")
      joinShare(shareId, "Viewer")
      setHasJoined(true)
    }
  }, [connected, shareData, shareId, hasJoined, requiresPassword])

  const loadShare = async (id, pwd = null) => {
    try {
      setLoading(true)
      setError(null)

      console.log("Loading share:", id, pwd ? "with password" : "without password")
      const response = await shareAPI.get(id, pwd)
      console.log("Share loaded successfully:", response.data)

      setShareData(response.data)
      setLocalText(response.data.textContent || "")
      setRequiresPassword(false)
    } catch (error) {
      console.error("Error loading share:", error)
      if (error.status === 401 && error.data?.requiresPassword) {
        setRequiresPassword(true)
        setLoading(false)
      } else {
        setError(error.message)
        setLoading(false)
      }
    } finally {
      if (!requiresPassword) {
        setLoading(false)
      }
    }
  }

  const handlePasswordSubmit = (e) => {
    e.preventDefault()
    if (password.trim()) {
      console.log("Submitting password for share access")
      loadShare(shareId, password)
    }
  }

  const handleTextChange = (newText) => {
    setLocalText(newText)

    if (shareData && shareData.settings?.allowEdit && connected && hasJoined) {
      // Send typing indicator
      setTyping(shareId, true)

      // Clear existing timeout
      if (window.textUpdateTimeout) {
        clearTimeout(window.textUpdateTimeout)
      }

      // Debounce the actual update
      window.textUpdateTimeout = setTimeout(() => {
        console.log("Sending text update from viewer")
        updateText(shareId, newText, shareData.language)
        setTyping(shareId, false)
        window.textUpdateTimeout = null
      }, 1000)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Loading shared content...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Share Not Found</h1>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => navigate("/")}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2 mx-auto"
          >
            <ArrowLeft size={16} />
            Go Home
          </button>
        </div>
      </div>
    )
  }

  if (requiresPassword) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full mx-4">
          <div className="text-center mb-6">
            <Lock className="w-12 h-12 text-blue-600 mx-auto mb-4" />
            <h1 className="text-xl font-semibold text-gray-900">Protected Share</h1>
            <p className="text-gray-600 mt-2">This share is password protected</p>
          </div>

          <form onSubmit={handlePasswordSubmit}>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter password..."
                required
                autoFocus
              />
            </div>

            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Access Share"}
            </button>
          </form>

          <button onClick={() => navigate("/")} className="w-full mt-3 text-gray-600 hover:text-gray-800 text-sm">
            ← Back to Home
          </button>
        </div>
      </div>
    )
  }

  const canEdit =
    shareData?.settings?.allowEdit &&
    (shareData?.mode === "global" || shareData?.mode === "collaborative" || shareData?.mode === "private")

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <button
                onClick={() => navigate("/")}
                className="mr-4 p-2 text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100"
              >
                <ArrowLeft size={20} />
              </button>
              <h1 className="text-lg font-semibold text-gray-900">{shareData?.title || "Shared Document"}</h1>
              <span
                className={`ml-3 px-2 py-1 text-xs rounded-full ${
                  shareData?.mode === "global"
                    ? "bg-blue-100 text-blue-800"
                    : shareData?.mode === "collaborative"
                      ? "bg-green-100 text-green-800"
                      : "bg-purple-100 text-purple-800"
                }`}
              >
                {shareData?.mode}
              </span>
              {canEdit && (
                <span className="ml-2 px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">Editable</span>
              )}
            </div>

            <div className="flex items-center space-x-4">
              {activeUsers > 0 && hasJoined && (
                <div className="flex items-center text-sm text-gray-600">
                  <Users className="w-4 h-4 mr-1" />
                  <span>{activeUsers} active</span>
                </div>
              )}

              <div className="flex items-center text-sm text-gray-600">
                <Eye className="w-4 h-4 mr-1" />
                <span>{shareData?.stats?.views || 0} views</span>
              </div>

              <div className="flex items-center text-sm text-gray-600">
                <Clock className="w-4 h-4 mr-1" />
                <span>Expires {new Date(shareData?.expiresAt).toLocaleDateString()}</span>
              </div>

              {!connected && (
                <div className="flex items-center text-sm text-orange-600">
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  <span>Connecting...</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow">
          {/* Editor Header */}
          <div className="border-b border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <span className="text-sm font-medium text-gray-700">
                  Language: {shareData?.language || "plaintext"}
                </span>
                <span className="text-sm text-gray-500">{localText.length} characters</span>
                <span className="text-sm text-gray-500">{localText.split("\n").length} lines</span>
              </div>

              <div className="flex items-center space-x-4">
                {typingUsers.length > 0 && (
                  <div className="flex items-center text-sm text-blue-600">
                    <div className="animate-pulse w-2 h-2 bg-blue-600 rounded-full mr-2"></div>
                    {typingUsers.map((user) => user.username).join(", ")} typing...
                  </div>
                )}

                {canEdit && (
                  <button
                    onClick={() => setIsEditing(!isEditing)}
                    className={`px-3 py-1 text-sm rounded-lg flex items-center gap-2 ${
                      isEditing ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {isEditing ? <EyeIcon size={14} /> : <Edit3 size={14} />}
                    {isEditing ? "View Mode" : "Edit Mode"}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Content Display/Editor */}
          <div className="p-6">
            {canEdit && isEditing ? (
              <textarea
                value={localText}
                onChange={(e) => handleTextChange(e.target.value)}
                className="w-full h-96 font-mono text-sm text-gray-900 bg-gray-50 p-4 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                placeholder="Start editing the shared content..."
                spellCheck={false}
              />
            ) : (
              <pre className="whitespace-pre-wrap font-mono text-sm text-gray-900 bg-gray-50 p-4 rounded-lg overflow-auto max-h-96 min-h-96">
                {localText || "No content available"}
              </pre>
            )}
          </div>

          {/* Files */}
          {shareData?.files && shareData.files.length > 0 && (
            <div className="border-t border-gray-200 px-6 py-4">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Attached Files</h3>
              <div className="space-y-2">
                {shareData.files.map((file) => (
                  <div key={file._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                        <span className="text-xs font-medium text-blue-600">
                          {file.originalName.split(".").pop()?.toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{file.originalName}</p>
                        <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
                      </div>
                    </div>
                    <a
                      href={`http://localhost:5000/api/files/download/${file._id}`}
                      className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                      download
                    >
                      Download
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
