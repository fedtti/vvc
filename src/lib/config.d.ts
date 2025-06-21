export interface Config {
  server: string;
  account: string;
  username: string;
  password: string;
  info: any; // TODO: Define a more specific type for the server info.
}
