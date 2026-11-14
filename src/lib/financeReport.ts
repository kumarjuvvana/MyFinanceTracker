import type {
  BankAccount,
  SubscriptionAccount,
  SubscriptionTransactionType,
  SubscriptionBillingType,
  SubscriptionCategory,
  Currency,
} from "../types";
import type { ReportDefinition } from "./reportAnalytics";

export interface BankActivityRecord {
  accountId: string;
  accountName: string;
  transactionDate: string;
  direction: "debit" | "credit";
  amount: number;
}

export interface SubscriptionActivityRecord {
  id: string;
  accountId: string;
  accountName: string;
  provider: string;
  category: SubscriptionCategory;
  billingType: SubscriptionBillingType;
  currency: Currency;
  type: SubscriptionTransactionType;
  transactionDate: string;
  paymentDate: string;
  dueDate: string;
  amount: number | null;
  paid: boolean;
}

export function bankActivityRecords(accounts: readonly BankAccount[]): BankActivityRecord[] {
  return accounts.flatMap((account) => (account.importedTransactions ?? []).map((transaction) => ({
    accountId: account.id,
    accountName: account.bankName,
    transactionDate: transaction.transactionDate,
    direction: transaction.direction,
    amount: transaction.amount,
  })));
}

export function subscriptionActivityRecords(accounts: readonly SubscriptionAccount[]): SubscriptionActivityRecord[] {
  return accounts.flatMap((account) => account.transactions.map((transaction) => ({
    id: transaction.id,
    accountId: account.id,
    accountName: account.name,
    provider: account.provider,
    category: account.category,
    billingType: account.billingType,
    currency: account.currency,
    type: transaction.type,
    transactionDate: transaction.transactionDate,
    paymentDate: transaction.paymentDate,
    dueDate: transaction.dueDate,
    amount: transaction.amount,
    paid: transaction.paid,
  })));
}

export const bankActivityReport: ReportDefinition<BankActivityRecord> = {
  id: "bank-activity",
  dateOf: (record) => record.transactionDate,
  dimensions: [
    { id: "account", label: "Account", getValue: (record) => record.accountId },
    { id: "direction", label: "Direction", getValue: (record) => record.direction },
  ],
  measures: [
    { id: "amount", label: "Amount", getValue: (record) => record.amount },
  ],
};

export const subscriptionPaymentReport: ReportDefinition<SubscriptionActivityRecord> = {
  id: "subscription-payments",
  dateOf: (record) => record.paymentDate || record.transactionDate,
  dimensions: [
    { id: "account", label: "Account", getValue: (record) => record.accountId },
    { id: "category", label: "Category", getValue: (record) => record.category },
    { id: "currency", label: "Currency", getValue: (record) => record.currency },
    { id: "billingType", label: "Billing type", getValue: (record) => record.billingType },
  ],
  measures: [
    { id: "amount", label: "Paid amount", getValue: (record) => record.amount },
  ],
};

export const subscriptionDueReport: ReportDefinition<SubscriptionActivityRecord> = {
  id: "subscription-due",
  dateOf: (record) => record.dueDate || undefined,
  dimensions: [
    { id: "account", label: "Account", getValue: (record) => record.accountId },
    { id: "category", label: "Category", getValue: (record) => record.category },
    { id: "currency", label: "Currency", getValue: (record) => record.currency },
  ],
  measures: [
    { id: "amount", label: "Amount due", getValue: (record) => record.amount },
  ],
};
