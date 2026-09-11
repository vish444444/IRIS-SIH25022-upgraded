import { Request } from "express";
import { User } from "../../db/repositories/userRepository";

export interface IBaseRequest extends Request {
  user: Partial<User>;
  baseUrl: string;
  query: { [index: string]: string };
}

export interface IError extends Error {
  statusCode: any;
  status: any;
  message: any;
  stack?: any;
  isOperational: boolean;
  name: string;
}
