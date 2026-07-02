import { Controller, Get, NotFoundException, Param } from "@nestjs/common";
import { zUuid, type PublicTrader } from "@quatatrade/shared";
import { ZodPipe } from "../../common/zod.pipe";
import { Public } from "../../common/auth/decorators";
import { UsersService } from "./users.service";
import { UserNotFoundError } from "./users.errors";

/** Public merchant profiles — browsable before sign-in (the P2P trust surface). */
@Controller("traders")
export class TradersController {
  constructor(private readonly users: UsersService) {}

  @Public()
  @Get(":id")
  async trader(@Param("id", new ZodPipe(zUuid)) id: string): Promise<PublicTrader> {
    try {
      return await this.users.getPublicTrader(id);
    } catch (err) {
      if (err instanceof UserNotFoundError) throw new NotFoundException("Not found");
      throw err;
    }
  }
}
