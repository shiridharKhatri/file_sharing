import axios from "axios"

const api = axios.create({
  baseURL: "http://localhost:5000/api",
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
})

api.interceptors.request.use(
  (config) => {
    console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`)
    if (config.data instanceof FormData) {
      delete config.headers["Content-Type"]
    }
    return config
  },
  (error) => {
    console.error("API Request Error:", error)
    return Promise.reject(error)
  },
)

api.interceptors.response.use(
  (response) => {
    console.log(`API Response: ${response.status} ${response.config.url}`)
    return response
  },
  (error) => {
    console.error("API Response Error:", error.response?.data || error.message)
    const message = error.response?.data?.message || error.message || "Network error"
    return Promise.reject({
      message,
      status: error.response?.status,
      data: error.response?.data,
    })
  },
)

export const shareAPI = {
  create: (data) => {
    console.log("Creating share with API:", data)
    return api.post("/shares", data)
  },
  get: (shareId, password = null) => {
    console.log("Getting share:", shareId, password ? "with password" : "no password")
    return api.get(`/shares/${shareId}${password ? `?password=${password}` : ""}`)
  },
  getAll: () => api.get("/shares"),
  update: (shareId, data) => api.put(`/shares/${shareId}`, data),
  delete: (shareId) => api.delete(`/shares/${shareId}`),

  uploadFiles: (shareId, files) => {
    const formData = new FormData()
    files.forEach((file) => formData.append("files", file))

    return api.post(`/files/upload/${shareId}`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 60000,
    })
  },

  downloadFile: (fileId) => api.get(`/files/download/${fileId}`, { responseType: "blob" }),
  deleteFile: (fileId) => api.delete(`/files/${fileId}`),
}

export default api
