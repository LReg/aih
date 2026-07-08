import {productionEnvironment} from "./productionEnvironment";

export interface Environment {
  baseUrl: string;
  apiUrl: string;
  authUrl: string;
  clientId: string;
}
export const environment: Environment = productionEnvironment ?? {
  baseUrl: "http://localhost:4200",
  apiUrl: "http://127.0.0.1:8080",
  authUrl: "https://stratauth.lreg0.de",
  clientId: "mhTPFZTGW4SrreKtMdWSr4DGpa5rRUZewcfqnFbVrX757MYeX0tuNJ39zV4CM",
};
