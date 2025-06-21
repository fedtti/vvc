export interface Config {
  server: string;
  accountId: string;
  userId: string;
  secret: string;
  info: any; // TODO: Define a more specific type for the server info.
}
