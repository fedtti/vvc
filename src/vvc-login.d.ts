export type Client = {
  id: string;
  secret: string;
  description: string;
  redirect_uri: string;
  scope: string[];
  user_id: string;
  acct_id: string;
}
