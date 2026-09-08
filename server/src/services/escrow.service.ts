/**
 * Demo Escrow (spec section 29).
 *
 * IPaymentProvider is the interface a real gateway (Razorpay/Stripe/UPI)
 * would implement later; DemoEscrowProvider is the only implementation
 * today. It never touches real money — everything is a state transition in
 * the `payments` table — and every response is labelled DEMO PAYMENT
 * ENVIRONMENT so the UI can never accidentally claim a real transfer.
 */
import { PoolClient } from "pg";
import { PayoutLine } from "./algorithms/aggregation.algorithm";
import { paymentRepository } from "../repositories/payment.repository";

export interface IPaymentProvider {
  readonly name: string;
  readonly isDemo: boolean;
  hold(client: PoolClient, orderId: string, amount: number): Promise<{ paymentId: string }>;
  release(client: PoolClient, paymentId: string, allocations: PayoutLine[]): Promise<void>;
}

class DemoEscrowProvider implements IPaymentProvider {
  readonly name = "demo_escrow";
  readonly isDemo = true;

  async hold(client: PoolClient, orderId: string, amount: number) {
    const payment = await paymentRepository.createHeld(client, orderId, amount);
    return { paymentId: payment.id };
  }

  async release(client: PoolClient, paymentId: string, allocations: PayoutLine[]) {
    await paymentRepository.release(client, paymentId, allocations);
  }
}

export const escrowProvider: IPaymentProvider = new DemoEscrowProvider();

export const DEMO_PAYMENT_DISCLAIMER =
  "DEMO PAYMENT ENVIRONMENT — no real money moves. This simulates escrow hold and release for demonstration purposes only.";
