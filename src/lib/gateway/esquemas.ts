/** Esquemas zod compartilhados pelas funções do gateway. */
import { z } from "zod";
import type { Json } from "./tipos";

export const json: z.ZodType<Json> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(json),
    z.record(z.string(), json),
  ]),
);

/** Empresa pedida pela tela: só vale para o admin da plataforma; o servidor confere. */
export const empresa = z.string().max(40).nullish();

export const idRecurso = z.string().regex(/^[A-Za-z0-9_-]{1,80}$/);
