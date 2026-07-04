import { Controller, Get } from "@nestjs/common";
import type { CountriesResponse } from "@quatatrade/shared";
import { Public } from "../../common/auth/decorators";
import { CountriesService } from "./countries.service";

/** Public: the enabled markets a visitor may sign up under (feeds the sign-up picker). */
@Controller("countries")
export class CountriesController {
  constructor(private readonly countries: CountriesService) {}

  @Public()
  @Get()
  async list(): Promise<CountriesResponse> {
    return { countries: await this.countries.listEnabled() };
  }
}
