import axios, { AxiosInstance } from "axios";

/**
 * Thin HTTP client for the Python FastAPI AI Decision-Support Service
 * (ai-service/). This is the ONLY place in the Node backend that talks
 * to the AI service, so the service boundary stays clean per the
 * layered architecture (Node backend <-> AI service via REST).
 */
export class AIServiceClient {
  private static instance: AIServiceClient;
  private client: AxiosInstance;

  private constructor() {
    const baseURL = process.env.AI_SERVICE_URL || "http://localhost:8001";
    this.client = axios.create({ baseURL, timeout: 10000 });
  }

  static getInstance(): AIServiceClient {
    if (!AIServiceClient.instance) {
      AIServiceClient.instance = new AIServiceClient();
    }
    return AIServiceClient.instance;
  }

  async status() {
    const res = await this.client.get("/ai/status");
    return res.data;
  }

  async predictDelay(payload: any) {
    const res = await this.client.post("/ai/predict-delay", payload);
    return res.data;
  }

  async detectConflicts(payload: any) {
    const res = await this.client.post("/ai/detect-conflicts", payload);
    return res.data;
  }

  async optimize(payload: any) {
    const res = await this.client.post("/ai/optimize", payload);
    return res.data;
  }

  async validate(payload: any) {
    const res = await this.client.post("/ai/validate", payload);
    return res.data;
  }

  async recommend(payload: any) {
    const res = await this.client.post("/ai/recommend", payload);
    return res.data;
  }

  async override(payload: any) {
    const res = await this.client.post("/ai/override", payload);
    return res.data;
  }

  async whatIf(payload: any) {
    const res = await this.client.post("/ai/what-if", payload);
    return res.data;
  }

  async getRecommendationsHistory(limit = 50) {
    const res = await this.client.get(`/ai/recommendations?limit=${limit}`);
    return res.data;
  }

  async getOptimizationRunsHistory(limit = 50) {
    const res = await this.client.get(`/ai/optimization-runs?limit=${limit}`);
    return res.data;
  }
}

export default AIServiceClient;
