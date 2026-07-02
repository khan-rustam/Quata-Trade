import { BadRequestException, Injectable, type PipeTransform } from "@nestjs/common";
import type { ZodTypeAny } from "zod";

/**
 * Every controller input is parsed with a zod schema from @quatatrade/shared —
 * strict schemas reject unknown fields (whitelist validation, Documents/08 §F).
 */
@Injectable()
export class ZodPipe<T extends ZodTypeAny> implements PipeTransform {
  constructor(private readonly schema: T) {}

  transform(value: unknown): unknown {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        statusCode: 400,
        error: "ValidationError",
        message: result.error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`),
      });
    }
    return result.data;
  }
}
