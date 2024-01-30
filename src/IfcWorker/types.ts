import * as WEBIFC from "web-ifc";
interface IBufferGeometry {
  vertexData: Float32Array;
  indexData: Uint32Array
}
export interface IIfcGeometries {
  items: {
    [id: string]: {
      buffer: IBufferGeometry;
      instances: { color: WEBIFC.Color; matrix: number[]; expressID: number }[];
    }
  };
  coordinationMatrix: number[]
}