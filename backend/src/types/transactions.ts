export type Transaction = {
  id: string;
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  currency: string;
  txnDate: Date;
  txnType: string;
  description: string;
  referenceNumber: string;
  isSuspicious: boolean;
  flagLevel: string;
  flagReasons: string[];
};
