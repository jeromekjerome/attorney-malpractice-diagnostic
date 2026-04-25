function splitFallbacks(csv = '') {
  return csv
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean);
}

export function buildModelList(primary, fallbackCsv = '') {
  const ordered = [primary, ...splitFallbacks(fallbackCsv)].filter(Boolean);
  return [...new Set(ordered)];
}

function buildHealthShape(models, active) {
  return {
    active,
    fallbacks_available: models.filter((m) => m !== active),
  };
}

function isMissingOrDeprecatedModelError(error) {
  const status = error?.status;
  const code = error?.code || error?.error?.code || '';
  const message = String(error?.message || '').toLowerCase();

  if (status === 404 || status === 410) return true;
  if (String(code).toLowerCase().includes('model')) return true;

  return (
    message.includes('model') &&
    (message.includes('not found') ||
      message.includes('does not exist') ||
      message.includes('deprecated') ||
      message.includes('deprecat'))
  );
}

function isTransientError(error) {
  const status = error?.status;
  if (status === 408 || status === 429) return true;
  if (typeof status === 'number' && status >= 500) return true;
  return false;
}

function shouldTryFallback(error, hasMoreModels) {
  if (!hasMoreModels) return false;
  return isMissingOrDeprecatedModelError(error) || isTransientError(error);
}

export async function chatCompletionsWithFallback(openai, { models, ...request }) {
  let lastError;

  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    try {
      return await openai.chat.completions.create({
        model,
        ...request,
      });
    } catch (error) {
      lastError = error;
      const hasMoreModels = i < models.length - 1;
      if (!shouldTryFallback(error, hasMoreModels)) throw error;
      console.warn(`[AI] chat.completions failed on "${model}": ${error.message}. Trying fallback...`);
    }
  }

  throw lastError;
}

export async function embeddingsWithFallback(openai, { models, ...request }) {
  let lastError;

  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    try {
      return await openai.embeddings.create({
        model,
        ...request,
      });
    } catch (error) {
      lastError = error;
      const hasMoreModels = i < models.length - 1;
      if (!shouldTryFallback(error, hasMoreModels)) throw error;
      console.warn(`[AI] embeddings failed on "${model}": ${error.message}. Trying fallback...`);
    }
  }

  throw lastError;
}

export async function probeChatModelChain(openai, models) {
  let lastError;

  for (const model of models) {
    try {
      await openai.chat.completions.create({
        model,
        messages: [{ role: 'user', content: 'health check' }],
        max_tokens: 1,
        temperature: 0,
      });
      return buildHealthShape(models, model);
    } catch (error) {
      lastError = error;
      console.warn(`[Health] chat model probe failed on "${model}": ${error.message}`);
    }
  }

  console.error(`[Health] chat model chain has no callable model: ${lastError?.message || 'unknown error'}`);
  return buildHealthShape(models, null);
}

export async function probeEmbeddingModelChain(openai, models) {
  let lastError;

  for (const model of models) {
    try {
      await openai.embeddings.create({
        model,
        input: 'health check',
      });
      return buildHealthShape(models, model);
    } catch (error) {
      lastError = error;
      console.warn(`[Health] embedding model probe failed on "${model}": ${error.message}`);
    }
  }

  console.error(`[Health] embedding model chain has no callable model: ${lastError?.message || 'unknown error'}`);
  return buildHealthShape(models, null);
}

export async function probeAllModelChains(openai, { answerModels, auxModels, embeddingModels }) {
  const [answer, aux, embedding] = await Promise.all([
    probeChatModelChain(openai, answerModels),
    probeChatModelChain(openai, auxModels),
    probeEmbeddingModelChain(openai, embeddingModels),
  ]);

  return { answer, aux, embedding };
}
