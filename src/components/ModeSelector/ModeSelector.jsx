"use client"
import { Globe, Lock, Wifi } from "lucide-react"
import "./ModeSelector.css"

const ModeSelector = ({ selectedMode, onModeChange }) => {
  const modes = [
    {
      id: "global",
      label: "Global Share",
      icon: Globe,
      description: "Share publicly with anyone",
    },
    {
      id: "private",
      label: "Private Share",
      icon: Lock,
      description: "Password protected sharing",
    },
    {
      id: "offline",
      label: "Offline Share",
      icon: Wifi,
      description: "Local network sharing",
    },
  ]

  return (
    <div className="mode-selector">
      <h2 className="mode-selector-title">Choose Sharing Mode</h2>
      <div className="mode-tabs">
        {modes.map((mode) => {
          const IconComponent = mode.icon
          return (
            <button
              key={mode.id}
              className={`mode-tab ${selectedMode === mode.id ? "active" : ""}`}
              onClick={() => onModeChange(mode.id)}
            >
              <IconComponent className="mode-icon" />
              <div className="mode-content">
                <span className="mode-label">{mode.label}</span>
                <span className="mode-description">{mode.description}</span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default ModeSelector
