export interface Lead {
  name: string;
  email_phone: string;
  requirement: string;
  timestamp: string;
}

export interface Message {
  role: "user" | "model";
  parts: { text: string }[];
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: "create" | "update" | "delete" | "list" | "get" | "write";
  path: string | null;
  authInfo: {
    userId: string | null | undefined;
    email: string | null | undefined;
    emailVerified: boolean | null | undefined;
  };
}
