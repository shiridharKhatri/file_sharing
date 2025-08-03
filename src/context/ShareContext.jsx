"use client"

import { createContext, useContext, useReducer, useEffect, useRef } from "react"
import { io } from "socket.io-client"
import { shareAPI } from "../services/api"

const ShareContext = createContext()

const ACTIONS = {
  SET_LOADING: "SET_LOADING",
  SET_ERROR: "SET_ERROR",
  SET_SHARE: "SET_SHARE",
  UPDATE_TEXT: "UPDATE_TEXT",
  SET_FILES: "SET_FILES",
  ADD_FILES: "ADD_FILES",
  REMOVE_FILE: "REMOVE_FILE",
  SET_ACTIVE_USERS: "SET_ACTIVE_USERS",
  SET_CONNECTED: "SET_CONNECTED",
  SET_TYPING_USERS: "SET_TYPING_USERS",
  CLEAR_ERROR: "CLEAR_ERROR",
}

const initialState = {
  loading: false,
  error: null,
  share: null,
  files: [],
  activeUsers: 0,
  connected: false,
  typingUsers: [],
}

function shareReducer(state, action) {
  switch (action.type) {
    case ACTIONS.SET_LOADING:
      return { ...state, loading: action.payload }
    case ACTIONS.SET_ERROR:
      return { ...state, error: action.payload, loading: false }
    case ACTIONS.SET_SHARE:
      return { ...state, share: action.payload, loading: false, error: null }
    case ACTIONS.UPDATE_TEXT:
      return {
        ...state,
        share: state.share
          ? {
              ...state.share,
              textContent: action.payload.textContent,
              language: action.payload.language || state.share.language,
            }
          : null,
      }
    case ACTIONS.SET_FILES:
      return { ...state, files: action.payload }
    case ACTIONS.ADD_FILES:
      return { ...state, files: [...state.files, ...action.payload] }
    case ACTIONS.REMOVE_FILE:
      return { ...state, files: state.files.filter((f) => f.id !== action.payload) }
    case ACTIONS.SET_ACTIVE_USERS:
      return { ...state, activeUsers: action.payload }
    case ACTIONS.SET_CONNECTED:
      return { ...state, connected: action.payload }
    case ACTIONS.SET_TYPING_USERS:
      return { ...state, typingUsers: action.payload }
    case ACTIONS.CLEAR_ERROR:
      return { ...state, error: null }
    default:
      return state
  }
}

export function ShareProvider({ children }) {
  const [state, dispatch] = useReducer(shareReducer, initialState)
  const socketRef = useRef(null)
  const currentShareIdRef = useRef(null)

  useEffect(() => {
    // Initialize socket connection
    const socket = io("http://localhost:5000", {
      transports: ["websocket", "polling"],
    })

    socketRef.current = socket

    socket.on("connect", () => {
      console.log("Socket connected:", socket.id)
      dispatch({ type: ACTIONS.SET_CONNECTED, payload: true })
    })

    socket.on("disconnect", () => {
      console.log("Socket disconnected")
      dispatch({ type: ACTIONS.SET_CONNECTED, payload: false })
    })

    socket.on("error", (error) => {
      console.error("Socket error:", error)
      dispatch({ type: ACTIONS.SET_ERROR, payload: error.message || "Connection error" })
    })

    // Handle share state updates
    socket.on("shareState", (data) => {
      console.log("Received share state:", data)
      dispatch({
        type: ACTIONS.SET_SHARE,
        payload: {
          textContent: data.textContent || "",
          language: data.language || "plaintext",
          title: data.title || "Shared Document",
          activeUsers: data.activeUsers || 1,
        },
      })
      dispatch({ type: ACTIONS.SET_ACTIVE_USERS, payload: data.activeUsers || 1 })
    })

    // Handle real-time text updates
    socket.on("textUpdate", (data) => {
      console.log("Received text update from:", data.updatedBy)
      dispatch({ type: ACTIONS.UPDATE_TEXT, payload: data })
    })

    // Handle user events
    socket.on("userJoined", (data) => {
      console.log("User joined:", data.username)
      dispatch({ type: ACTIONS.SET_ACTIVE_USERS, payload: data.activeUsers || 1 })
    })

    socket.on("userLeft", (data) => {
      console.log("User left:", data.username)
      dispatch({ type: ACTIONS.SET_ACTIVE_USERS, payload: data.activeUsers || 0 })
    })

    // Handle typing indicators
    socket.on("userTyping", (data) => {
      dispatch((prevState) => {
        const currentTypingUsers = prevState.typingUsers || []
        if (data.isTyping) {
          // Add user to typing list if not already there
          const existingUser = currentTypingUsers.find((u) => u.socketId === data.socketId)
          if (!existingUser) {
            return {
              type: ACTIONS.SET_TYPING_USERS,
              payload: [...currentTypingUsers, { socketId: data.socketId, username: data.username }],
            }
          }
        } else {
          // Remove user from typing list
          return {
            type: ACTIONS.SET_TYPING_USERS,
            payload: currentTypingUsers.filter((u) => u.socketId !== data.socketId),
          }
        }
        return { type: ACTIONS.SET_TYPING_USERS, payload: currentTypingUsers }
      })
    })

    // Handle file events
    socket.on("filesUploaded", (data) => {
      dispatch({ type: ACTIONS.ADD_FILES, payload: data.files })
    })

    socket.on("fileDeleted", (data) => {
      dispatch({ type: ACTIONS.REMOVE_FILE, payload: data.fileId })
    })

    return () => {
      socket.disconnect()
    }
  }, [])

  const createShare = async (shareData) => {
    dispatch({ type: ACTIONS.SET_LOADING, payload: true })
    try {
      console.log("Creating share:", shareData)
      const response = await shareAPI.create(shareData)
      console.log("Share created:", response.data)

      // Store the share data
      dispatch({
        type: ACTIONS.SET_SHARE,
        payload: {
          shareId: response.data.shareId,
          textContent: shareData.textContent,
          language: shareData.language,
          mode: shareData.mode,
          title: shareData.title,
        },
      })

      return response.data
    } catch (error) {
      console.error("Create share error:", error)
      dispatch({ type: ACTIONS.SET_ERROR, payload: error.message })
      throw error
    } finally {
      dispatch({ type: ACTIONS.SET_LOADING, payload: false })
    }
  }

  const joinShare = (shareId, username = "Anonymous") => {
    if (socketRef.current && socketRef.current.connected) {
      console.log("Joining share:", shareId, "as", username)
      currentShareIdRef.current = shareId
      socketRef.current.emit("joinShare", { shareId, username })
    } else {
      console.error("Socket not connected")
      dispatch({ type: ACTIONS.SET_ERROR, payload: "Not connected to server" })
    }
  }

  const updateText = (shareId, textContent, language) => {
    if (socketRef.current && socketRef.current.connected && currentShareIdRef.current === shareId) {
      console.log("Sending text update:", { shareId, textContent: textContent.substring(0, 50) + "...", language })
      socketRef.current.emit("textChange", { shareId, textContent, language })
    }
  }

  const setTyping = (shareId, isTyping) => {
    if (socketRef.current && socketRef.current.connected && currentShareIdRef.current === shareId) {
      socketRef.current.emit("typing", { shareId, isTyping })
    }
  }

  const uploadFiles = async (shareId, files) => {
    dispatch({ type: ACTIONS.SET_LOADING, payload: true })
    try {
      const response = await shareAPI.uploadFiles(shareId, files)
      dispatch({ type: ACTIONS.ADD_FILES, payload: response.data.files })
      return response.data
    } catch (error) {
      dispatch({ type: ACTIONS.SET_ERROR, payload: error.message })
      throw error
    } finally {
      dispatch({ type: ACTIONS.SET_LOADING, payload: false })
    }
  }

  const deleteFile = async (fileId) => {
    try {
      await shareAPI.deleteFile(fileId)
      dispatch({ type: ACTIONS.REMOVE_FILE, payload: fileId })
    } catch (error) {
      dispatch({ type: ACTIONS.SET_ERROR, payload: error.message })
      throw error
    }
  }

  const clearError = () => {
    dispatch({ type: ACTIONS.CLEAR_ERROR })
  }

  const value = {
    ...state,
    createShare,
    joinShare,
    updateText,
    setTyping,
    uploadFiles,
    deleteFile,
    clearError,
  }

  return <ShareContext.Provider value={value}>{children}</ShareContext.Provider>
}

export function useShare() {
  const context = useContext(ShareContext)
  if (!context) {
    throw new Error("useShare must be used within a ShareProvider")
  }
  return context
}
