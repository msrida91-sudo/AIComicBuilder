import { LOCAL_USER_ID } from "./local-user";

export function getUserIdFromRequest(_request: Request): string {
  return LOCAL_USER_ID;
}
