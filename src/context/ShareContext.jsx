"use client"

import { createContext, useContext, useReducer, useEffect } from "react"
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
  SET_SOCKET: "SET_SOCKET",
  SET_CONNECTED: "SET_CONNECTED",
  SET_TYPING_USERS: "SET_TYPING_USERS",
  CLEAR_SHARE: "CLEAR_SHARE",
}

const initialState = {
  loading: false,
  error: null,
  share: null,
  files: [],
  activeUsers: 0,
  socket: null,
  connected: false,
  typingUsers: [],
}

function shareReducer(state, action) {
  switch (action.type) {
    case ACTIONS.SET_LOADING:
      return { ...state, loading: action.payload, error: null }
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
    case ACTIONS.SET_SOCKET:
      return { ...state, socket: action.payload }
    case ACTIONS.SET_CONNECTED:
      return { ...state, connected: action.payload }
    case ACTIONS.SET_TYPING_USERS:
      return { ...state, typingUsers: action.payload }
    case ACTIONS.CLEAR_SHARE:
      return { ...initialState, socket: state.socket }
    default:
      return state
  }
}

export function ShareProvider({ children }) {
  const [state, dispatch] = useReducer(shareReducer, initialState)

  useEffect(() => {
    const socket = io("http://localhost:5000")

    dispatch({ type: ACTIONS.SET_SOCKET, payload: socket })

    socket.on("connect", () => {
      dispatch({ type: ACTIONS.SET_CONNECTED, payload: true })
    })

    socket.on("disconnect", () => {
      dispatch({ type: ACTIONS.SET_CONNECTED, payload: false })
    })

    socket.on("error", (error) => {
      dispatch({ type: ACTIONS.SET_ERROR, payload: error.message })
    })

    socket.on("shareState", (data) => {
      dispatch({ type: ACTIONS.UPDATE_TEXT, payload: data })
      dispatch({ type: ACTIONS.SET_ACTIVE_USERS, payload: data.activeUsers })
    })

    socket.on("textUpdate", (data) => {
      dispatch({ type: ACTIONS.UPDATE_TEXT, payload: data })
    })

    socket.on("filesUploaded", (data) => {
      dispatch({ type: ACTIONS.ADD_FILES, payload: data.files })
    })

    socket.on("fileDeleted", (data) => {
      dispatch({ type: ACTIONS.REMOVE_FILE, payload: data.fileId })
    })

    socket.on("userJoined", (data) => {
      dispatch({ type: ACTIONS.SET_ACTIVE_USERS, payload: data.activeUsers })
    })

    socket.on("userLeft", (data) => {
      dispatch({ type: ACTIONS.SET_ACTIVE_USERS, payload: data.activeUsers })
    })

    socket.on("userTyping", (data) => {
      dispatch({
        type: ACTIONS.SET_TYPING_USERS,
        payload: data.isTyping
          ? [...state.typingUsers.filter((u) => u.socketId !== data.socketId), data]
          : state.typingUsers.filter((u) => u.socketId !== data.socketId),
      })
    })

    return () => {
      socket.disconnect()
    }
  }, [])

  const createShare = async (shareData) => {
    dispatch({ type: ACTIONS.SET_LOADING, payload: true })
    try {
      const response = await shareAPI.create(shareData)
      return response.data
    } catch (error) {
      dispatch({ type: ACTIONS.SET_ERROR, payload: error.message })
      throw error
    } finally {
      dispatch({ type: ACTIONS.SET_LOADING, payload: false })
    }
  }

  const getShare = async (shareId, password = null) => {
    dispatch({ type: ACTIONS.SET_LOADING, payload: true })
    try {
      const response = await shareAPI.get(shareId, password)
      dispatch({ type: ACTIONS.SET_SHARE, payload: response.data })
      dispatch({ type: ACTIONS.SET_FILES, payload: response.data.files || [] })
      return response.data
    } catch (error) {
      dispatch({ type: ACTIONS.SET_ERROR, payload: error.message })
      throw error
    } finally {
      dispatch({ type: ACTIONS.SET_LOADING, payload: false })
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

  const joinShare = (shareId, username = "Anonymous") => {
    if (state.socket) {
      state.socket.emit("joinShare", { shareId, username })
    }
  }

  const updateText = (shareId, textContent, language) => {
    if (state.socket) {
      state.socket.emit("textChange", { shareId, textContent, language })
    }
  }

  const setTyping = (shareId, isTyping) => {
    if (state.socket) {
      state.socket.emit("typing", { shareId, isTyping })
    }
  }

  const clearError = () => {
    dispatch({ type: ACTIONS.SET_ERROR, payload: null })
  }

  const value = {
    ...state,
    createShare,
    getShare,
    uploadFiles,
    deleteFile,
    joinShare,
    updateText,
    setTyping,
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
