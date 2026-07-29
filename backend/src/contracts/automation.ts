import { z } from 'zod';
import {
  ActionIdSchema,
  EventIdSchema,
  IsoDateTimeSchema,
  MoneyPaiseSchema,
  ProbabilitySchema,
  ProposalIdSchema,
  RiskClassSchema,
  UserIdSchema,
} from './primitives.js';

export const ApprovalModeSchema = z.enum([
  'automatic',
  'outlet_manager',
  'finance_approver',
  'two_person',
  'prohibited',
]);

export const DecisionProposalSchema = z
  .object({
    proposalId: ProposalIdSchema,
    objective: z.string().trim().min(3).max(120),
    triggerEventIds: z.array(EventIdSchema).min(1).max(100),
    recommendedAction: z.object({
      tool: z.string().regex(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/),
      arguments: z.record(z.string(), z.unknown()),
    }),
    evidence: z
      .array(
        z.object({
          metric: z.string().trim().min(1).max(120),
          value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
          source: z.string().trim().min(1).max(120),
        }),
      )
      .min(1)
      .max(50),
    confidence: ProbabilitySchema,
    expectedImpact: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
    riskClass: RiskClassSchema,
    approval: ApprovalModeSchema,
    expiresAt: IsoDateTimeSchema,
    rollbackPlan: z.string().trim().min(3).max(500).nullable(),
    policyVersion: z.string().trim().min(1).max(80),
    modelId: z.string().trim().min(1).max(120).nullable(),
    promptVersion: z.string().trim().min(1).max(80).nullable(),
  })
  .superRefine((proposal, context) => {
    if (
      ['A2', 'A3', 'A4'].includes(proposal.riskClass) &&
      proposal.approval === 'automatic'
    ) {
      context.addIssue({
        code: 'custom',
        path: ['approval'],
        message: `${proposal.riskClass} actions cannot execute automatically`,
      });
    }

    if (
      proposal.riskClass === 'A4' &&
      !['two_person', 'prohibited'].includes(proposal.approval)
    ) {
      context.addIssue({
        code: 'custom',
        path: ['approval'],
        message: 'A4 actions require two-person control or must be prohibited',
      });
    }

    if (proposal.approval !== 'prohibited' && proposal.rollbackPlan === null) {
      context.addIssue({
        code: 'custom',
        path: ['rollbackPlan'],
        message: 'Executable proposals must define a rollback or recovery plan',
      });
    }
  });

export const ActionReceiptSchema = z
  .object({
    actionId: ActionIdSchema,
    proposalId: ProposalIdSchema,
    actor: z.discriminatedUnion('type', [
      z.object({ type: z.literal('system'), id: z.literal('maos') }),
      z.object({ type: z.literal('staff'), id: UserIdSchema }),
    ]),
    tool: z.string().regex(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/),
    beforeStateHash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
    externalReference: z.string().trim().min(1).max(160).nullable(),
    status: z.enum(['requested', 'executed', 'verified', 'failed', 'rolled_back']),
    verification: z.record(z.string(), z.unknown()).nullable(),
    afterStateHash: z.string().regex(/^sha256:[a-f0-9]{64}$/).nullable(),
    rollbackUntil: IsoDateTimeSchema.nullable(),
    durationMs: z.number().int().nonnegative(),
    estimatedAiCostPaise: MoneyPaiseSchema,
    recordedAt: IsoDateTimeSchema,
  })
  .superRefine((receipt, context) => {
    if (
      receipt.status === 'verified' &&
      (receipt.verification === null || receipt.afterStateHash === null)
    ) {
      context.addIssue({
        code: 'custom',
        path: ['verification'],
        message: 'Verified actions require verification evidence and an after-state hash',
      });
    }
  });

export type DecisionProposal = z.infer<typeof DecisionProposalSchema>;
export type ActionReceipt = z.infer<typeof ActionReceiptSchema>;

export const parseDecisionProposal = (input: unknown): DecisionProposal =>
  DecisionProposalSchema.parse(input);

export const parseActionReceipt = (input: unknown): ActionReceipt =>
  ActionReceiptSchema.parse(input);
