import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { SyntheticDatasetGenerator, BenchmarkEngine } from '@recoveryos/simulator';

export const benchmarkRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.post('/benchmark/run', async (request, reply) => {
    const body = request.body as {
      count?: number;
      seed?: number;
    };

    const count = Math.min(Math.max(body?.count || 10000, 100), 50000);
    const seed = body?.seed || 1337;

    const dataset = SyntheticDatasetGenerator.generate(count, seed);
    const benchmarkReport = BenchmarkEngine.runBenchmark(dataset, seed);

    return reply.send({
      success: true,
      report: benchmarkReport
    });
  });

  fastify.get('/benchmark/report', async (_request, reply) => {
    // Generate pre-computed standard 10,000 record report
    const dataset = SyntheticDatasetGenerator.generate(10000, 1337);
    const benchmarkReport = BenchmarkEngine.runBenchmark(dataset, 1337);

    return reply.send({
      success: true,
      standard_evaluation: benchmarkReport
    });
  });
};
