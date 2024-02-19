import * as WEBIFC from "web-ifc";

/** Configuration of the IFC-fragment conversion. */
export class IfcParser {
  /** Whether to extract the IFC properties into a JSON. */
  includeProperties = true;
  minGeometrySize = 10;
  minAssetsSize = 1000;
  /**
   * Generate the geometry for categories that are not included by default,
   * like IFCSPACE.
   */
  optionalCategories: number[] = [WEBIFC.IFCSPACE];

  /** Whether to use the coordination data coming from the IFC files. */
  coordinate = true;

  /** Path of the WASM for [web-ifc](https://github.com/ifcjs/web-ifc). */
  wasm = {
    path: "https://unpkg.com/web-ifc@0.0.51/",
    absolute: true,
    logLevel: WEBIFC.LogLevel.LOG_LEVEL_OFF,
  };

  /** List of categories that won't be converted to fragments. */
  excludedCategories = new Set<number>();

  /** Whether to save the absolute location of all IFC items. */
  saveLocations = false;

  /** Loader settings for [web-ifc](https://github.com/ifcjs/web-ifc). */
  webIfc: WEBIFC.LoaderSettings = {
    COORDINATE_TO_ORIGIN: true,
    OPTIMIZE_PROFILES: true,
    CIRCLE_SEGMENTS: 48,
  };

  _webIfc = new WEBIFC.IfcAPI();

  cleanUp() {
    ( this._webIfc as any ) = null;
    this._webIfc = new WEBIFC.IfcAPI();
  }
}