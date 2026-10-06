declare module "topojson-client" {
  export function feature(topology: unknown, object: unknown): { features: object[] };
}

declare module "three" {
  export class MeshPhongMaterial {
    constructor(parameters?: Record<string, unknown>);
    [key: string]: unknown;
  }
}

declare module "world-atlas/countries-110m.json" {
  const land: { objects: { countries: unknown } };
  export default land;
}
