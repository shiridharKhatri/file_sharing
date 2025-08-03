"use client"
import { Share2, Lock, Clock } from "lucide-react"
import "./ShareControls.css"

const ShareControls = ({ selectedMode, password, onPasswordChange, expiry, onExpiryChange, onShare }) => {
  const expiryOptions = [
    { value: "10min", label: "10 minutes" },
    { value: "1hr", label: "1 hour" },
    { value: "24hr", label: "24 hours" },
  ]

  const getShareButtonText = () => {
    switch (selectedMode) {
      case "global":
        return "Share Globally"
      case "private":
        return "Create Private Link"
      case "offline":
        return "Share on Network"
      default:
        return "Share"
    }
  }

  return (
    <div className="share-controls">
      <div className="controls-grid">
        {selectedMode === "private" && (
          <div className="control-group">
            <label className="control-label">
              <Lock className="control-icon" />
              Password Protection
            </label>
            <input
              type="password"
              className="control-input"
              placeholder="Enter password..."
              value={password}
              onChange={(e) => onPasswordChange(e.target.value)}
            />
          </div>
        )}

        <div className="control-group">
          <label className="control-label">
            <Clock className="control-icon" />
            Expiry Time
          </label>
          <select className="control-select" value={expiry} onChange={(e) => onExpiryChange(e.target.value)}>
            {expiryOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <button className="share-button" onClick={onShare}>
        <Share2 className="share-icon" />
        {getShareButtonText()}
      </button>
    </div>
  )
}

export default ShareControls
