import * as THREE from 'three'
import * as OBC from 'openbim-components'
import BVH from './BvhManager';



export class IfcMesh extends THREE.InstancedMesh implements OBC.Disposable {

  /**
   *
   */
  private materialID: Set<string> = new Set();
  constructor( combine: THREE.BufferGeometry, material: THREE.MeshLambertMaterial | THREE.MeshLambertMaterial[] ) {
    super( combine, material, 1 );
    this.geometry.computeBoundingBox();
    this.geometry.computeBoundingSphere();
    BVH.applyThreeMeshBVH( this.geometry )
  }
  async dispose() {
    this.materialID.clear();
    this.materialID = new Set();
    this.geometry.dispose();
    //@ts-ignore
    this.geometry.disposeBoundsTree();
    ( this.geometry as any ) = null;
    if ( Array.isArray( this.material ) ) {
      this.material.forEach( ( mat: THREE.Material ) => mat.dispose() )
    } else {
      this.material.dispose()
    }
  }

}