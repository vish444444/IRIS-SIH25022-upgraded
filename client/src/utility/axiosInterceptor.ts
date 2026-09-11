import axios from 'axios'
import { getLocalStorage } from './helper'

const getBaseURL = () => {
  const envUrl = import.meta.env.VITE_SERVER_URL;
  if (envUrl && envUrl !== "undefined" && envUrl !== "serverurl" && envUrl.startsWith("http")) {
    return `${envUrl}/api`;
  }
  return "http://localhost:3000/api";
};

const baseURL = getBaseURL();

const axiosInstance = axios.create({
  baseURL: baseURL,
  timeout: 5000,
})

axiosInstance.interceptors.request.use(
  (config) => {
    const token = getLocalStorage('jwt')

    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }

    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

axiosInstance.interceptors.response.use(
  (response) => {
    return response
  },
  (error) => {
    return Promise.reject(error)
  }
)

export default axiosInstance
