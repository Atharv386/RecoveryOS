import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { RecoveryTwinSimulator, SyntheticPaymentRecord } from '@recoveryos/simulator';
import { MerchantPolicyConfig, MerchantPolicyConfigSchema } from '@recoveryos/policy-engine';

export const simulatorRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.post('/simulator/run', async (request, reply) => {
    const body = request.body as {
      policy: MerchantPolicyConfig;
      customRecords?: SyntheticPaymentRecord[];
    };

    const validatedPolicy = MerchantPolicyConfigSchema.parse(body.policy);

    const records: SyntheticPaymentRecord[] = body.customRecords || [
      {
        id: 'sim_1',
        amountInPaise: 199900,
        failureClass: 'INSUFFICIENT_FUNDS',
        errorCode: 'BAD_REQUEST_PAYMENT_ACCOUNT_INSUFFICIENT_BALANCE',
        customerHistory: { totalPayments: 10, successfulPayments: 9 },
        consent: { sms: true, whatsapp: true, marketing: true },
        groundTruth: { retrySuccessProbability: 0.45, paymentLinkSuccessProbability: 0.65 }
      },
      {
        id: 'sim_2',
        amountInPaise: 499900,
        failureClass: 'AUTHENTICATION_FAILED',
        errorCode: 'BAD_REQUEST_PAYMENT_OTP_INCORRECT',
        customerHistory: { totalPayments: 3, successfulPayments: 2 },
        consent: { sms: true, whatsapp: false, marketing: true },
        groundTruth: { retrySuccessProbability: 0.10, paymentLinkSuccessProbability: 0.75 }
      }
    ];

    const result = RecoveryTwinSimulator.simulate(records, validatedPolicy);

    return reply.send({
      is_simulation: true,
      simulation_results: result
    });
  });

  fastify.post('/simulator/compare', async (request, reply) => {
    const body = request.body as {
      baselinePolicy: MerchantPolicyConfig;
      proposedPolicy: MerchantPolicyConfig;
      customRecords?: SyntheticPaymentRecord[];
    };

    const baseline = MerchantPolicyConfigSchema.parse(body.baselinePolicy);
    const proposed = MerchantPolicyConfigSchema.parse(body.proposedPolicy);

    const records: SyntheticPaymentRecord[] = body.customRecords || [
      {
        id: 'sim_1',
        amountInPaise: 199900,
        failureClass: 'INSUFFICIENT_FUNDS',
        errorCode: 'BAD_REQUEST_PAYMENT_ACCOUNT_INSUFFICIENT_BALANCE',
        customerHistory: { totalPayments: 10, successfulPayments: 9 },
        consent: { sms: true, whatsapp: true, marketing: true },
        groundTruth: { retrySuccessProbability: 0.45, paymentLinkSuccessProbability: 0.65 }
      },
      {
        id: 'sim_2',
        amountInPaise: 499900,
        failureClass: 'AUTHENTICATION_FAILED',
        errorCode: 'BAD_REQUEST_PAYMENT_OTP_INCORRECT',
        customerHistory: { totalPayments: 3, successfulPayments: 2 },
        consent: { sms: true, whatsapp: false, marketing: true },
        groundTruth: { retrySuccessProbability: 0.10, paymentLinkSuccessProbability: 0.75 }
      }
    ];

    const comparison = RecoveryTwinSimulator.compare(records, baseline, proposed);

    return reply.send({
      is_simulation: true,
      comparison
    });
  });
};
